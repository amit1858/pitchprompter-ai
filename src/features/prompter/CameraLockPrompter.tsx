import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { scriptsRepo, safetyRepo } from "@/lib/storage/repos";
import type { Script } from "@/types";
import { applyCaptureExclusion, type CaptureExclusionStatus } from "@/lib/privacy/captureExclusion";

// Camera Lock Mode: a borderless, always-on-top reading surface designed to sit
// directly next to a laptop webcam. No app navigation, no recursion.

interface Prefs {
  fontSize: number;
  speed: number; // px/sec
  lineHeight: number;
  contentWidth: number; // %
  opacity: number; // 0..1, applies to background only
  transparent: boolean;
  highContrast: boolean;
}

const STORAGE_KEY = "pp.cameraLock.prefs";

const DEFAULT_PREFS: Prefs = {
  fontSize: 38,
  speed: 50,
  lineHeight: 1.35,
  contentWidth: 92,
  opacity: 0.85,
  transparent: false,
  highContrast: false,
};

function loadPrefs(): Prefs {
  try {
    return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Partial<Prefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function CameraLockPrompter({ scriptId }: { scriptId: string | null }) {
  const [scripts] = useState<Script[]>(() => scriptsRepo.list());
  const [activeId, setActiveId] = useState<string | null>(scriptId ?? scripts[0]?.id ?? null);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [running, setRunning] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hovering, setHovering] = useState(true);
  const [safety] = useState(() => safetyRepo.get());
  const [safetyBannerDismissed, setSafetyBannerDismissed] = useState(false);
  const [exclusionStatus, setExclusionStatus] = useState<CaptureExclusionStatus | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  const idleTimerRef = useRef<number | null>(null);

  // Apply capture exclusion as soon as the window mounts if the user opted in.
  // We do NOT auto-disable on unmount; window-close tears it down with the HWND.
  useEffect(() => {
    if (!safety.captureExclusionEnabled) return;
    let cancelled = false;
    applyCaptureExclusion(true).then((s) => { if (!cancelled) setExclusionStatus(s); });
    return () => { cancelled = true; };
  }, [safety.captureExclusionEnabled]);

  const script = useMemo(() => scripts.find((s) => s.id === activeId) ?? null, [scripts, activeId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  // Apply transparent background to <html>/<body> when transparent mode is on.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    if (prefs.transparent) {
      html.style.background = "transparent";
      body.style.background = "transparent";
    } else {
      html.style.background = "";
      body.style.background = "";
    }
  }, [prefs.transparent]);

  useEffect(() => {
    setOffset(0);
    setRunning(false);
  }, [activeId]);

  // Scroll engine — pixels-per-second is the dt-stable unit.
  useEffect(() => {
    if (!running) {
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
          const max = Math.max(0, text.scrollHeight - stage.clientHeight * 0.4);
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
  }, [running, prefs.speed]);

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
        setPrefs((p) => ({ ...p, fontSize: Math.min(120, p.fontSize + 2) }));
      } else if (e.key === "-" || e.key === "_") {
        setPrefs((p) => ({ ...p, fontSize: Math.max(14, p.fontSize - 2) }));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focus mode (Phase 2): auto-hide chrome after 3s idle, reappear on mouse move.
  const bumpIdle = useCallback(() => {
    setHovering(true);
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => setHovering(false), 3000);
  }, []);
  useEffect(() => {
    bumpIdle();
    window.addEventListener("mousemove", bumpIdle);
    return () => {
      window.removeEventListener("mousemove", bumpIdle);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, [bumpIdle]);

  const bgAlpha = prefs.transparent ? 0 : prefs.opacity;
  const bg = prefs.highContrast
    ? `rgba(0, 0, 0, ${bgAlpha})`
    : `rgba(8, 10, 14, ${bgAlpha})`;
  const fg = prefs.highContrast ? "#ffffff" : "#f4f6fb";

  return (
    <div
      className={`camlock ${hovering ? "show-chrome" : ""}`}
      style={{ background: bg, color: fg }}
    >
      {/* Top draggable strip (Tauri drag region) */}
      <div className="camlock-drag" data-tauri-drag-region>
        <span className="camlock-title">
          {script ? script.title : "PitchPrompter"} {running ? "· playing" : "· paused"}
        </span>
        <button
          className="ghost camlock-close"
          title="Close camera lock window"
          onClick={async () => {
            try {
              const w = await import("@tauri-apps/api/window");
              await w.getCurrent().close();
            } catch {
              window.close();
            }
          }}
        >
          ×
        </button>
      </div>

      <div className="camlock-stage" ref={stageRef}>
        {safety.guidanceEnabled && !safetyBannerDismissed && (
          <div className="camlock-safety-banner" role="note">
            <span>
              🛡 For privacy, share only the presentation/window in Teams/Zoom/Meet — not your full desktop.
              {exclusionStatus?.kind === "applied" && exclusionStatus.excluded && (
                <em style={{ marginLeft: 6, opacity: 0.85 }}>Capture exclusion is active (experimental).</em>
              )}
              {exclusionStatus?.kind === "unavailable" && (
                <em style={{ marginLeft: 6, opacity: 0.85 }}>Capture exclusion unavailable: {exclusionStatus.reason}</em>
              )}
            </span>
            <button
              className="ghost sm"
              onClick={() => setSafetyBannerDismissed(true)}
              title="Dismiss for this session"
              aria-label="Dismiss safety banner"
            >×</button>
          </div>
        )}
        <div className="camlock-caret" />
        <div
          ref={textRef}
          className="camlock-text"
          style={{
            fontSize: prefs.fontSize,
            lineHeight: prefs.lineHeight,
            transform: `translateY(${-offset}px)`,
            maxWidth: `${prefs.contentWidth}%`,
          }}
        >
          {script?.body || "No script selected. Open Scripts in the main window."}
        </div>
      </div>

      {/* Bottom controls — hidden in focus mode */}
      <div className="camlock-controls">
        <button className="primary sm" onClick={() => setRunning((r) => !r)}>
          {running ? "Pause" : "Start"}
        </button>
        <button className="sm" onClick={() => { setOffset(0); setRunning(false); }}>Reset</button>
        <select
          className="sm"
          value={activeId ?? ""}
          onChange={(e) => setActiveId(e.target.value || null)}
          title="Script"
        >
          {scripts.map((s) => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>
        <span className="camlock-spacer" />
        <label className="camlock-mini" title="Font size">
          A
          <input
            type="range" min={14} max={120} value={prefs.fontSize}
            onChange={(e) => setPrefs((p) => ({ ...p, fontSize: Number(e.target.value) }))}
          />
        </label>
        <label className="camlock-mini" title="Scroll speed (px/s)">
          ⏩
          <input
            type="range" min={10} max={300} value={prefs.speed}
            onChange={(e) => setPrefs((p) => ({ ...p, speed: Number(e.target.value) }))}
          />
        </label>
        <label className="camlock-mini" title="Background opacity">
          ◐
          <input
            type="range" min={0} max={100} value={Math.round(prefs.opacity * 100)}
            disabled={prefs.transparent}
            onChange={(e) => setPrefs((p) => ({ ...p, opacity: Number(e.target.value) / 100 }))}
          />
        </label>
        <button
          className={`sm ${prefs.transparent ? "primary" : ""}`}
          title="Transparent background"
          onClick={() => setPrefs((p) => ({ ...p, transparent: !p.transparent }))}
        >
          ▢
        </button>
        <button
          className={`sm ${prefs.highContrast ? "primary" : ""}`}
          title="High contrast"
          onClick={() => setPrefs((p) => ({ ...p, highContrast: !p.highContrast }))}
        >
          ◑
        </button>
      </div>
    </div>
  );
}
