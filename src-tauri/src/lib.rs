use ignore::WalkBuilder;
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::{
    io::{Read, Write},
    path::Path,
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
};
use tauri::{AppHandle, Emitter, State};

mod windows_titlebar;
mod ai_runtime;

const MAX_PROJECT_ENTRIES: usize = 5_000;
const MAX_PROJECT_DEPTH: usize = 20;

struct TerminalSession {
    id: u64,
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
}

#[derive(Default)]
struct TerminalState {
    session: Mutex<Option<TerminalSession>>,
    next_id: AtomicU64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalOutput {
    session_id: u64,
    data: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectTreeEntry {
    relative_path: String,
    name: String,
    kind: &'static str,
    depth: usize,
    size: u64,
}

fn excluded_directory(name: &str) -> bool {
    matches!(
        name,
        ".git" | ".hg" | ".svn" | "node_modules" | "target" | "dist" | "build" | ".next" | ".cache"
    )
}

fn scan_project_path(root_path: &Path) -> Result<Vec<ProjectTreeEntry>, String> {
    let root = root_path
        .canonicalize()
        .map_err(|error| format!("Project folder is unavailable: {error}"))?;
    if !root.is_dir() {
        return Err("The selected project path is not a folder".into());
    }

    let mut builder = WalkBuilder::new(&root);
    builder
        .max_depth(Some(MAX_PROJECT_DEPTH))
        .follow_links(false)
        .standard_filters(true)
        .filter_entry(|entry| {
            entry.depth() == 0
                || !entry
                    .file_type()
                    .map(|kind| kind.is_dir() && excluded_directory(&entry.file_name().to_string_lossy()))
                    .unwrap_or(false)
        });

    let mut entries = Vec::new();
    for result in builder.build().skip(1) {
        if entries.len() >= MAX_PROJECT_ENTRIES {
            break;
        }
        let Ok(entry) = result else { continue };
        let Some(file_type) = entry.file_type() else { continue };
        if file_type.is_symlink() || (!file_type.is_dir() && !file_type.is_file()) {
            continue;
        }
        let Ok(relative) = entry.path().strip_prefix(&root) else { continue };
        let relative_path = relative.to_string_lossy().replace('\\', "/");
        let size = if file_type.is_file() {
            entry.metadata().map(|metadata| metadata.len()).unwrap_or(0)
        } else {
            0
        };
        entries.push(ProjectTreeEntry {
            relative_path,
            name: entry.file_name().to_string_lossy().into_owned(),
            kind: if file_type.is_dir() { "directory" } else { "file" },
            depth: entry.depth().saturating_sub(1),
            size,
        });
    }

    entries.sort_by(|left, right| {
        left.relative_path
            .to_lowercase()
            .cmp(&right.relative_path.to_lowercase())
    });
    Ok(entries)
}

#[tauri::command]
fn scan_project(root_path: String) -> Result<Vec<ProjectTreeEntry>, String> {
    scan_project_path(Path::new(&root_path))
}

fn shell_command(cwd: Option<&str>) -> Result<CommandBuilder, String> {
    #[cfg(windows)]
    let mut command = {
        let shell = which::which("pwsh.exe").unwrap_or_else(|_| "powershell.exe".into());
        let mut command = CommandBuilder::new(shell);
        command.args([
            "-NoLogo",
            "-NoProfile",
            "-NoExit",
            "-Command",
            "$global:StarEsc=[char]27; $env:TERM='xterm-256color'; if (Get-Variable PSStyle -ErrorAction SilentlyContinue) { $PSStyle.OutputRendering='Ansi'; $PSStyle.FileInfo.Directory=\"$($global:StarEsc)[38;2;120;169;255m\"; $PSStyle.FileInfo.Executable=\"$($global:StarEsc)[38;2;152;195;121m\"; $PSStyle.FileInfo.SymbolicLink=\"$($global:StarEsc)[38;2;198;120;221m\" }; function global:prompt { $name=Split-Path -Leaf (Get-Location); if (-not $name) { $name=(Get-Location).Path }; Write-Host \"$($global:StarEsc)[38;2;104;108;120mstar $($global:StarEsc)[38;2;120;169;255m$name$($global:StarEsc)[0m \" -NoNewline; return \"$($global:StarEsc)[38;2;198;120;221m❯$($global:StarEsc)[0m \" }",
        ]);
        command
    };

    #[cfg(not(windows))]
    let mut command = CommandBuilder::new(
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string()),
    );

    if let Some(cwd) = cwd {
        let path = dunce::canonicalize(Path::new(cwd))
            .map_err(|error| format!("Terminal folder is unavailable: {error}"))?;
        if !path.is_dir() {
            return Err("Terminal working directory is not a folder".into());
        }
        command.cwd(path);
    }
    Ok(command)
}

#[tauri::command]
fn terminal_start(
    app: AppHandle,
    state: State<'_, TerminalState>,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
) -> Result<u64, String> {
    let pty_system = native_pty_system();
    let command = shell_command(cwd.as_deref())?;
    let pair = pty_system
        .openpty(PtySize {
            rows: rows.max(2),
            cols: cols.max(2),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| format!("Could not open terminal: {error}"))?;
    let child = pair
        .slave
        .spawn_command(command)
        .map_err(|error| format!("Could not start shell: {error}"))?;
    drop(pair.slave);
    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|error| format!("Could not read terminal: {error}"))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|error| format!("Could not write to terminal: {error}"))?;

    let id = state.next_id.fetch_add(1, Ordering::Relaxed) + 1;
    let mut session = state.session.lock().map_err(|_| "Terminal state is unavailable")?;
    if let Some(mut previous) = session.take() {
        let _ = previous.child.kill();
    }
    *session = Some(TerminalSession {
        id,
        master: pair.master,
        writer,
        child,
    });
    drop(session);

    std::thread::spawn(move || {
        let mut buffer = [0_u8; 8192];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(count) => {
                    let _ = app.emit(
                        "terminal-output",
                        TerminalOutput {
                            session_id: id,
                            data: String::from_utf8_lossy(&buffer[..count]).into_owned(),
                        },
                    );
                }
                Err(_) => break,
            }
        }
        let _ = app.emit("terminal-exit", id);
    });

    Ok(id)
}

#[tauri::command]
fn terminal_write(state: State<'_, TerminalState>, session_id: u64, data: String) -> Result<(), String> {
    let mut guard = state.session.lock().map_err(|_| "Terminal state is unavailable")?;
    let session = guard.as_mut().ok_or("Terminal is not running")?;
    if session.id != session_id {
        return Ok(());
    }
    session.writer.write_all(data.as_bytes()).map_err(|error| error.to_string())?;
    session.writer.flush().map_err(|error| error.to_string())
}

#[tauri::command]
fn terminal_resize(state: State<'_, TerminalState>, session_id: u64, cols: u16, rows: u16) -> Result<(), String> {
    let guard = state.session.lock().map_err(|_| "Terminal state is unavailable")?;
    let session = guard.as_ref().ok_or("Terminal is not running")?;
    if session.id != session_id {
        return Ok(());
    }
    session
        .master
        .resize(PtySize { rows: rows.max(2), cols: cols.max(2), pixel_width: 0, pixel_height: 0 })
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn terminal_stop(state: State<'_, TerminalState>, session_id: u64) -> Result<(), String> {
    let mut guard = state.session.lock().map_err(|_| "Terminal state is unavailable")?;
    if guard.as_ref().map(|session| session.id) != Some(session_id) {
        return Ok(());
    }
    if let Some(mut session) = guard.take() {
        session.child.kill().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(windows_titlebar::NativeTitlebarState::default())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            use tauri::Manager;
            let ai_state = ai_runtime::AiState::load(app.handle())?;
            app.manage(ai_state);
            if let Err(error) = ai_runtime::restart(app.handle(), &app.state::<ai_runtime::AiState>()) {
                eprintln!("AI runtime unavailable: {error}");
            }
            if let Some(window) = app.get_webview_window("main") {
                let status = windows_titlebar::install(&window);
                if let Ok(mut stored) = app
                    .state::<windows_titlebar::NativeTitlebarState>()
                    .0
                    .lock()
                {
                    *stored = status.clone();
                }
                if let Some(error) = status.error {
                    eprintln!("Native Windows title bar unavailable; using the system frame: {error}");
                }
            }
            Ok(())
        })
        .manage(TerminalState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            ai_runtime::ai_runtime_info,
            ai_runtime::ai_list_connections,
            ai_runtime::ai_save_connection,
            ai_runtime::ai_remove_connection,
            ai_runtime::ai_detect_clis,
            scan_project,
            windows_titlebar::native_titlebar_status,
            terminal_start,
            terminal_write,
            terminal_resize,
            terminal_stop
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{fs, sync::mpsc, time::Duration};

    #[test]
    fn scans_a_project_hierarchy_and_skips_generated_directories() {
        let root = tempfile::tempdir().expect("temp project");
        fs::create_dir_all(root.path().join("src/components")).expect("source folders");
        fs::create_dir_all(root.path().join("node_modules/package")).expect("generated folder");
        fs::write(root.path().join("src/lib.rs"), "fn main() {}\n").expect("source file");
        fs::write(root.path().join("src/components/App.tsx"), "export {}\n").expect("nested file");
        fs::write(root.path().join("node_modules/package/index.js"), "").expect("generated file");

        let entries = scan_project_path(root.path()).expect("scan succeeds");
        assert!(entries.iter().any(|entry| entry.relative_path == "src/lib.rs" && entry.kind == "file"));
        assert!(entries.iter().any(|entry| entry.relative_path == "src/components/App.tsx" && entry.depth == 2));
        assert!(!entries.iter().any(|entry| entry.relative_path.starts_with("node_modules")));
    }

    #[test]
    fn rejects_a_file_as_a_project_root() {
        let root = tempfile::tempdir().expect("temp project");
        let file = root.path().join("file.txt");
        fs::write(&file, "content").expect("file");
        assert!(scan_project_path(&file).is_err());
    }

    #[cfg(windows)]
    #[test]
    fn native_pty_runs_a_command_and_captures_output() {
        let pty = native_pty_system();
        let pair = pty.openpty(PtySize { rows: 12, cols: 80, pixel_width: 0, pixel_height: 0 }).expect("open ConPTY");
        let command = CommandBuilder::new("whoami.exe");
        let mut child = pair.slave.spawn_command(command).expect("spawn command");
        drop(pair.slave);

        let mut reader = pair.master.try_clone_reader().expect("PTY reader");
        let (output_tx, output_rx) = mpsc::channel();
        std::thread::spawn(move || {
            let mut output = String::new();
            let mut buffer = [0_u8; 4096];
            loop {
                match reader.read(&mut buffer) {
                    Ok(0) => {
                        let _ = output_tx.send(Ok(output));
                        break;
                    }
                    Ok(count) => {
                        output.push_str(&String::from_utf8_lossy(&buffer[..count]));
                        if !output.trim().is_empty() {
                            let _ = output_tx.send(Ok(output));
                            break;
                        }
                    }
                    Err(error) => {
                        let _ = output_tx.send(Err(error.to_string()));
                        break;
                    }
                }
            }
        });
        let writer = pair.master.take_writer().expect("PTY writer");
        drop(writer);
        let output = match output_rx.recv_timeout(Duration::from_secs(10)) {
            Ok(result) => result.expect("read PTY output"),
            Err(error) => {
                let _ = child.kill();
                panic!("timed out waiting for PTY output: {error}");
            }
        };
        child.wait().expect("command exits");
        assert!(!output.trim().is_empty(), "terminal output was empty");
    }
}
