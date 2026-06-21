import { useEffect, useMemo, useRef, useState } from "react";
import { scriptsRepo, sessionsRepo } from "@/lib/storage/repos";
import type { PracticeSession, Script } from "@/types";
import { getDefaultSpeechProvider } from "@/lib/speech";
import type { SpeechProvider } from "@/lib/speech";
import { analyze } from "@/lib/privacy/analytics";
import { PrivacyBadge } from "@/components/PrivacyBadge";
import { toast } from "@/components/Toast";

type Phase = "idle" | "recording" | "summary";

interface Summary {
  durationSeconds: number;
  wordCount: number;
  wordsPerMinute: number;
  fillerWordCount: number;
  longPauseCount: number;
  confidenceScore: number;
  fillerBreakdown: Record<string, number>;
}

export function PracticePage() {
  const [scripts] = useState<Script[]>(() => scriptsRepo.list());
  const [scriptId, setScriptId] = useState<string | null>(scripts[0]?.id ?? null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const providerRef = useRef<SpeechProvider | null>(null);
  const startedAtRef = useRef<number>(0);
  const endedAtRef = useRef<number>(0);
  const lastFinalAtRef = useRef<number>(0);
  const pauseEventsRef = useRef<number[]>([]);
  const timerRef = useRef<number | null>(null);
  // Refs avoid stale closures inside long-lived speech callbacks.
  const phaseRef = useRef<Phase>("idle");
  const handlersRef = useRef<{
    onResult: (r: { text: string; isFinal: boolean; timestamp: number }) => void;
    onError: (e: { code: string; message: string }) => void;
    onEnd: () => void;
  } | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const provider = useMemo(() => {
    const p = getDefaultSpeechProvider();
    providerRef.current = p;
    return p;
  }, []);

  const supported = provider.isSupported();

  useEffect(() => {
    return () => {
      providerRef.current?.stop();
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  async function start() {
    setError(null);
    setFinalText("");
    setInterim("");
    setSummary(null);
    pauseEventsRef.current = [];
    startedAtRef.current = Date.now();
    lastFinalAtRef.current = Date.now();
    setElapsed(0);
    setPhase("recording");
    phaseRef.current = "recording";

    timerRef.current = window.setInterval(() => {
      setElapsed(Math.round((Date.now() - startedAtRef.current) / 1000));
    }, 500);

    // Stable handlers stored in a ref so we can re-attach them on auto-restart
    // without capturing stale state via closure.
    handlersRef.current = {
      onResult: (r) => {
        if (r.isFinal) {
          const gap = r.timestamp - lastFinalAtRef.current;
          if (gap > 0) pauseEventsRef.current.push(gap);
          lastFinalAtRef.current = r.timestamp;
          setFinalText((prev) => (prev ? prev + " " : "") + r.text.trim());
          setInterim("");
        } else {
          setInterim(r.text);
        }
      },
      onError: (e) => {
        setError(`${e.code}: ${e.message}`);
        if (e.code === "permission" || e.code === "unsupported" || e.code === "not_implemented") {
          stop(true);
        }
      },
      onEnd: () => {
        // Browser STT auto-ends after silence; restart if the user hasn't stopped.
        if (phaseRef.current === "recording" && handlersRef.current) {
          providerRef.current
            ?.start({ lang: "en-US", ...handlersRef.current })
            .catch(() => undefined);
        }
      },
    };

    await provider.start({ lang: "en-US", ...handlersRef.current });
  }

  function stop(skipSave = false) {
    phaseRef.current = skipSave ? "idle" : "summary";
    providerRef.current?.stop();
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    endedAtRef.current = Date.now();

    if (skipSave) {
      setPhase("idle");
      return;
    }
    setPhase("summary");

    const transcript = finalText + (interim ? " " + interim : "");
    const res = analyze({
      transcript,
      startedAt: startedAtRef.current,
      endedAt: endedAtRef.current,
      pauseEventsMs: pauseEventsRef.current,
    });
    const session: PracticeSession = {
      id: "ps_" + Date.now().toString(36),
      scriptId,
      startedAt: startedAtRef.current,
      endedAt: endedAtRef.current,
      durationSeconds: res.durationSeconds,
      wordCount: res.wordCount,
      wordsPerMinute: res.wordsPerMinute,
      fillerWordCount: res.fillerWordCount,
      longPauseCount: res.longPauseCount,
      confidenceScore: res.confidenceScore,
      transcript,
    };
    sessionsRepo.add(session);
    setSummary({ ...res });
    toast("Practice session saved locally.");
  }

  function reset() {
    phaseRef.current = "idle";
    setPhase("idle");
    setSummary(null);
    setFinalText("");
    setInterim("");
    setElapsed(0);
    setError(null);
  }

  const wpmTone = (wpm: number) =>
    wpm === 0 ? "bad" : wpm < 110 || wpm > 170 ? "warn" : "ok";
  const fillerTone = (count: number, words: number) =>
    words === 0 ? "" : count / words > 0.06 ? "bad" : count / words > 0.03 ? "warn" : "ok";
  const confTone = (c: number) => (c >= 80 ? "ok" : c >= 60 ? "warn" : "bad");

  const liveWords = (finalText + " " + interim).trim().split(/\s+/).filter(Boolean).length;
  const liveWpm = elapsed > 0 ? Math.round((liveWords / elapsed) * 60) : 0;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Practice</h1>
          <div className="sub">Rehearse with your microphone. Audio is processed locally by your browser engine.</div>
        </div>
        <PrivacyBadge active={false} />
      </div>

      {!supported && (
        <div className="card" style={{ borderColor: "var(--warn)", marginBottom: 16 }}>
          <strong>Speech recognition is not available in this runtime.</strong>
          <p className="muted" style={{ marginTop: 6 }}>
            The Web Speech API is required for live transcription. In the Tauri desktop build, native WebView support
            for Web Speech is platform-dependent. Run the app in a Chromium-based browser via{" "}
            <span className="kbd">npm run dev</span>, or wait for the local Whisper provider (planned).
          </p>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="toolbar">
          <label className="field" style={{ flex: 1 }}>
            Script (optional reference)
            <select
              value={scriptId ?? ""}
              onChange={(e) => setScriptId(e.target.value || null)}
              disabled={phase === "recording"}
            >
              <option value="">— None —</option>
              {scripts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
          <div style={{ alignSelf: "flex-end" }}>
            {phase !== "recording" ? (
              <button className="primary" disabled={!supported} onClick={start}>
                Start practice
              </button>
            ) : (
              <button className="danger" onClick={() => stop(false)}>
                Stop & analyze
              </button>
            )}
            {phase === "summary" && (
              <button onClick={reset} style={{ marginLeft: 8 }}>
                New session
              </button>
            )}
          </div>
        </div>
        {error && (
          <div className="muted" style={{ color: "var(--danger)", marginTop: 10 }}>
            Error: {error}
          </div>
        )}
      </div>

      {phase === "recording" && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="row">
            <div className="metric" style={{ flex: 1 }}>
              <div className="label">Elapsed</div>
              <div className="value">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</div>
            </div>
            <div className="metric" style={{ flex: 1 }}>
              <div className="label">Live WPM</div>
              <div className="value">{liveWpm}</div>
            </div>
            <div className="metric" style={{ flex: 1 }}>
              <div className="label">Words</div>
              <div className="value">{liveWords}</div>
            </div>
          </div>
          <h3 style={{ marginTop: 16, marginBottom: 8, fontSize: 13, color: "var(--text-dim)" }}>Live transcript</h3>
          <div className="transcript">
            {finalText} <span className="interim">{interim}</span>
          </div>
        </div>
      )}

      {phase === "summary" && summary && (
        <>
          <h2 style={{ fontSize: 16, margin: "8px 0 12px" }}>Practice summary</h2>
          <div className="metrics">
            <div className="metric">
              <div className="label">Duration</div>
              <div className="value">
                {Math.floor(summary.durationSeconds / 60)}m {summary.durationSeconds % 60}s
              </div>
            </div>
            <div className="metric">
              <div className="label">Words</div>
              <div className="value">{summary.wordCount}</div>
            </div>
            <div className="metric">
              <div className="label">Words / minute</div>
              <div className={`value ${wpmTone(summary.wordsPerMinute)}`}>{summary.wordsPerMinute}</div>
            </div>
            <div className="metric">
              <div className="label">Filler words</div>
              <div className={`value ${fillerTone(summary.fillerWordCount, summary.wordCount)}`}>
                {summary.fillerWordCount}
              </div>
            </div>
            <div className="metric">
              <div className="label">Long pauses (&gt;1.5s)</div>
              <div className="value">{summary.longPauseCount}</div>
            </div>
            <div className="metric">
              <div className="label">Confidence score</div>
              <div className={`value ${confTone(summary.confidenceScore)}`}>{summary.confidenceScore}</div>
            </div>
          </div>

          {Object.keys(summary.fillerBreakdown).length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <h3 style={{ marginTop: 0, fontSize: 13, color: "var(--text-dim)" }}>Filler breakdown</h3>
              <div className="toolbar">
                {Object.entries(summary.fillerBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <span className="tag" key={k}>
                      {k} × {v}
                    </span>
                  ))}
              </div>
            </div>
          )}

          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0, fontSize: 13, color: "var(--text-dim)" }}>Transcript (local-only)</h3>
            <div className="transcript">{finalText || <span className="muted">No transcript captured.</span>}</div>
          </div>
        </>
      )}
    </>
  );
}
