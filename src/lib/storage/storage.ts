// Thin storage abstraction over localStorage so we can swap for Tauri fs later
// without changing call sites. All persistence is local; nothing leaves the device.

const PREFIX = "pp.";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

function remove(key: string): void {
  window.localStorage.removeItem(PREFIX + key);
}

export const storage = { read, write, remove };

export function newId(prefix = "id"): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}
