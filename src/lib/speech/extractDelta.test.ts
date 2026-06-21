// Deterministic test for BrowserSpeechProvider.extractDelta.
// Pure function: no browser, no DOM. Runs under `npx tsx`.
//
// Usage: npx tsx src/lib/speech/extractDelta.test.ts
// Exit code 0 = all pass, 1 = any failure.

import { extractDelta } from "./BrowserSpeechProvider";
import { tokenizeScript, tokenizeSpoken, alignWindow } from "../../features/prompter/voiceAlign";

let failures = 0;
function expect(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`);
  }
}

console.log("extractDelta: happy path (accumulating interim)");
expect("first interim returns full text", extractDelta("", "welcome"), "welcome");
expect("growth by one word emits only delta", extractDelta("welcome", "welcome to"), "to");
expect("growth by one word (long prefix)", extractDelta("welcome to", "welcome to pitchprompter"), "pitchprompter");
expect("growth by one word (full phrase)", extractDelta("welcome to pitchprompter", "welcome to pitchprompter ai"), "ai");

console.log("\nextractDelta: edge cases");
expect("identical input returns null (suppressed)", extractDelta("welcome", "welcome"), null);
expect("empty current returns null", extractDelta("welcome", ""), null);
expect("whitespace-only current returns null", extractDelta("welcome", "   "), null);
expect("trims leading whitespace from suffix", extractDelta("welcome", "welcome  to"), "to");

console.log("\nextractDelta: fallback when prefix mismatches");
expect(
  "mid-segment correction (no startsWith match) returns full",
  extractDelta("welcome to pitch", "pitchprompter ai"),
  "pitchprompter ai",
);
expect(
  "empty previous returns current whole",
  extractDelta("", "today i will show"),
  "today i will show",
);

console.log("\nIntegration: simulated Web Speech stream → tokens → alignment");
const script = tokenizeScript(
  "Welcome to PitchPrompter AI. Today I will show you how Camera Lock keeps you camera facing during interviews and demos."
);

// Simulate accumulating interim stream, segment 0 + segment 1.
type Ev = { i: number; full: string; isFinal: boolean };
const stream: Ev[] = [
  { i: 0, full: "welcome", isFinal: false },
  { i: 0, full: "welcome to", isFinal: false },
  { i: 0, full: "welcome to pitchprompter", isFinal: false },
  { i: 0, full: "welcome to pitchprompter ai", isFinal: false },
  { i: 0, full: "welcome to pitchprompter ai", isFinal: true },
  { i: 1, full: "today i will", isFinal: false },
  { i: 1, full: "today i will show", isFinal: false },
  { i: 1, full: "today i will show you how", isFinal: false },
  { i: 1, full: "today i will show you how", isFinal: true },
];

const seen = new Map<number, string>();
const buffer: string[] = [];
let suppressed = 0;
let cursor = 0;
let matches = 0;
const transitions: string[] = [];
let status: "listening" | "following" = "listening";

for (const ev of stream) {
  const prev = seen.get(ev.i) ?? "";
  const delta = extractDelta(prev, ev.full);
  if (delta === null) {
    suppressed++;
    seen.set(ev.i, ev.full);
    if (ev.isFinal) seen.delete(ev.i);
    continue;
  }
  seen.set(ev.i, ev.full);
  if (ev.isFinal) seen.delete(ev.i);

  const toks = tokenizeSpoken(delta);
  buffer.push(...toks);
  while (buffer.length > 24) buffer.shift();
  const res = alignWindow(script, buffer, cursor, {
    windowSize: 5, lookahead: 24, minAligned: 3, maxGaps: 1,
  });
  if (res.matched) {
    matches++;
    cursor = res.scriptIndex;
    if (status !== "following") { transitions.push("listening->following"); status = "following"; }
  }
  console.log(
    `  i=${ev.i} final=${String(ev.isFinal).padEnd(5)} delta=${JSON.stringify(delta).padEnd(28)} buffer=[${buffer.join(" ")}] matched=${res.matched} aligned=${res.alignedCount} idx=${res.scriptIndex} cursor=${cursor}`
  );
}

console.log("\nIntegration summary:");
console.log("  buffer (final):", buffer.join(" "));
console.log("  total events:", stream.length, "suppressed:", suppressed, "matches:", matches);
console.log("  final cursor:", cursor, "/ scriptTokens:", script.length);
console.log("  transitions:", transitions.join(" · ") || "(none)");

// Assertions about the integration behavior:
expect("integration: at least one alignment match", matches > 0, true);
expect("integration: cursor advanced past 'ai' (idx 3)", cursor >= 3, true);
expect("integration: cursor reached 'how' (idx 9)", cursor >= 9, true);
expect("integration: status transitioned listening->following", transitions.includes("listening->following"), true);

// Crucially: no duplicate prefixes in buffer.
const dupCount = buffer.filter((w, i) => i > 0 && w === buffer[i - 1]).length;
expect("integration: buffer contains no immediate duplicate prefixes", dupCount, 0);

console.log("\n" + (failures === 0 ? "✅ ALL PASS" : `❌ ${failures} FAILED`));
process.exit(failures === 0 ? 0 : 1);
