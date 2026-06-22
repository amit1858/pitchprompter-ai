// Prevents additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod capture_exclusion;
mod media_permissions;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            capture_exclusion::set_capture_exclusion,
            capture_exclusion::capture_exclusion_supported,
            media_permissions::grant_microphone_for_window,
        ])
        .setup(|app| {
            // Install the WebView2 microphone permission handler on the main
            // window as soon as it exists. Camera Lock windows opened later
            // call grant_microphone_for_window from JS after creation.
            if app.get_window("main").is_some() {
                if let Err(e) = media_permissions::grant_microphone_for_window(
                    app.handle(),
                    "main".to_string(),
                ) {
                    eprintln!("[media-perm] main window setup failed: {e}");
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running PitchPrompter AI");
}
