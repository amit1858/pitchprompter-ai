// Camera Lock window launcher. Computes preset positions via Tauri's
// current monitor API, opens an undecorated always-on-top window.

export type Placement = "top-center" | "top-left" | "top-right";

const DEFAULT_W = 500;
const DEFAULT_H = 180;
const MARGIN = 16;

export interface LaunchOpts {
  placement: Placement;
  scriptId: string | null;
  width?: number;
  height?: number;
  transparent?: boolean;
}

export async function launchCameraLock(opts: LaunchOpts): Promise<string> {
  const width = opts.width ?? DEFAULT_W;
  const height = opts.height ?? DEFAULT_H;

  // Lazy import keeps web preview build working without Tauri injected.
  const mod = await import("@tauri-apps/api/window").catch(() => null);
  if (!mod) {
    throw new Error("camera_lock_requires_desktop");
  }

  // Compute target position based on current monitor.
  let x = 0;
  let y = MARGIN;
  try {
    const monitor = await mod.currentMonitor();
    if (monitor) {
      // Use logical pixels (divide by scale factor) — Tauri positions are physical
      // pixels in Tauri 1.x, but the LogicalPosition helper handles conversion.
      const sw = monitor.size.width / monitor.scaleFactor;
      switch (opts.placement) {
        case "top-left":
          x = MARGIN;
          break;
        case "top-right":
          x = Math.max(MARGIN, sw - width - MARGIN);
          break;
        case "top-center":
        default:
          x = Math.max(MARGIN, Math.round((sw - width) / 2));
      }
    }
  } catch {
    // Fall back to top-left if monitor query fails.
  }

  const url = `/?camera=1&scriptId=${encodeURIComponent(opts.scriptId ?? "")}`;
  const label = "camlock-" + Date.now().toString(36);

  const win = new mod.WebviewWindow(label, {
    url,
    title: "PitchPrompter — Camera Lock",
    width,
    height,
    minWidth: 320,
    minHeight: 120,
    x,
    y,
    alwaysOnTop: true,
    decorations: false,
    resizable: true,
    skipTaskbar: false,
    transparent: opts.transparent ?? false,
  });

  return await new Promise<string>((resolve, reject) => {
    const offCreated = win.once("tauri://created", async () => {
      offCreated.then((u) => u());
      // Install the WebView2 microphone permission handler so getUserMedia
      // does not get silently denied by the default deny-all behavior.
      try {
        const { invoke } = await import("@tauri-apps/api/tauri");
        await invoke("grant_microphone_for_window", { label });
      } catch (e) {
        // Non-fatal — the JS layer will still call getUserMedia and surface
        // the resulting error through the existing fallback paths.
        console.warn("[camera-lock] grant_microphone_for_window failed", e);
      }
      resolve(label);
    });
    win.once("tauri://error", (e) => {
      reject(new Error(typeof e.payload === "string" ? e.payload : "Failed to open camera lock window."));
    });
  });
}
