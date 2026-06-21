import { useEffect, useState } from "react";
import { ScriptsPage } from "@/features/scripts/ScriptsPage";
import { TeleprompterPage } from "@/features/prompter/TeleprompterPage";
import { CameraLockPrompter } from "@/features/prompter/CameraLockPrompter";
import { PracticePage } from "@/features/practice/PracticePage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { ToastHost } from "@/components/Toast";

type Tab = "scripts" | "prompter" | "practice" | "settings";
type WindowMode = "main" | "camera";

const NAV: { id: Tab; label: string; hint: string }[] = [
  { id: "scripts", label: "Scripts", hint: "Draft & manage" },
  { id: "prompter", label: "Teleprompter", hint: "Read on camera" },
  { id: "practice", label: "Practice", hint: "Rehearse & coach" },
  { id: "settings", label: "Settings", hint: "AI key & privacy" },
];

function detectWindowMode(): { mode: WindowMode; scriptId: string | null } {
  const params = new URLSearchParams(window.location.search);
  if (params.get("camera") === "1") {
    return { mode: "camera", scriptId: params.get("scriptId") || null };
  }
  return { mode: "main", scriptId: null };
}

export default function App() {
  const [tab, setTab] = useState<Tab>("scripts");
  const [prompterScriptId, setPrompterScriptId] = useState<string | null>(null);
  const [win] = useState(detectWindowMode);

  useEffect(() => {
    document.title = win.mode === "camera" ? "PitchPrompter — Camera Lock" : "PitchPrompter AI";
  }, [win.mode]);

  // Camera Lock: a dedicated borderless reading window. No app nav.
  if (win.mode === "camera") {
    return (
      <>
        <CameraLockPrompter scriptId={win.scriptId} />
        <ToastHost />
      </>
    );
  }

  function openInPrompter(scriptId: string) {
    setPrompterScriptId(scriptId);
    setTab("prompter");
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          PitchPrompter<span className="dot"> AI</span>
        </div>
        {NAV.map((n) => (
          <div
            key={n.id}
            className={`navitem ${tab === n.id ? "active" : ""}`}
            onClick={() => setTab(n.id)}
          >
            <div style={{ flex: 1 }}>
              <div>{n.label}</div>
              <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{n.hint}</div>
            </div>
          </div>
        ))}
        <div className="footer">
          Local-first. v0.1.0
          <br />
          Press <span className="kbd">Space</span> in Teleprompter to start/pause.
        </div>
      </aside>
      <main className="main">
        {tab === "scripts" && <ScriptsPage onOpenInPrompter={openInPrompter} />}
        {tab === "prompter" && <TeleprompterPage initialScriptId={prompterScriptId} />}
        {tab === "practice" && <PracticePage />}
        {tab === "settings" && <SettingsPage />}
      </main>
      <ToastHost />
    </div>
  );
}
