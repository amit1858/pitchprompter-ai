// WebView2 PermissionRequested handler for Microphone access.
//
// Background: Tauri 1.x on Windows uses WebView2 as the embedded browser.
// When a web page calls navigator.mediaDevices.getUserMedia({ audio: true }),
// WebView2 fires the PermissionRequested event. If no handler is installed,
// the default state is "Deferred" which behaves as a deny — and crucially
// the Windows OS permission prompt is never shown, getUserMedia just rejects.
//
// This module installs the minimum handler: ONLY the Microphone permission
// is auto-granted for our own webview origin. All other permission kinds
// (camera, geolocation, notifications, etc.) are left at their default and
// will continue to be denied. This is the least-permission fix for the
// "no microphone prompt in Camera Lock" symptom.
//
// Exposed as a Tauri command so the frontend can invoke it for both the
// main window (on app boot) and each Camera Lock window after creation.

#[cfg(target_os = "windows")]
mod windows_impl {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        COREWEBVIEW2_PERMISSION_KIND, COREWEBVIEW2_PERMISSION_KIND_MICROPHONE,
        COREWEBVIEW2_PERMISSION_STATE_ALLOW, ICoreWebView2,
    };
    use webview2_com::PermissionRequestedEventHandler;

    pub fn install(window: &tauri::Window) -> Result<(), String> {
        let label = window.label().to_string();
        window
            .with_webview(move |webview| {
                let result: Result<(), String> = (|| unsafe {
                    let controller = webview.controller();
                    let core_opt: Option<ICoreWebView2> = controller
                        .CoreWebView2()
                        .ok();
                    let core = match core_opt {
                        Some(c) => c,
                        None => return Err(format!("CoreWebView2 unavailable for window {label}")),
                    };
                    let mut token = Default::default();
                    let handler = PermissionRequestedEventHandler::create(Box::new(
                        |_sender, args| {
                            if let Some(args) = args {
                                let mut kind: COREWEBVIEW2_PERMISSION_KIND = Default::default();
                                if unsafe { args.PermissionKind(&mut kind) }.is_ok()
                                    && kind == COREWEBVIEW2_PERMISSION_KIND_MICROPHONE
                                {
                                    let _ = unsafe { args.SetState(COREWEBVIEW2_PERMISSION_STATE_ALLOW) };
                                }
                                // All other permission kinds: leave default (deny).
                            }
                            Ok(())
                        },
                    ));
                    core.add_PermissionRequested(&handler, &mut token).map_err(|e| {
                        format!("add_PermissionRequested failed for window {label}: {e}")
                    })?;
                    let _ = &core;
                    Ok(())
                })();
                if let Err(e) = result {
                    eprintln!("[media-perm] {e}");
                }
            })
            .map_err(|e| format!("with_webview failed: {e}"))?;
        Ok(())
    }
}

#[tauri::command]
pub fn grant_microphone_for_window(
    app: tauri::AppHandle,
    label: String,
) -> Result<(), String> {
    use tauri::Manager;
    let window = app
        .get_window(&label)
        .ok_or_else(|| format!("window not found: {label}"))?;
    #[cfg(target_os = "windows")]
    {
        windows_impl::install(&window)?;
        return Ok(());
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = window;
        Ok(())
    }
}
