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

export class BrowserSpeechProvider implements SpeechProvider {
  readonly id = "browser";
  readonly displayName = "Browser (Web Speech API)";
  private rec: SRInstance | null = null;

  isSupported(): boolean {
    return getCtor() !== null;
  }

  async start(opts: {
    lang?: string;
    onResult: SpeechResultHandler;
    onError?: SpeechErrorHandler;
    onEnd?: () => void;
  }): Promise<void> {
    const Ctor = getCtor();
    if (!Ctor) {
      opts.onError?.({ code: "unsupported", message: "Web Speech API is not available in this runtime." });
      return;
    }
    // Request mic permission explicitly first for clearer UX.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch (e: any) {
      opts.onError?.({ code: "permission", message: e?.message ?? "Microphone permission denied." });
      return;
    }

    const rec = new Ctor();
    rec.lang = opts.lang ?? "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (ev: any) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        const text: string = res[0]?.transcript ?? "";
        opts.onResult({ text, isFinal: !!res.isFinal, timestamp: Date.now() });
      }
    };
    rec.onerror = (ev: any) => {
      opts.onError?.({ code: ev?.error ?? "unknown", message: ev?.message ?? String(ev?.error ?? "speech error") });
    };
    rec.onend = () => {
      opts.onEnd?.();
    };

    this.rec = rec;
    try {
      rec.start();
    } catch (e: any) {
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
  }
}
