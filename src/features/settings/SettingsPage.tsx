import { useEffect, useState } from "react";
import { aiSettingsRepo, safetyRepo, wipeAllData, type SafetySettings } from "@/lib/storage/repos";
import type { AIProviderId, AISettings } from "@/types";
import { AI_PROVIDER_OPTIONS } from "@/lib/ai";
import { toast } from "@/components/Toast";
import { applyCaptureExclusion, isCaptureExclusionSupported, isTauri } from "@/lib/privacy/captureExclusion";

type ExclusionLabel = "available" | "experimental" | "unavailable" | "checking";

export function SettingsPage() {
  const [settings, setSettings] = useState<AISettings>(() => aiSettingsRepo.get());
  const [safety, setSafety] = useState<SafetySettings>(() => safetyRepo.get());
  const [showKey, setShowKey] = useState(false);
  const [exclusionLabel, setExclusionLabel] = useState<ExclusionLabel>("checking");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isTauri()) {
        if (!cancelled) setExclusionLabel("unavailable");
        return;
      }
      const ok = await isCaptureExclusionSupported();
      if (cancelled) return;
      setExclusionLabel(ok ? "experimental" : "unavailable");
    })();
    return () => { cancelled = true; };
  }, []);

  function save() {
    aiSettingsRepo.set(settings);
    toast("Settings saved locally.");
  }

  function clearKey() {
    const cleared: AISettings = { ...settings, apiKey: "" };
    setSettings(cleared);
    aiSettingsRepo.set(cleared);
    toast("API key cleared.");
  }

  function wipe() {
    if (!confirm("This deletes all scripts, sessions, and AI settings on this device. Continue?")) return;
    wipeAllData();
    setSettings(aiSettingsRepo.get());
    setSafety(safetyRepo.get());
    toast("All local data wiped. Reload the app to start fresh.");
  }

  function setSafetyPatch(patch: Partial<SafetySettings>) {
    const next = safetyRepo.set(patch);
    setSafety(next);
  }

  async function toggleCaptureExclusion(enabled: boolean) {
    setSafetyPatch({ captureExclusionEnabled: enabled });
    // Apply immediately on this (main) window so the user can feel the effect
    // when sharing in Teams/Zoom. Camera Lock window picks it up on next open.
    if (!isTauri()) return;
    const res = await applyCaptureExclusion(enabled);
    if (res.kind === "applied") {
      toast(enabled ? "Capture exclusion ON (experimental)." : "Capture exclusion OFF.");
    } else {
      toast("Capture exclusion unavailable: " + res.reason);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <div className="sub">Bring your own AI key. Everything stays on this device.</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 15 }}>AI provider (BYOK)</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          PitchPrompter never sends your scripts anywhere unless you click an AI action. Your API key is stored in
          this device's local storage only.
        </p>
        <div className="col" style={{ gap: 12 }}>
          <label className="field">
            Provider
            <select
              value={settings.provider}
              onChange={(e) => setSettings({ ...settings, provider: e.target.value as AIProviderId })}
            >
              {AI_PROVIDER_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id} disabled={!opt.supported}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {settings.provider !== "none" && (
            <>
              <label className="field">
                Model
                <input
                  value={settings.model}
                  onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                  placeholder="e.g. gpt-4o-mini"
                />
              </label>
              <label className="field">
                Base URL (optional, for OpenAI-compatible endpoints)
                <input
                  value={settings.baseUrl ?? ""}
                  onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
                  placeholder="https://api.openai.com"
                />
              </label>
              <label className="field">
                API key
                <div className="row">
                  <input
                    type={showKey ? "text" : "password"}
                    value={settings.apiKey}
                    onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                    placeholder="sk-…"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button className="ghost" onClick={() => setShowKey((v) => !v)}>
                    {showKey ? "Hide" : "Show"}
                  </button>
                  <button className="ghost" onClick={clearKey} disabled={!settings.apiKey}>
                    Clear
                  </button>
                </div>
              </label>
            </>
          )}

          <div className="toolbar">
            <button className="primary" onClick={save}>Save</button>
            <span className="muted" style={{ fontSize: 12 }}>
              Last updated:{" "}
              {settings.lastUpdatedAt ? new Date(settings.lastUpdatedAt).toLocaleString() : "never"}
            </span>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 15 }}>Screen share safety</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          The teleprompter window is meant for you, not your audience. These options reduce the risk that it
          appears in a Teams / Zoom / Meet share.
        </p>
        <ul style={{ marginTop: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li><strong>Safe:</strong> in Teams/Zoom/Meet, share a <em>specific application window</em> (Chrome, PowerPoint, etc.).</li>
          <li><strong>Risky:</strong> sharing your <em>entire screen / desktop</em> will reveal anything on top of it, including the teleprompter.</li>
        </ul>
        <div className="col" style={{ gap: 10, marginTop: 12 }}>
          <label className="row" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={safety.guidanceEnabled}
              onChange={(e) => setSafetyPatch({ guidanceEnabled: e.target.checked })}
            />
            <span>Show safety banner in Camera Lock window</span>
            <span className={`pill pill-ok`}>Screen share safe guidance enabled</span>
          </label>
          <label className="row" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={safety.captureExclusionEnabled}
              disabled={exclusionLabel === "unavailable" || exclusionLabel === "checking"}
              onChange={(e) => toggleCaptureExclusion(e.target.checked)}
            />
            <span>Try to hide PitchPrompter windows from screen capture (Windows only)</span>
            {exclusionLabel === "experimental" && (
              <span className="pill pill-warn">Capture exclusion experimental</span>
            )}
            {exclusionLabel === "unavailable" && (
              <span className="pill pill-muted">Capture exclusion unavailable</span>
            )}
            {exclusionLabel === "checking" && (
              <span className="pill pill-muted">Checking…</span>
            )}
          </label>
          <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>
            Uses Windows <code>SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)</code>. Honored by most modern
            capture APIs (Teams/Zoom/Meet window or screen share, OBS Window Capture via Windows Graphics Capture).
            <strong> Not guaranteed.</strong> Older GDI/BitBlt capture tools or hardware capture cards can still see
            the window. Always combine with sharing a specific app window rather than the full desktop.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 15 }}>Privacy</h2>
        <ul style={{ marginTop: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>Scripts, practice sessions, and AI settings are stored only on this device.</li>
          <li>No account, no telemetry, no analytics SDKs.</li>
          <li>
            Microphone audio is processed by the system speech engine for live transcription only. Raw audio is not
            recorded or uploaded.
          </li>
          <li>
            AI rewrites only happen when you explicitly click a rewrite button. The script text is sent directly from
            your device to your configured provider with your own API key.
          </li>
          <li>A clear indicator appears whenever any network call to an AI provider is in flight.</li>
        </ul>
      </div>

      <div className="card" style={{ borderColor: "var(--danger)" }}>
        <h2 style={{ marginTop: 0, fontSize: 15 }}>Danger zone</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Wipe all local data: scripts, practice sessions, and AI settings.
        </p>
        <button className="danger" onClick={wipe}>Wipe all local data</button>
      </div>
    </>
  );
}
