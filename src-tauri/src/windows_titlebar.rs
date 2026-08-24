use serde::Serialize;
use std::sync::Mutex;
use tauri::{State, WebviewWindow};

#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeTitlebarStatus {
    pub active: bool,
    pub height: i32,
    pub right_inset: i32,
    pub error: Option<String>,
}

#[derive(Default)]
pub struct NativeTitlebarState(pub Mutex<NativeTitlebarStatus>);

#[cfg(windows)]
use std::ffi::c_void;

#[cfg(windows)]
extern "C" {
    fn star_enable_windows_titlebar(
        hwnd: *mut c_void,
        height: *mut i32,
        right_inset: *mut i32,
    ) -> i32;
}

#[cfg(windows)]
pub fn install(window: &WebviewWindow) -> NativeTitlebarStatus {
    let Ok(hwnd) = window.hwnd() else {
        return NativeTitlebarStatus {
            error: Some("Tauri did not provide the Windows window handle".into()),
            ..Default::default()
        };
    };
    let mut height = 0;
    let mut right_inset = 0;
    let result = unsafe {
        star_enable_windows_titlebar(hwnd.0, &mut height, &mut right_inset)
    };
    if result < 0 {
        return NativeTitlebarStatus {
            error: Some(format!("Windows App SDK error 0x{:08X}", result as u32)),
            ..Default::default()
        };
    }
    NativeTitlebarStatus {
        active: true,
        height,
        right_inset,
        error: None,
    }
}

#[cfg(not(windows))]
pub fn install(_window: &WebviewWindow) -> NativeTitlebarStatus {
    NativeTitlebarStatus::default()
}

#[tauri::command]
pub fn native_titlebar_status(state: State<'_, NativeTitlebarState>) -> NativeTitlebarStatus {
    state.0.lock().map(|status| status.clone()).unwrap_or_default()
}
