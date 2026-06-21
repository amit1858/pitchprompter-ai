// Local-only speech analytics. No data leaves the device.

const DEFAULT_FILLERS = [
  "um", "uh", "uhm", "erm", "er", "ah", "like", "you know",
  "i mean", "basically", "literally", "actually", "so", "right",
  "kind of", "kinda", "sort of", "sorta",
];

export interface PauseEvent {
  // ms gap between two consecutive final-result timestamps
  gapMs: number;
  at: number;
}

export interface AnalyticsInput {
  transcript: string;
  startedAt: number;
  endedAt: number;
  pauseEventsMs?: number[]; // gaps observed between final results
  longPauseThresholdMs?: number;
  fillerWords?: string[];
}

export interface AnalyticsResult {
  durationSeconds: number;
  wordCount: number;
  wordsPerMinute: number;
  fillerWordCount: number;
  fillerBreakdown: Record<string, number>;
  longPauseCount: number;
  confidenceScore: number; // 0..100
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function analyze(input: AnalyticsInput): AnalyticsResult {
  const fillers = (input.fillerWords ?? DEFAULT_FILLERS).map((f) => f.toLowerCase());
  const threshold = input.longPauseThresholdMs ?? 1500;

  const durationSeconds = Math.max(0, Math.round((input.endedAt - input.startedAt) / 1000));
  const words = tokenize(input.transcript);
  const wordCount = words.length;
  const wpm = durationSeconds > 0 ? Math.round((wordCount / durationSeconds) * 60) : 0;

  const lowerText = " " + words.join(" ") + " ";
  const breakdown: Record<string, number> = {};
  let fillerCount = 0;
  for (const f of fillers) {
    const needle = " " + f + " ";
    let idx = 0;
    let count = 0;
    while ((idx = lowerText.indexOf(needle, idx)) !== -1) {
      count++;
      idx += needle.length - 1;
    }
    if (count > 0) {
      breakdown[f] = count;
      fillerCount += count;
    }
  }

  const longPauseCount = (input.pauseEventsMs ?? []).filter((ms) => ms >= threshold).length;

  // Confidence: 100 baseline, penalize fillers, off-target WPM, and many long pauses.
  const fillerRate = wordCount > 0 ? fillerCount / wordCount : 0;
  const wpmPenalty =
    wpm === 0 ? 30 : wpm < 110 ? Math.min(25, (110 - wpm) * 0.5) : wpm > 170 ? Math.min(25, (wpm - 170) * 0.5) : 0;
  const fillerPenalty = Math.min(40, fillerRate * 400); // 10% fillers -> -40
  const pausePenalty = Math.min(20, longPauseCount * 4);
  const confidenceScore = Math.max(0, Math.round(100 - wpmPenalty - fillerPenalty - pausePenalty));

  return {
    durationSeconds,
    wordCount,
    wordsPerMinute: wpm,
    fillerWordCount: fillerCount,
    fillerBreakdown: breakdown,
    longPauseCount,
    confidenceScore,
  };
}
