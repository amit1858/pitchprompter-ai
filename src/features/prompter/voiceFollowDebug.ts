// TEMPORARY debug bus for Voice Follow root-cause work.
// Remove this file (and its imports) once the alignment regression is fixed.
//
// Lives outside of any React state so it can be written from inside
// non-React callbacks (speech recognition events, alignment helpers, the
// rAF lerp loop) without re-rendering anything until a subscriber reads it.

import { useSyncExternalStore } from "react";

export interface VoiceFollowDebugSnapshot {
  // Speech recognition
  lastTranscript: string;          // exact .text from provider
  normalizedTranscript: string;    // joined tokenizeSpoken(...) output
  newTokensThisEvent: number;      // tokens added by THIS event
  bufferTokens: string[];          // current 24-word ring buffer
  bufferTokenCount: number;        // bufferTokens.length
  speechEventCount: number;        // total onResult invocations since start
  lastIsFinal: boolean;
  speechAt: number;                // performance.now() of last speech event

  // Alignment
  scriptTokenCount: number;
  cursorIndex: number;             // cursorRef before alignment
  windowStart: number;             // fromIndex passed in
  windowEnd: number;               // fromIndex + lookahead capped to script.length
  recentWindow: string[];          // the .slice(-windowSize) actually compared
  matched: boolean;
  alignedCount: number;
  alignedScriptIndex: number;      // result.scriptIndex
  alignAt: number;                 // performance.now() of last alignment attempt
  alignAttemptCount: number;       // total alignWindow calls
  alignMatchCount: number;         // total matched=true results

  // State
  status: string;                  // current VoiceFollowStatus
  statusTransitions: string[];     // last 8 transitions, e.g. "listening->following"
}

const EMPTY: VoiceFollowDebugSnapshot = {
  lastTranscript: "",
  normalizedTranscript: "",
  newTokensThisEvent: 0,
  bufferTokens: [],
  bufferTokenCount: 0,
  speechEventCount: 0,
  lastIsFinal: false,
  speechAt: 0,
  scriptTokenCount: 0,
  cursorIndex: 0,
  windowStart: 0,
  windowEnd: 0,
  recentWindow: [],
  matched: false,
  alignedCount: 0,
  alignedScriptIndex: -1,
  alignAt: 0,
  alignAttemptCount: 0,
  alignMatchCount: 0,
  status: "idle",
  statusTransitions: [],
};

let snapshot: VoiceFollowDebugSnapshot = EMPTY;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function update(patch: Partial<VoiceFollowDebugSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  emit();
  // Mirror to console for native devtools / Tauri webview inspection.
  // Keep the payload small.
  // eslint-disable-next-line no-console
  console.debug("[vf-debug]", patch);
}

export const voiceFollowDebug = {
  reset() {
    snapshot = EMPTY;
    emit();
  },
  speech(input: {
    text: string;
    normalized: string;
    newTokens: number;
    buffer: string[];
    isFinal: boolean;
  }) {
    update({
      lastTranscript: input.text,
      normalizedTranscript: input.normalized,
      newTokensThisEvent: input.newTokens,
      bufferTokens: input.buffer,
      bufferTokenCount: input.buffer.length,
      speechEventCount: snapshot.speechEventCount + 1,
      lastIsFinal: input.isFinal,
      speechAt: performance.now(),
    });
  },
  alignment(input: {
    scriptTokenCount: number;
    cursorIndex: number;
    windowStart: number;
    windowEnd: number;
    recent: string[];
    matched: boolean;
    alignedCount: number;
    alignedScriptIndex: number;
  }) {
    update({
      scriptTokenCount: input.scriptTokenCount,
      cursorIndex: input.cursorIndex,
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
      recentWindow: input.recent,
      matched: input.matched,
      alignedCount: input.alignedCount,
      alignedScriptIndex: input.alignedScriptIndex,
      alignAt: performance.now(),
      alignAttemptCount: snapshot.alignAttemptCount + 1,
      alignMatchCount: snapshot.alignMatchCount + (input.matched ? 1 : 0),
    });
  },
  status(next: string) {
    if (next === snapshot.status) return;
    const transition = `${snapshot.status}->${next}`;
    update({
      status: next,
      statusTransitions: [...snapshot.statusTransitions, transition].slice(-8),
    });
  },
  get(): VoiceFollowDebugSnapshot {
    return snapshot;
  },
};

export function useVoiceFollowDebug(): VoiceFollowDebugSnapshot {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => snapshot,
    () => snapshot,
  );
}

/** Returns true if `?vfdebug=1` is on the URL (or localStorage flag set). */
export function isVoiceFollowDebugEnabled(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const url = new URL(window.location.href);
    if (url.searchParams.get("vfdebug") === "1") return true;
    return localStorage.getItem("pp.vfdebug") === "1";
  } catch {
    return false;
  }
}
