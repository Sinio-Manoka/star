use rand::{distr::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    net::TcpListener,
    path::PathBuf,
    sync::Mutex,
};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_shell::{process::CommandChild, ShellExt};

use crate::secret_store::SecretStore;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConnection {
    pub id: String,
    pub kind: String,
    pub label: String,
    pub model: String,
    pub base_url: Option<String>,
    pub command: Option<String>,
    pub region: Option<String>,
    pub project_id: Option<String>,
    pub active: bool,
    /// True only when the secret store actually has a non-empty entry for this
    /// connection id. Always probed on every list call, never cached.
    #[serde(default)]
    pub has_secret: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveAiConnection {
    pub id: Option<String>,
    pub kind: String,
    pub label: String,
    pub model: String,
    pub base_url: Option<String>,
    pub command: Option<String>,
    pub region: Option<String>,
    pub project_id: Option<String>,
    pub api_key: Option<String>,
    pub active: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiRuntimeInfo {
    pub endpoint: String,
    pub token: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliAvailability {
    pub kind: &'static str,
    pub label: &'static str,
    pub installed: bool,
    pub path: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SidecarConnection {
    id: String,
    kind: String,
    label: String,
    model: String,
    base_url: Option<String>,
    command: Option<String>,
    region: Option<String>,
    project_id: Option<String>,
    active: bool,
    api_key: String,
}

pub struct AiState {
    config_path: PathBuf,
    /// Dual-backend secret storage (OS keyring + encrypted file vault). The
    /// vault path sits next to `config_path` so it lives in the app config
    /// dir alongside `ai-connections.json`.
    secrets: SecretStore,
    connections: Mutex<Vec<AiConnection>>,
    runtime: Mutex<Option<AiRuntimeInfo>>,
    child: Mutex<Option<CommandChild>>,
}

impl AiState {
    pub fn load(app: &AppHandle) -> Result<Self, String> {
        let config_dir = app.path().app_config_dir().map_err(|error| error.to_string())?;
        fs::create_dir_all(&config_dir).map_err(|error| error.to_string())?;
        let config_path = config_dir.join("ai-connections.json");
        let vault_path = config_dir.join("ai-secrets.enc");
        let connections = if config_path.exists() {
            serde_json::from_slice(&fs::read(&config_path).map_err(|error| error.to_string())?)
                .map_err(|error| format!("Could not read AI settings: {error}"))?
        } else {
            Vec::new()
        };
        Ok(Self {
            config_path,
            secrets: SecretStore::new(vault_path),
            connections: Mutex::new(connections),
            runtime: Mutex::new(None),
            child: Mutex::new(None),
        })
    }

    fn persist(&self, connections: &[AiConnection]) -> Result<(), String> {
        let bytes = serde_json::to_vec_pretty(connections).map_err(|error| error.to_string())?;
        fs::write(&self.config_path, bytes).map_err(|error| error.to_string())
    }
}

impl Drop for AiState {
    fn drop(&mut self) {
        if let Ok(child) = self.child.get_mut() {
            if let Some(child) = child.take() {
                let _ = child.kill();
            }
        }
    }
}

fn public_connections(state: &AiState) -> Result<Vec<AiConnection>, String> {
    let mut connections = state
        .connections
        .lock()
        .map_err(|_| "AI settings are unavailable")?
        .clone();
    // Probe the secret store on every list so the UI's "has secret"
    // indicator reflects the actual stored credential (never drifts from
    // a stale cached value).
    for connection in &mut connections {
        connection.has_secret = state.secrets.has(&connection.id);
    }
    Ok(connections)
}

pub fn restart(app: &AppHandle, state: &AiState) -> Result<(), String> {
    if let Some(child) = state.child.lock().map_err(|_| "AI runtime is unavailable")?.take() {
        let _ = child.kill();
    }

    let port = TcpListener::bind("127.0.0.1:0")
        .map_err(|error| error.to_string())?
        .local_addr()
        .map_err(|error| error.to_string())?
        .port();
    let token: String = rand::rng()
        .sample_iter(&Alphanumeric)
        .take(48)
        .map(char::from)
        .collect();

    let sidecar_connections: Vec<SidecarConnection> = state
        .connections
        .lock()
        .map_err(|_| "AI settings are unavailable")?
        .iter()
        .map(|connection| SidecarConnection {
            id: connection.id.clone(),
            kind: connection.kind.clone(),
            label: connection.label.clone(),
            model: connection.model.clone(),
            base_url: connection.base_url.clone(),
            command: connection.command.clone(),
            region: connection.region.clone(),
            project_id: connection.project_id.clone(),
            active: connection.active,
            api_key: state
                .secrets
                .get(&connection.id)
                .ok()
                .flatten()
                .unwrap_or_default(),
        })
        .collect();
    let encoded = serde_json::to_string(&sidecar_connections).map_err(|error| error.to_string())?;

    let command = app
        .shell()
        .sidecar("star-ai")
        .map_err(|error| format!("Could not locate AI runtime: {error}"))?
        .env("STAR_AI_PORT", port.to_string())
        .env("STAR_AI_TOKEN", &token)
        .env("STAR_AI_CONNECTIONS", encoded);
    let (mut events, child) = command
        .spawn()
        .map_err(|error| format!("Could not start AI runtime: {error}"))?;
    tauri::async_runtime::spawn(async move {
        use tauri_plugin_shell::process::CommandEvent;
        while let Some(event) = events.recv().await {
            match event {
                CommandEvent::Stderr(bytes) => eprintln!("star-ai: {}", String::from_utf8_lossy(&bytes)),
                CommandEvent::Error(error) => eprintln!("star-ai: {error}"),
                _ => {}
            }
        }
    });

    *state.child.lock().map_err(|_| "AI runtime is unavailable")? = Some(child);
    *state.runtime.lock().map_err(|_| "AI runtime is unavailable")? = Some(AiRuntimeInfo {
        endpoint: format!("http://127.0.0.1:{port}/chat"),
        token,
    });
    Ok(())
}

#[tauri::command]
pub fn ai_runtime_info(state: State<'_, AiState>) -> Result<AiRuntimeInfo, String> {
    state
        .runtime
        .lock()
        .map_err(|_| "AI runtime is unavailable")?
        .clone()
        .ok_or_else(|| "AI runtime has not started".into())
}

#[tauri::command]
pub fn ai_list_connections(state: State<'_, AiState>) -> Result<Vec<AiConnection>, String> {
    public_connections(&state)
}

#[tauri::command]
pub fn ai_save_connection(
    app: AppHandle,
    state: State<'_, AiState>,
    input: SaveAiConnection,
) -> Result<Vec<AiConnection>, String> {
    let id = input.id.unwrap_or_else(|| {
        rand::rng()
            .sample_iter(&Alphanumeric)
            .take(16)
            .map(char::from)
            .collect()
    });
    // `None` means the caller is updating metadata (for example the selected
    // model) and the existing credential must remain untouched. An explicitly
    // supplied empty string is the only way to clear a saved credential.
    if let Some(api_key) = input.api_key.as_deref() {
        state.secrets.set(&id, api_key.trim())?;
    }

    {
        let mut connections = state.connections.lock().map_err(|_| "AI settings are unavailable")?;
        if input.active || connections.is_empty() {
            for connection in connections.iter_mut() {
                connection.active = false;
            }
        }
        let next = AiConnection {
            id: id.clone(),
            kind: input.kind,
            label: input.label.trim().to_string(),
            model: input.model.trim().to_string(),
            base_url: input.base_url.filter(|value| !value.trim().is_empty()),
            command: input.command.filter(|value| !value.trim().is_empty()),
            region: input.region.filter(|value| !value.trim().is_empty()),
            project_id: input.project_id.filter(|value| !value.trim().is_empty()),
            active: input.active || connections.is_empty(),
            has_secret: state.secrets.has(&id),
        };
        if let Some(existing) = connections.iter_mut().find(|connection| connection.id == id) {
            *existing = next;
        } else {
            connections.push(next);
        }
        state.persist(&connections)?;
    }
    restart(&app, &state)?;
    public_connections(&state)
}

#[tauri::command]
pub fn ai_remove_connection(
    app: AppHandle,
    state: State<'_, AiState>,
    id: String,
) -> Result<Vec<AiConnection>, String> {
    state.secrets.set(&id, "")?;
    {
        let mut connections = state.connections.lock().map_err(|_| "AI settings are unavailable")?;
        let removed_active = connections.iter().any(|connection| connection.id == id && connection.active);
        connections.retain(|connection| connection.id != id);
        if removed_active {
            if let Some(first) = connections.first_mut() {
                first.active = true;
            }
        }
        state.persist(&connections)?;
    }
    restart(&app, &state)?;
    public_connections(&state)
}

#[tauri::command]
pub fn ai_detect_clis() -> Vec<CliAvailability> {
    [("codex", "Codex", "codex"), ("claude-code", "Claude Code", "claude"), ("opencode", "OpenCode", "opencode"), ("gemini-cli", "Gemini CLI", "gemini")]
        .into_iter()
        .map(|(kind, label, executable)| {
            let path = which::which(executable).ok().map(|path| path.to_string_lossy().into_owned());
            CliAvailability { kind, label, installed: path.is_some(), path }
        })
        .collect()
}
