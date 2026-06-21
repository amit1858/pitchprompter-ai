import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { scriptsRepo } from "@/lib/storage/repos";
import type { Script } from "@/types";
import { toast } from "@/components/Toast";
import { launchCameraLock, Placement } from "./launchCameraLock";
import { useVoiceFollow } from "./useVoiceFollow";

interface Props {
  initialScriptId: string | null;
}

type ReadingLine = "center" | "camera-top";

const STORAGE_KEY = "pp.prompter.prefs";

interface Prefs {
  fontSize: number;
  speed: number;
  readingLine: ReadingLine;
  mirror: boolean;
  placement: Placement;
  lineHeight: number;
  contentWidth: number; // percent (40..100)
  highContrast: boolean;
}

const DEFAULT_PREFS: Prefs = {
  fontSize: 56,
  speed: 60,
  readingLine: "camera-top",
  mirror: false,
  placement: "top-center",
  lineHeight: 1.35,
  contentWidth: 78,
  highContrast: false,
};

// Tuned by typical 1080p reading distance; ~135 wpm pacing.
const PRESENTATION_READY: Partial<Prefs> = {
  fontSize: 62,
  speed: 130,
  lineHeight: 1.4,
  contentWidth: 78,
  readingLine: "camera-top",
  highContrast: false,
};

export function TeleprompterPage({ initialScriptId }: Props) {
  const [scripts] = useState<Script[]>(() => scriptsRepo.list());
  const [scriptId, setScriptId] = useState<string | null>(
    initialScriptId ?? scripts[0]?.id ?? null
  );
  const [prefs, setPrefs] = useState<Prefs>(() => {
    try {
      return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Partial<Prefs>) };
    } catch {
      return DEFAULT_PREFS;
    }
  });
  const [running, setRunning] = useState(false);
  const [offset, setOffset] = useState(0);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [voiceFollow, setVoiceFollow] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  const idleTimerRef = useRef<number | null>(null);

  const script = useMemo(() => scripts.find((s) => s.id === scriptId) ?? null, [scripts, scriptId]);

  const vf = useVoiceFollow({
    enabled: voiceFollow,
    scriptBody: script?.body ?? null,
    stageRef,
    textRef,
    readingLine: prefs.readingLine === "camera-top" ? 0.30 : 0.45,
    onUnavailable: (msg) => toast(msg),
    onForceDisable: () => setVoiceFollow(false),
  });
  const scriptTokens = vf.tokens;
  const voiceStatus = vf.status;
  // While Voice Follow is on, its offset wins. Otherwise the manual scroll
  // engine drives `offset` below.
  const effectiveOffset = voiceFollow ? vf.offset : offset;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  useEffect(() => {
    setOffset(0);
    setRunning(false);
  }, [scriptId]);

  // Scroll engine — disabled while Voice Follow drives the offset.
  useEffect(() => {
    if (!running || voiceFollow) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    lastTickRef.current = performance.now();
    const tick = (t: number) => {
      const dt = (t - lastTickRef.current) / 1000;
      lastTickRef.current = t;
      setOffset((o) => {
        const next = o + prefs.speed * dt;
        const stage = stageRef.current;
        const text = textRef.current;
        if (stage && text) {
          const max = text.scrollHeight - stage.clientHeight * 0.5;
          if (next >= max) {
            setRunning(false);
            return max;
          }
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [running, prefs.speed, voiceFollow]);

  // Voice Follow is implemented in the shared useVoiceFollow hook above.
  // It owns its own mic, alignment, lerp, and offset. We just consume vf.offset.

  // Focus Mode: auto-hide controls after 3 s of mouse idle; reappear on move.
  // Only auto-hides while the teleprompter is actually running.
  const bumpIdle = useCallback(() => {
    setChromeVisible(true);
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    if (running) {
      idleTimerRef.current = window.setTimeout(() => setChromeVisible(false), 3000);
    }
  }, [running]);
  useEffect(() => {
    bumpIdle();
    window.addEventListener("mousemove", bumpIdle);
    return () => {
      window.removeEventListener("mousemove", bumpIdle);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, [bumpIdle]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.code === "Space") {
        e.preventDefault();
        setRunning((r) => !r);
      } else if (e.key === "r" || e.key === "R") {
        setOffset(0);
        setRunning(false);
      } else if (e.key === "ArrowUp") {
        setPrefs((p) => ({ ...p, speed: Math.min(300, p.speed + 5) }));
      } else if (e.key === "ArrowDown") {
        setPrefs((p) => ({ ...p, speed: Math.max(10, p.speed - 5) }));
      } else if (e.key === "+" || e.key === "=") {
        setPrefs((p) => ({ ...p, fontSize: Math.min(160, p.fontSize + 4) }));
      } else if (e.key === "-" || e.key === "_") {
        setPrefs((p) => ({ ...p, fontSize: Math.max(20, p.fontSize - 4) }));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function openCameraLock(placement: Placement) {
    setPrefs((p) => ({ ...p, placement }));
    try {
      await launchCameraLock({ placement, scriptId });
      toast(`Camera Lock opened (${placement.replace("-", " ")})`);
    } catch (e: any) {
      if (e?.message === "camera_lock_requires_desktop") {
        toast("Camera Lock requires the desktop app (run `npm run tauri:dev`).");
      } else {
        toast("Could not open Camera Lock: " + (e?.message ?? "unknown error"));
      }
    }
  }

  function applyPresentationReady() {
    setPrefs((p) => ({ ...p, ...PRESENTATION_READY }));
    setOffset(0);
    setRunning(true);
  }

  const wrapClass = `prompter-wrap ${prefs.highContrast ? "hc" : ""}`;

  return (
    <>
      <div className={`page-header ${!chromeVisible ? "fade-out" : ""}`}>
        <div>
          <h1>Teleprompter</h1>
          <div className="sub">
            <span className="kbd">Space</span> play/pause · <span className="kbd">R</span> reset ·{" "}
            <span className="kbd">↑/↓</span> speed · <span className="kbd">+/-</span> size · Controls auto-hide while playing.
          </div>
        </div>
        <div className="toolbar">
          <select
            value={scriptId ?? ""}
            onChange={(e) => setScriptId(e.target.value || null)}
            style={{ width: 220 }}
          >
            {scripts.length === 0 && <option value="">No scripts</option>}
            {scripts.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
          <button
            className="primary"
            onClick={applyPresentationReady}
            disabled={!script}
            title="Apply ideal font, spacing, and speed defaults and start"
          >
            ⚡ Presentation Ready
          </button>
          <select
            value={prefs.placement}
            onChange={(e) => setPrefs((p) => ({ ...p, placement: e.target.value as Placement }))}
            title="Where the Camera Lock window will appear"
          >
            <option value="top-center">Top Center</option>
            <option value="top-left">Top Left</option>
            <option value="top-right">Top Right</option>
          </select>
          <button onClick={() => openCameraLock(prefs.placement)} disabled={!script}>
            Open Camera Lock
          </button>
        </div>
      </div>

      <div className={wrapClass}>
        <div className="prompter-stage" ref={stageRef}>
          <div
            ref={textRef}
            className="prompter-text"
            style={{
              fontSize: prefs.fontSize,
              lineHeight: prefs.lineHeight,
              maxWidth: `${prefs.contentWidth}%`,
              marginLeft: "auto",
              marginRight: "auto",
              transform: `translateY(${-effectiveOffset}px) ${prefs.mirror ? "scaleX(-1)" : ""}`,
            }}
          >
            {voiceFollow && scriptTokens.length > 0 ? (
              scriptTokens.map((t) => (
                <span key={t.i} data-i={t.i} className={t.i === vf.cursor ? "vf-current" : undefined}>
                  {t.raw}{" "}
                </span>
              ))
            ) : (
              script?.body || "Select a script above."
            )}
          </div>
        </div>
        <div className="prompter-overlay" />
        <div className="prompter-overlay bottom" />
        <div className={`prompter-caret ${prefs.readingLine === "camera-top" ? "camera-top" : ""}`} />
      </div>

      <div className={`prompter-controls ${!chromeVisible ? "fade-out" : ""}`}>
        <div className="control">
          <label>Font size: {prefs.fontSize}px</label>
          <input
            type="range" min={20} max={160} value={prefs.fontSize}
            onChange={(e) => setPrefs((p) => ({ ...p, fontSize: Number(e.target.value) }))}
          />
        </div>
        <div className="control">
          <label>Speed: {prefs.speed}px/s {voiceFollow && <em style={{ opacity: 0.6 }}>(voice driven)</em>}</label>
          <input
            type="range" min={10} max={300} value={prefs.speed}
            disabled={voiceFollow}
            onChange={(e) => setPrefs((p) => ({ ...p, speed: Number(e.target.value) }))}
          />
        </div>
        <div className="control">
          <label>Line spacing: {prefs.lineHeight.toFixed(2)}</label>
          <input
            type="range" min={100} max={200} value={Math.round(prefs.lineHeight * 100)}
            onChange={(e) => setPrefs((p) => ({ ...p, lineHeight: Number(e.target.value) / 100 }))}
          />
        </div>
        <div className="control">
          <label>Content width: {prefs.contentWidth}%</label>
          <input
            type="range" min={40} max={100} value={prefs.contentWidth}
            onChange={(e) => setPrefs((p) => ({ ...p, contentWidth: Number(e.target.value) }))}
          />
        </div>
        <div className="control">
          <label>Reading line</label>
          <select
            value={prefs.readingLine}
            onChange={(e) => setPrefs((p) => ({ ...p, readingLine: e.target.value as ReadingLine }))}
          >
            <option value="camera-top">Near camera (top)</option>
            <option value="center">Center</option>
          </select>
        </div>
        <div className="control">
          <label>Controls</label>
          <div className="toolbar" style={{ marginTop: 4 }}>
            <button className="primary" onClick={() => setRunning((r) => !r)} disabled={!script}>
              {running ? "Pause" : "Start"}
            </button>
            <button onClick={() => { setOffset(0); setRunning(false); }}>Reset</button>
            <button
              className={`ghost ${prefs.highContrast ? "active" : ""}`}
              onClick={() => setPrefs((p) => ({ ...p, highContrast: !p.highContrast }))}
              title="High contrast"
            >
              {prefs.highContrast ? "HC ✓" : "HC"}
            </button>
            <button
              className={`ghost ${voiceFollow ? "active" : ""}`}
              onClick={() => setVoiceFollow((v) => !v)}
              disabled={!script}
              title="Voice Follow: teleprompter advances as you speak. Audio stays on your device."
            >
              {voiceFollow ? "🎙 Voice ✓" : "🎙 Voice Follow"}
            </button>
            <button
              className="ghost"
              onClick={() => setPrefs((p) => ({ ...p, mirror: !p.mirror }))}
              title="Mirror text for beam-splitter rigs"
            >
              {prefs.mirror ? "Unmirror" : "Mirror"}
            </button>
          </div>
        </div>
        <div className="control">
          <label>Mode</label>
          <div className={`mode-badge mode-${voiceFollow ? "voice" : "manual"} mode-${voiceStatus}`}>
            {voiceFollow
              ? voiceStatus === "following"
                ? "● Voice Follow — following"
                : voiceStatus === "listening"
                  ? "● Voice Follow — listening…"
                  : voiceStatus === "low-confidence"
                    ? "● Voice Follow — low confidence"
                    : voiceStatus === "error"
                      ? "● Voice Follow — error"
                      : "● Voice Follow"
              : "● Manual Scroll"}
          </div>
          {voiceFollow && (
            <div className="sub" style={{ marginTop: 6 }}>
              Mic audio is processed locally by your browser engine. No upload.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
