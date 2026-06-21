import { useEffect, useRef, useState } from "react";
import type { Script, RewriteMode } from "@/types";
import { aiSettingsRepo } from "@/lib/storage/repos";
import { getAIProvider } from "@/lib/ai";
import { PrivacyBadge } from "@/components/PrivacyBadge";
import { toast } from "@/components/Toast";

interface Props {
  script: Script;
  onChange: (patch: Partial<Pick<Script, "title" | "body">>) => void;
  onDelete: () => void;
  onOpenInPrompter: () => void;
}

const MODE_GROUPS: { label: string; modes: { id: RewriteMode; label: string }[] }[] = [
  {
    label: "Tone",
    modes: [
      { id: "clearer", label: "Clearer" },
      { id: "warmer", label: "Warmer" },
      { id: "executive", label: "Executive" },
      { id: "natural-on-camera", label: "Natural on camera" },
    ],
  },
  {
    label: "Length",
    modes: [
      { id: "shorter", label: "~30% shorter" },
      { id: "to-30s", label: "Tighten to 30s" },
      { id: "to-60s", label: "Tighten to 60s" },
      { id: "to-90s", label: "Tighten to 90s" },
    ],
  },
  {
    label: "Structure",
    modes: [
      { id: "bullets-to-script", label: "Bullets → spoken script" },
      { id: "strong-opening", label: "Strong opening" },
      { id: "strong-closing", label: "Strong closing" },
    ],
  },
];

const MODE_LABEL: Record<RewriteMode, string> = Object.fromEntries(
  MODE_GROUPS.flatMap((g) => g.modes.map((m) => [m.id, m.label]))
) as Record<RewriteMode, string>;

export function ScriptEditor({ script, onChange, onDelete, onOpenInPrompter }: Props) {
  const [title, setTitle] = useState(script.title);
  const [body, setBody] = useState(script.body);
  const [aiBusy, setAiBusy] = useState(false);
  const [confirming, setConfirming] = useState<RewriteMode | null>(null);
  const debounceRef = useRef<number | null>(null);
  // Latest values + dirty flag for synchronous flush on unmount / navigation.
  const latestRef = useRef({ title, body, dirty: false });
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  function flush() {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (latestRef.current.dirty) {
      onChangeRef.current({ title: latestRef.current.title, body: latestRef.current.body });
      latestRef.current.dirty = false;
    }
  }

  // Debounced autosave
  useEffect(() => {
    latestRef.current = { title, body, dirty: title !== script.title || body !== script.body };
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (latestRef.current.dirty) {
      debounceRef.current = window.setTimeout(() => {
        onChangeRef.current({ title, body });
        latestRef.current.dirty = false;
      }, 400);
    }
    // No cleanup that cancels — we want flush(), not discard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body]);

  // Final flush on unmount or before unload so no keystrokes are lost.
  useEffect(() => {
    const onBeforeUnload = () => flush();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      flush();
    };
  }, []);

  const wordCount = body.trim().split(/\s+/).filter(Boolean).length;
  const estSeconds = Math.round((wordCount / 140) * 60);

  async function runRewrite(mode: RewriteMode) {
    const settings = aiSettingsRepo.get();
    if (settings.provider === "none" || !settings.apiKey) {
      toast("Add an API key in Settings before using AI rewrite.");
      return;
    }
    const provider = getAIProvider(settings.provider);
    if (!provider) {
      toast("Selected AI provider is not available yet.");
      return;
    }
    setAiBusy(true);
    try {
      const out = await provider.rewrite({ text: body, mode }, settings);
      setBody(out);
      toast(`Rewrite applied: ${mode}`);
    } catch (e: any) {
      toast(e?.message ?? "AI rewrite failed");
    } finally {
      setAiBusy(false);
      setConfirming(null);
    }
  }

  return (
    <div className="script-editor">
      <input
        className="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Script title"
      />
      <div className="toolbar muted" style={{ fontSize: 12 }}>
        <span>{wordCount} words</span>
        <span>·</span>
        <span>~{Math.floor(estSeconds / 60)}m {estSeconds % 60}s at 140 wpm</span>
        <span className="spacer" />
        <PrivacyBadge active={aiBusy} label="Calling AI provider" tone="warn" />
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Start writing your script here…"
        spellCheck
      />
      <div className="toolbar">
        <button className="primary" onClick={() => { flush(); onOpenInPrompter(); }}>Open in teleprompter</button>
        <div className="spacer" />
        <label className="row" style={{ gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
          AI rewrite:
          <select
            disabled={aiBusy}
            value=""
            onChange={(e) => {
              const v = e.target.value as RewriteMode | "";
              if (v) setConfirming(v);
              e.currentTarget.value = "";
            }}
            title="Choose an AI rewrite action. You'll be asked to confirm before any network call."
          >
            <option value="">Choose action…</option>
            {MODE_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.modes.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <button className="danger" onClick={onDelete}>Delete</button>
      </div>

      {confirming && (
        <div className="card" style={{ borderColor: "var(--warn)" }}>
          <div className="row">
            <PrivacyBadge active label="Network call required" tone="warn" />
            <div className="spacer" />
          </div>
          <p style={{ marginTop: 10 }}>
            This will send your script text to <strong>{aiSettingsRepo.get().provider}</strong> using the API key
            stored locally on your device. Action: <strong>{MODE_LABEL[confirming]}</strong>.
          </p>
          <div className="toolbar">
            <button className="primary" onClick={() => runRewrite(confirming)} disabled={aiBusy}>
              {aiBusy ? "Working…" : "Send to AI provider"}
            </button>
            <button onClick={() => setConfirming(null)} disabled={aiBusy}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
