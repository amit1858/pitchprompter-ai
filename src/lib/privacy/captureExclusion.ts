// Thin wrapper around the Tauri `set_capture_exclusion` command.
// Resolves to a tri-state status so the UI can label what the OS actually did.

export type CaptureExclusionStatus =
  | { kind: "applied"; excluded: boolean }
  | { kind: "unavailable"; reason: string };

let cachedSupported: boolean | null = null;

function tauriInvoke(): null | ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) {
  const w = window as unknown as { __TAURI__?: { invoke?: (c: string, a?: any) => Promise<unknown> } };
  return w.__TAURI__?.invoke ?? null;
}

export function isTauri(): boolean {
  return !!tauriInvoke();
}

export async function isCaptureExclusionSupported(): Promise<boolean> {
  if (cachedSupported !== null) return cachedSupported;
  const invoke = tauriInvoke();
  if (!invoke) return (cachedSupported = false);
  try {
    cachedSupported = (await invoke("capture_exclusion_supported")) as boolean;
  } catch {
    cachedSupported = false;
  }
  return cachedSupported;
}

export async function applyCaptureExclusion(exclude: boolean): Promise<CaptureExclusionStatus> {
  const invoke = tauriInvoke();
  if (!invoke) return { kind: "unavailable", reason: "Requires the desktop app." };
  if (!(await isCaptureExclusionSupported())) {
    return { kind: "unavailable", reason: "Not supported on this OS." };
  }
  try {
    const out = (await invoke("set_capture_exclusion", { exclude })) as boolean;
    return { kind: "applied", excluded: !!out };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown OS error";
    return { kind: "unavailable", reason: msg };
  }
}
