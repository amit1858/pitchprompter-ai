export interface Script {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

export interface PracticeSession {
  id: string;
  scriptId: string | null;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
  wordCount: number;
  wordsPerMinute: number;
  fillerWordCount: number;
  longPauseCount: number;
  confidenceScore: number;
  transcript: string;
  notes?: string;
}

export type AIProviderId = "openai" | "azure-openai" | "anthropic" | "none";

export interface AISettings {
  provider: AIProviderId;
  apiKey: string;
  model: string;
  baseUrl?: string;
  lastUpdatedAt: number;
}

export type RewriteMode =
  | "clearer"
  | "warmer"
  | "shorter"
  | "executive"
  | "bullets-to-script"
  | "to-30s"
  | "to-60s"
  | "to-90s"
  | "strong-opening"
  | "strong-closing"
  | "natural-on-camera";
