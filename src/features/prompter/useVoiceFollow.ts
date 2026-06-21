import { useEffect, useRef, useState } from "react";
import { BrowserSpeechProvider } from "@/lib/speech/BrowserSpeechProvider";
import { alignWindow, tokenizeScript, tokenizeSpoken, type ScriptWord } from "./voiceAlign";
import { voiceFollowDebug } from "./voiceFollowDebug";

export type VoiceFollowStatus =
  | "idle"
  | "listening"
  | "following"
  | "low-confidence"
  | "error";

export interface UseVoiceFollowOpts {
  enabled: boolean;
  scriptBody: string | null;
  stageRef: React.RefObject<HTMLElement | null>;
  textRef: React.RefObject<HTMLElement | null>;
  /** Reading-line position in the stage, 0..1 from top. Default 0.30 (camera-top). */
  readingLine?: number;
  /** LERP smoothing factor 0..1 per frame. Default 0.12. */
  smoothing?: number;
  /** Called once when Voice Follow cannot start (mic denied, unsupported, etc.). */
  onUnavailable?: (reason: string) => void;
  /** Called when the engine decides to disable itself (e.g. permission denied). */
  onForceDisable?: () => void;
}

export interface UseVoiceFollowReturn {
  status: VoiceFollowStatus;
  /** Current scroll offset in px — apply to your scroller via translateY. */
  offset: number;
  /** Imperative reset (e.g. when the user clicks Reset). */
  reset: () => void;
  /** Last aligned script-word index — useful for rendering a current-word highlight. */
  cursor: number;
  /** Tokenized script (memoized via the body string). */
  tokens: ScriptWord[];
  /** True if the browser exposes a Web Speech engine at all. */
  supported: boolean;
}

/**
 * Voice Follow engine, shared by the main teleprompter and Camera Lock.
 *
 * Design:
 *  - One mic session per hook instance. The caller decides whether to mount it.
 *  - Speech events update a target offset (ref); a single RAF lerps state.offset
 *    toward it so the UI never jumps even on bursty recognition.
 *  - Never moves the cursor backward by more than 1 token.
 *  - No persistence, no token storage beyond a 24-word ring in memory.
 *  - Auto-restarts the browser STT on silence-induced end while still enabled.
 *
 * Privacy: audio is consumed by the system Web Speech engine; this hook never
 * stores, forwards, or transmits the transcript outside the React tree.
 */
export function useVoiceFollow({
  enabled,
  scriptBody,
  stageRef,
  textRef,
  readingLine = 0.30,
  smoothing = 0.12,
  onUnavailable,
  onForceDisable,
}: UseVoiceFollowOpts): UseVoiceFollowReturn {
  const [status, setStatus] = useState<VoiceFollowStatus>("idle");
  const [offset, setOffset] = useState(0);
  const [cursor, setCursor] = useState(0);

  // Tokenize script when body changes.
  const tokensRef = useRef<ScriptWord[]>([]);
  const [tokens, setTokens] = useState<ScriptWord[]>([]);
  useEffect(() => {
    const next = scriptBody ? tokenizeScript(scriptBody) : [];
    tokensRef.current = next;
    setTokens(next);
  }, [scriptBody]);

  // One-shot support probe.
  const supportedRef = useRef<boolean | null>(null);
  if (supportedRef.current === null) {
    try {
      supportedRef.current = new BrowserSpeechProvider().isSupported();
    } catch {
      supportedRef.current = false;
    }
  }
  const supported = supportedRef.current ?? false;

  // Refs shared between the speech callbacks and the lerp loop.
  const providerRef = useRef<BrowserSpeechProvider | null>(null);
  const spokenRef = useRef<string[]>([]);
  const cursorRef = useRef<number>(0);
  const targetOffsetRef = useRef<number>(0);
  const lastMatchAtRef = useRef<number>(0);
  const followRafRef = useRef<number | null>(null);
  const readingLineRef = useRef<number>(readingLine);
  const smoothingRef = useRef<number>(smoothing);
  readingLineRef.current = readingLine;
  smoothingRef.current = smoothing;

  const reset = () => {
    setOffset(0);
    setCursor(0);
    cursorRef.current = 0;
    spokenRef.current = [];
    targetOffsetRef.current = 0;
  };

  // Reset cursor when script changes.
  useEffect(() => {
    reset();
  }, [scriptBody]);

  useEffect(() => {
    if (!enabled || !scriptBody) {
      providerRef.current?.stop();
      providerRef.current = null;
      if (followRafRef.current) cancelAnimationFrame(followRafRef.current);
      followRafRef.current = null;
      setStatus("idle");
      voiceFollowDebug.status("idle");
      return;
    }
    if (!supported) {
      setStatus("error");
      voiceFollowDebug.status("error");
      onUnavailable?.("Web Speech API is not available in this runtime.");
      onForceDisable?.();
      return;
    }

    const provider = new BrowserSpeechProvider();
    providerRef.current = provider;
    setStatus("listening");
    voiceFollowDebug.reset();
    voiceFollowDebug.status("listening");
    spokenRef.current = [];
    cursorRef.current = 0;
    setCursor(0);

    let cancelled = false;

    const handlers = {
      onResult: (r: { text: string; isFinal: boolean; resultIndex?: number; rawTranscript?: string }) => {
        if (cancelled) return;
        const toks = tokenizeSpoken(r.text);
        const suppressed = providerRef.current?.getDuplicateSuppressedCount?.() ?? 0;
        if (!toks.length) {
          voiceFollowDebug.speech({
            rawTranscript: r.rawTranscript ?? r.text,
            emittedDelta: r.text,
            normalized: "",
            newTokens: 0,
            resultIndex: r.resultIndex ?? -1,
            buffer: spokenRef.current,
            isFinal: r.isFinal,
            duplicateSuppressedCount: suppressed,
          });
          return;
        }
        const merged = [...spokenRef.current, ...toks].slice(-24);
        spokenRef.current = merged;
        voiceFollowDebug.speech({
          rawTranscript: r.rawTranscript ?? r.text,
          emittedDelta: r.text,
          normalized: toks.join(" "),
          newTokens: toks.length,
          resultIndex: r.resultIndex ?? -1,
          buffer: merged,
          isFinal: r.isFinal,
          duplicateSuppressedCount: suppressed,
        });
        const script = tokensRef.current;
        if (!script.length) return;
        const windowStart = Math.max(0, cursorRef.current);
        const lookahead = 24;
        const windowEnd = Math.min(script.length, windowStart + lookahead);
        const recent = merged.slice(-5);
        const res = alignWindow(script, merged, cursorRef.current, {
          windowSize: 5,
          lookahead,
          minAligned: 3,
          maxGaps: 1,
        });
        voiceFollowDebug.alignment({
          scriptTokenCount: script.length,
          cursorIndex: cursorRef.current,
          windowStart,
          windowEnd,
          recent,
          matched: res.matched,
          alignedCount: res.alignedCount,
          alignedScriptIndex: res.scriptIndex,
        });
        if (!res.matched || res.scriptIndex < 0) {
          // Engine is hearing tokens but can't align — flag as low-confidence,
          // but DO NOT move the cursor. This is the "never jump randomly" rule.
          if (performance.now() - lastMatchAtRef.current > 1200) {
            setStatus("low-confidence");
            voiceFollowDebug.status("low-confidence");
          }
          return;
        }
        if (res.scriptIndex < cursorRef.current - 1) return;
        cursorRef.current = res.scriptIndex;
        setCursor(res.scriptIndex);
        lastMatchAtRef.current = performance.now();
        setStatus("following");
        voiceFollowDebug.status("following");
        const text = textRef.current;
        const stage = stageRef.current;
        if (!text || !stage) return;
        const el = text.querySelector<HTMLElement>(`[data-i="${res.scriptIndex}"]`);
        if (!el) return;
        const readingLineY = stage.clientHeight * readingLineRef.current;
        targetOffsetRef.current = Math.max(0, el.offsetTop - readingLineY);
      },
      onError: (e: { code: string; message: string }) => {
        if (cancelled) return;
        if (e.code === "not-allowed" || e.code === "service-not-allowed" || e.code === "permission") {
          setStatus("error");
          voiceFollowDebug.status("error");
          onUnavailable?.("Microphone permission denied for Voice Follow.");
          onForceDisable?.();
        } else if (e.code === "unsupported") {
          setStatus("error");
          voiceFollowDebug.status("error");
          onUnavailable?.("Voice Follow needs Web Speech API.");
          onForceDisable?.();
        }
        // "no-speech" / "aborted" / "network" are routine — onEnd will restart.
      },
      onEnd: () => {
        if (cancelled) return;
        // Browser STT auto-stops on long silence. Restart while still opted-in.
        if (providerRef.current === provider) {
          provider.start(handlers).catch(() => {
            // Silent fallback; next user toggle will retry cleanly.
            setStatus("error");
            voiceFollowDebug.status("error");
          });
        }
      },
    };

    provider.start(handlers).catch(() => {
      if (cancelled) return;
      setStatus("error");
      voiceFollowDebug.status("error");
      onForceDisable?.();
    });

    const lerp = () => {
      setOffset((cur) => {
        const target = targetOffsetRef.current;
        const delta = target - cur;
        if (Math.abs(delta) < 0.5) return cur;
        return cur + delta * smoothingRef.current;
      });
      // Idle indicator: drop back to "listening" after 1.5s of no match.
      const since = performance.now() - lastMatchAtRef.current;
      if (since > 1500) {
        setStatus((s) => {
          if (s === "following") {
            voiceFollowDebug.status("listening");
            return "listening";
          }
          return s;
        });
      }
      followRafRef.current = requestAnimationFrame(lerp);
    };
    lastMatchAtRef.current = performance.now();
    followRafRef.current = requestAnimationFrame(lerp);

    return () => {
      cancelled = true;
      provider.stop();
      if (providerRef.current === provider) providerRef.current = null;
      if (followRafRef.current) cancelAnimationFrame(followRafRef.current);
      followRafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, scriptBody, supported]);

  return { status, offset, reset, cursor, tokens, supported };
}
