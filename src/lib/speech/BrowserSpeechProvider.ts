import type { SpeechProvider, SpeechResultHandler, SpeechErrorHandler } from "./SpeechProvider";

// Web Speech API typings are not in lib.dom for all TS versions; define minimally.
interface SRConstructor {
  new (): SRInstance;
}
interface SRInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: any) => void) | null;
  onerror: ((ev: any) => void) | null;
  onend: (() => void) | null;
}

function getCtor(): SRConstructor | null {
  const w = window as any;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as SRConstructor | null;
}

/**
 * Compute the delta between a previously forwarded transcript and the latest
 * accumulated transcript for the same Web Speech result segment.
 *
 * Web Speech with `interimResults=true` re-fires the SAME `results[i]` with a
 * growing transcript on every update (e.g. "welcome" → "welcome to" →
 * "welcome to pitchprompter"). If we forward the full transcript every time,
 * the consumer's token ring buffer is polluted with duplicate prefixes and
 * alignment cannot find clean matches.
 *
 * Strategy:
 *  - If `current` starts with `previous` (the common case), return the new
 *    suffix only. Trim leading whitespace because the suffix often begins
 *    with a space joining it to the previous tail.
 *  - If it does not (the engine corrected a word, or a wholly new phrase
 *    arrived under the same index), fall back to forwarding `current` whole.
 *    This is rare but the alignment engine is tolerant of an occasional
 *    duplicate; it is *not* tolerant of duplicates on every event.
 *  - If `current` is empty after trimming, return null so the caller can skip
 *    emission entirely.
 *
 * Pure / no I/O so it is trivially unit-testable.
 */
export function extractDelta(previous: string, current: string): string | null {
  const cur = current ?? "";
  if (!cur.trim()) return null;
  const prev = previous ?? "";
  if (prev && cur.startsWith(prev)) {
    const suffix = cur.slice(prev.length).replace(/^\s+/, "");
    return suffix.length > 0 ? suffix : null;
  }
  // Fallback: transcript was corrected mid-segment or this is a fresh segment.
  return cur;
}

export class BrowserSpeechProvider implements SpeechProvider {
  readonly id = "browser";
  readonly displayName = "Browser (Web Speech API)";
  private rec: SRInstance | null = null;
  /** Last full transcript forwarded for each result index — used to compute deltas. */
  private seen: Map<number, string> = new Map();
  /** Count of events suppressed because the delta was empty (purely debug surface). */
  private suppressed = 0;

  isSupported(): boolean {
    return getCtor() !== null;
  }

  /** Debug-only: number of onresult fires whose delta was empty and skipped. */
  getDuplicateSuppressedCount(): number {
    return this.suppressed;
  }

  async start(opts: {
    lang?: string;
    onResult: SpeechResultHandler;
    onError?: SpeechErrorHandler;
    onEnd?: () => void;
    onStage?: (name: string, payload?: unknown) => void;
  }): Promise<void> {
    const stage = opts.onStage ?? (() => {});
    const Ctor = getCtor();
    if (!Ctor) {
      stage("speech_recognition_unsupported");
      opts.onError?.({ code: "unsupported", message: "Web Speech API is not available in this runtime." });
      return;
    }
    // Phase 2: explicit mediaDevices availability check before getUserMedia,
    // so the failure mode "navigator.mediaDevices is undefined" surfaces
    // distinctly from "permission denied".
    if (typeof navigator === "undefined" || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
      stage("media_devices_unavailable");
      opts.onError?.({
        code: "media_unavailable",
        message: "Microphone access is not available in this desktop window. Voice Follow cannot start. Manual scrolling still works.",
      });
      return;
    }
    // Request mic permission explicitly first for clearer UX.
    stage("get_user_media_called");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      stage("get_user_media_success");
    } catch (e: any) {
      const name: string = e?.name ?? "Error";
      const msg: string = e?.message ?? "Microphone permission denied.";
      stage("get_user_media_error", { name, message: msg });
      // Distinguish permission denial from "media stack absent" so the UI can
      // show the right message. NotAllowedError = user (or runtime) denied;
      // NotFoundError / OverconstrainedError = no device or constraints bad;
      // SecurityError = insecure context / blocked by policy;
      // TypeError = mediaDevices itself bad.
      let code = "permission";
      if (name === "NotAllowedError" || name === "SecurityError") code = "permission";
      else if (name === "NotFoundError" || name === "OverconstrainedError") code = "no_device";
      else if (name === "TypeError") code = "media_unavailable";
      opts.onError?.({ code, message: msg });
      return;
    }

    const rec = new Ctor();
    rec.lang = opts.lang ?? "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    // Reset per-segment cache for this recognition instance.
    this.seen = new Map();
    this.suppressed = 0;

    rec.onresult = (ev: any) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        const full: string = res[0]?.transcript ?? "";
        const isFinal = !!res.isFinal;
        const prev = this.seen.get(i) ?? "";
        const delta = extractDelta(prev, full);
        if (delta === null) {
          this.suppressed++;
          this.seen.set(i, full);
          if (isFinal) this.seen.delete(i);
          continue;
        }
        this.seen.set(i, full);
        if (isFinal) this.seen.delete(i);
        opts.onResult({
          text: delta,
          isFinal,
          timestamp: Date.now(),
          resultIndex: i,
          rawTranscript: full,
        });
      }
    };
    rec.onerror = (ev: any) => {
      stage("speech_recognition_error", { error: ev?.error });
      opts.onError?.({ code: ev?.error ?? "unknown", message: ev?.message ?? String(ev?.error ?? "speech error") });
    };
    rec.onend = () => {
      stage("speech_recognition_end");
      this.seen.clear();
      opts.onEnd?.();
    };

    this.rec = rec;
    stage("speech_recognition_start_called");
    try {
      rec.start();
      stage("speech_recognition_start_success");
    } catch (e: any) {
      stage("speech_recognition_start_error", { message: e?.message });
      opts.onError?.({ code: "start_failed", message: e?.message ?? "Could not start recognition." });
    }
  }

  stop(): void {
    try {
      this.rec?.stop();
    } catch {
      /* noop */
    }
    this.rec = null;
    this.seen.clear();
  }
}
