import type { Script, PracticeSession, AISettings } from "@/types";
import { storage, newId } from "./storage";

const KEY_SCRIPTS = "scripts";
const KEY_SESSIONS = "practice_sessions";
const KEY_AI = "ai_settings";
const KEY_SAFETY = "safety_settings";

export const scriptsRepo = {
  list(): Script[] {
    return storage
      .read<Script[]>(KEY_SCRIPTS, [])
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
  get(id: string): Script | undefined {
    return scriptsRepo.list().find((s) => s.id === id);
  },
  create(partial: Partial<Pick<Script, "title" | "body">> = {}): Script {
    const now = Date.now();
    const script: Script = {
      id: newId("scr"),
      title: partial.title?.trim() || "Untitled script",
      body: partial.body ?? "",
      createdAt: now,
      updatedAt: now,
    };
    const all = scriptsRepo.list();
    all.unshift(script);
    storage.write(KEY_SCRIPTS, all);
    return script;
  },
  update(id: string, patch: Partial<Pick<Script, "title" | "body">>): Script | undefined {
    const all = scriptsRepo.list();
    const i = all.findIndex((s) => s.id === id);
    if (i === -1) return undefined;
    const updated: Script = {
      ...all[i],
      ...patch,
      title: patch.title?.trim() || all[i].title,
      updatedAt: Date.now(),
    };
    all[i] = updated;
    storage.write(KEY_SCRIPTS, all);
    return updated;
  },
  remove(id: string): void {
    storage.write(KEY_SCRIPTS, scriptsRepo.list().filter((s) => s.id !== id));
  },
};

export const sessionsRepo = {
  list(): PracticeSession[] {
    return storage
      .read<PracticeSession[]>(KEY_SESSIONS, [])
      .sort((a, b) => b.startedAt - a.startedAt);
  },
  add(s: PracticeSession): void {
    const all = sessionsRepo.list();
    all.unshift(s);
    storage.write(KEY_SESSIONS, all.slice(0, 100));
  },
  clear(): void {
    storage.remove(KEY_SESSIONS);
  },
};

const DEFAULT_AI: AISettings = {
  provider: "none",
  apiKey: "",
  model: "gpt-4o-mini",
  lastUpdatedAt: 0,
};

export const aiSettingsRepo = {
  get(): AISettings {
    return storage.read<AISettings>(KEY_AI, DEFAULT_AI);
  },
  set(s: AISettings): void {
    storage.write(KEY_AI, { ...s, lastUpdatedAt: Date.now() });
  },
  clear(): void {
    storage.remove(KEY_AI);
  },
};

export function wipeAllData(): void {
  storage.remove(KEY_SCRIPTS);
  storage.remove(KEY_SESSIONS);
  storage.remove(KEY_AI);
  storage.remove(KEY_SAFETY);
}

export interface SafetySettings {
  // Show in-app safe-sharing guidance + banner in Camera Lock.
  guidanceEnabled: boolean;
  // Experimental: ask the OS to exclude prompter windows from screen capture.
  // Best-effort; not a security boundary.
  captureExclusionEnabled: boolean;
}

const DEFAULT_SAFETY: SafetySettings = {
  guidanceEnabled: true,
  captureExclusionEnabled: false,
};

export const safetyRepo = {
  get(): SafetySettings {
    return { ...DEFAULT_SAFETY, ...storage.read<Partial<SafetySettings>>(KEY_SAFETY, {}) };
  },
  set(patch: Partial<SafetySettings>): SafetySettings {
    const next = { ...safetyRepo.get(), ...patch };
    storage.write(KEY_SAFETY, next);
    return next;
  },
};
