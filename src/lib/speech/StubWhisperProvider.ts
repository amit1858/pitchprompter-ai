import type { SpeechProvider } from "./SpeechProvider";

// Placeholder for a future local Whisper integration (whisper.cpp / faster-whisper
// via a Tauri sidecar binary). Kept as a stub so the UI can list it as "coming soon"
// without lying that it works.
export class StubWhisperProvider implements SpeechProvider {
  readonly id = "whisper-local";
  readonly displayName = "Whisper (local, coming soon)";

  isSupported(): boolean {
    return false;
  }

  async start(opts: { onError?: (e: { code: string; message: string }) => void }): Promise<void> {
    opts.onError?.({
      code: "not_implemented",
      message: "Local Whisper provider is not implemented yet. Use the Browser provider for now.",
    });
  }

  stop(): void {
    /* noop */
  }
}
