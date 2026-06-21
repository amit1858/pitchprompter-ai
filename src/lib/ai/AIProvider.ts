import type { AIProviderId, AISettings, RewriteMode } from "@/types";

export interface RewriteRequest {
  text: string;
  mode: RewriteMode;
}

export interface AIProvider {
  readonly id: AIProviderId;
  readonly displayName: string;
  rewrite(req: RewriteRequest, settings: AISettings): Promise<string>;
}

export const REWRITE_PROMPTS: Record<RewriteMode, string> = {
  clearer:
    "Rewrite the following speaking script to be clearer, more concrete, and easier to follow when spoken aloud. Keep the speaker's voice. Return only the rewritten script, no commentary.",
  warmer:
    "Rewrite the following speaking script to sound warmer, more human, and conversational, while keeping the original meaning. Return only the rewritten script.",
  shorter:
    "Rewrite the following speaking script to be roughly 30% shorter while preserving the key points. Keep it natural to speak. Return only the rewritten script.",
  executive:
    "Rewrite the following speaking script in a confident executive tone: lead with the headline, use strong nouns and verbs, cut hedging. Return only the rewritten script.",
  "bullets-to-script":
    "Convert the following bullet points or notes into a smooth spoken script suitable for reading on camera. Use complete sentences, natural transitions, and a confident tone. Do not invent new facts. Return only the rewritten script.",
  "to-30s":
    "Rewrite the following speaking script to be deliverable in about 30 seconds when spoken at ~140 words per minute (~70 words total). Keep only the single most important point. Return only the rewritten script.",
  "to-60s":
    "Rewrite the following speaking script to be deliverable in about 60 seconds when spoken at ~140 words per minute (~140 words total). Preserve the strongest 2–3 points. Return only the rewritten script.",
  "to-90s":
    "Rewrite the following speaking script to be deliverable in about 90 seconds when spoken at ~140 words per minute (~210 words total). Keep a clear arc: hook, substance, close. Return only the rewritten script.",
  "strong-opening":
    "Rewrite the following speaking script so that the FIRST 1–2 sentences are a strong, attention-grabbing opening (a hook, surprising stat, vivid image, or sharp question). Keep the rest of the script intact but smooth the transition. Return only the rewritten script.",
  "strong-closing":
    "Rewrite the following speaking script so that the LAST 2–3 sentences are a strong, memorable closing with a clear call to action or a crisp final thought. Keep the rest intact. Return only the rewritten script.",
  "natural-on-camera":
    "Rewrite the following speaking script so it sounds natural when read aloud on camera: short sentences, contractions, conversational rhythm, no jargon dumps. Avoid sounding like marketing copy. Return only the rewritten script.",
};
