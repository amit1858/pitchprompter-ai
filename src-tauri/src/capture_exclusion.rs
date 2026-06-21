// Experimental: hide windows from screen capture (Windows-only).
//
// Uses Win32 SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE). Honored by
// modern capture APIs (Win32 Desktop Duplication 1903+, Graphics.Capture,
// most browser/Teams/Zoom share paths). NOT guaranteed:
//  - GDI / BitBlt-based capture tools can still see the window.
//  - Some hardware capture cards bypass display-affinity entirely.
//  - On older Windows 10 builds (< 2004) WDA_EXCLUDEFROMCAPTURE silently
//    falls back to WDA_MONITOR (window appears blank), which is still safer
//    than visible.
//
// We treat this as a defence-in-depth layer on top of the user-facing
// guidance "share an app window, not the full desktop".

#[tauri::command]
pub fn capture_exclusion_supported() -> bool {
    cfg!(target_os = "windows")
}

#[tauri::command]
pub fn set_capture_exclusion(
    window: tauri::Window,
    exclude: bool,
) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::Foundation::HWND;
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE, WDA_NONE,
        };
        let hwnd_handle = window.hwnd().map_err(|e| e.to_string())?;
        let raw: HWND = hwnd_handle.0 as HWND;
        let affinity = if exclude { WDA_EXCLUDEFROMCAPTURE } else { WDA_NONE };
        let ok = unsafe { SetWindowDisplayAffinity(raw, affinity) };
        if ok == 0 {
            return Err("SetWindowDisplayAffinity failed (OS rejected the call).".into());
        }
        Ok(exclude)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (window, exclude);
        Err("Capture exclusion is only available on Windows.".into())
    }
}
