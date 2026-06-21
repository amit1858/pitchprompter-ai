import { useCallback, useEffect, useMemo, useState } from "react";
import { scriptsRepo } from "@/lib/storage/repos";
import type { Script } from "@/types";
import { ScriptEditor } from "./ScriptEditor";
import { toast } from "@/components/Toast";

interface Props {
  onOpenInPrompter: (scriptId: string) => void;
}

export function ScriptsPage({ onOpenInPrompter }: Props) {
  const [scripts, setScripts] = useState<Script[]>(() => scriptsRepo.list());
  const [selectedId, setSelectedId] = useState<string | null>(scripts[0]?.id ?? null);

  const refresh = useCallback((keepId?: string | null) => {
    const all = scriptsRepo.list();
    setScripts(all);
    if (keepId !== undefined) setSelectedId(keepId);
    else if (!all.find((s) => s.id === selectedId)) setSelectedId(all[0]?.id ?? null);
  }, [selectedId]);

  useEffect(() => {
    // Seed with a starter script the first time the app is opened.
    if (scriptsRepo.list().length === 0) {
      scriptsRepo.create({
        title: "Welcome to PitchPrompter AI",
        body:
          "Welcome to PitchPrompter AI.\n\n" +
          "Use this editor to draft and refine your script. When you're ready, open the Teleprompter tab to read it on camera, or jump to Practice to rehearse with live coaching.\n\n" +
          "Everything you type is stored locally on your device. Nothing leaves your machine unless you explicitly trigger an AI rewrite with your own API key.",
      });
      const all = scriptsRepo.list();
      setScripts(all);
      setSelectedId(all[0]?.id ?? null);
    }
  }, []);

  const selected = useMemo(
    () => (selectedId ? scripts.find((s) => s.id === selectedId) ?? null : null),
    [scripts, selectedId]
  );

  function createNew() {
    const s = scriptsRepo.create({ title: "Untitled script", body: "" });
    refresh(s.id);
  }

  function removeSelected() {
    if (!selected) return;
    if (!confirm(`Delete "${selected.title}"? This cannot be undone.`)) return;
    scriptsRepo.remove(selected.id);
    refresh(null);
    toast("Script deleted");
  }

  async function importFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".md,.markdown,.txt,text/plain";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const title = file.name.replace(/\.[^.]+$/, "") || "Imported script";
      const s = scriptsRepo.create({ title, body: text });
      refresh(s.id);
      toast(`Imported "${title}"`);
    };
    input.click();
  }

  function exportSelected() {
    if (!selected) return;
    const blob = new Blob([selected.body], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selected.title.replace(/[^\w\- ]+/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Scripts</h1>
          <div className="sub">Draft, refine, and save your speaking scripts. Stored locally.</div>
        </div>
        <div className="toolbar">
          <button onClick={importFile}>Import</button>
          <button onClick={exportSelected} disabled={!selected}>
            Export
          </button>
          <button className="primary" onClick={createNew}>
            New script
          </button>
        </div>
      </div>

      <div className="scripts-layout">
        <div className="scripts-list">
          {scripts.length === 0 ? (
            <div style={{ padding: 16 }} className="muted">
              No scripts yet. Click "New script" to get started.
            </div>
          ) : (
            scripts.map((s) => (
              <div
                key={s.id}
                className={`item ${s.id === selectedId ? "active" : ""}`}
                onClick={() => setSelectedId(s.id)}
              >
                <div className="title">{s.title}</div>
                <div className="meta">
                  {new Date(s.updatedAt).toLocaleString()} ·{" "}
                  {s.body.trim().split(/\s+/).filter(Boolean).length} words
                </div>
              </div>
            ))
          )}
        </div>

        {selected ? (
          <ScriptEditor
            key={selected.id}
            script={selected}
            onChange={(patch) => {
              const updated = scriptsRepo.update(selected.id, patch);
              if (updated) refresh(updated.id);
            }}
            onDelete={removeSelected}
            onOpenInPrompter={() => onOpenInPrompter(selected.id)}
          />
        ) : (
          <div className="card muted">Select a script on the left, or create a new one.</div>
        )}
      </div>
    </>
  );
}
