// Voice Follow alignment engine. Pure functions; no I/O, no storage.
// All processing local — operates on already-tokenized script vs. spoken-word stream.

export interface ScriptWord {
  i: number;      // index into the word array
  raw: string;    // original token (kept for rendering / debugging)
  norm: string;   // normalized lowercase token used for matching
}

const STRIP = /[^\p{L}\p{N}']+/gu;

export function normalizeToken(w: string): string {
  return w.toLowerCase().replace(STRIP, "");
}

// Split text into word tokens, preserving order, dropping empty results.
export function tokenizeScript(text: string): ScriptWord[] {
  const words: ScriptWord[] = [];
  // Split on whitespace and punctuation but keep the raw token (without
  // surrounding punctuation) for display via data attribute. The render
  // path uses the original text so we only need indices here.
  const parts = text.split(/\s+/);
  let idx = 0;
  for (const raw of parts) {
    const norm = normalizeToken(raw);
    if (!norm) continue;
    words.push({ i: idx++, raw, norm });
  }
  return words;
}

export function tokenizeSpoken(text: string): string[] {
  return text.split(/\s+/).map(normalizeToken).filter(Boolean);
}

export interface AlignResult {
  matched: boolean;
  scriptIndex: number; // index of the LAST aligned script word; -1 if no match
  alignedCount: number; // how many of the recent spoken tokens aligned
}

/**
 * Try to align the last `windowSize` spoken tokens against the script,
 * starting at `fromIndex` and looking ahead at most `lookahead` script
 * tokens. Allows skipping up to `maxGaps` script words between matches
 * to be tolerant of stutters / dropped recognition.
 *
 * Returns the index of the last aligned script word (so the caller can
 * advance the cursor to that point + 1), or -1 if no acceptable alignment.
 */
export function alignWindow(
  script: ScriptWord[],
  spoken: string[],
  fromIndex: number,
  opts: { windowSize?: number; lookahead?: number; minAligned?: number; maxGaps?: number } = {}
): AlignResult {
  const windowSize = opts.windowSize ?? 5;
  const lookahead = opts.lookahead ?? 20;
  const minAligned = opts.minAligned ?? 3;
  const maxGaps = opts.maxGaps ?? 1;

  if (spoken.length === 0 || fromIndex >= script.length) {
    return { matched: false, scriptIndex: -1, alignedCount: 0 };
  }

  const recent = spoken.slice(-windowSize);
  const start = Math.max(0, fromIndex);
  const end = Math.min(script.length, fromIndex + lookahead);

  let best: AlignResult = { matched: false, scriptIndex: -1, alignedCount: 0 };

  // Try each possible starting offset in the script lookahead window.
  for (let s = start; s < end; s++) {
    let si = s;        // cursor in script
    let aligned = 0;
    let gaps = 0;
    let lastMatch = -1;
    for (let r = 0; r < recent.length && si < end; r++) {
      const target = recent[r];
      // Try to find target at script[si], or skip up to maxGaps ahead.
      let found = -1;
      for (let k = 0; k <= maxGaps && si + k < end; k++) {
        if (script[si + k].norm === target) {
          found = si + k;
          break;
        }
      }
      if (found === -1) {
        // Allow a single spoken-word skip too (filler / misrecognition).
        gaps++;
        if (gaps > maxGaps) break;
        continue;
      }
      aligned++;
      lastMatch = found;
      si = found + 1;
    }
    if (aligned >= minAligned && aligned > best.alignedCount) {
      best = { matched: true, scriptIndex: lastMatch, alignedCount: aligned };
      // Heuristic: an alignment that consumes most of the recent window
      // is unlikely to be beaten; bail early to save work.
      if (aligned === recent.length) break;
    }
  }

  return best;
}
