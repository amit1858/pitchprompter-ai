// Prevents additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod capture_exclusion;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            capture_exclusion::set_capture_exclusion,
            capture_exclusion::capture_exclusion_supported,
        ])
        .run(tauri::generate_context!())
        .expect("error while running PitchPrompter AI");
}
