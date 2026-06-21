import type { AIProvider } from "./AIProvider";
import { OpenAIProvider } from "./OpenAIProvider";
import type { AIProviderId } from "@/types";

export type { AIProvider, RewriteRequest } from "./AIProvider";
export { REWRITE_PROMPTS } from "./AIProvider";

export function getAIProvider(id: AIProviderId): AIProvider | null {
  switch (id) {
    case "openai":
      return new OpenAIProvider();
    // azure-openai / anthropic: documented future extension points
    default:
      return null;
  }
}

export const AI_PROVIDER_OPTIONS: { id: AIProviderId; label: string; supported: boolean }[] = [
  { id: "none", label: "Disabled (no AI calls)", supported: true },
  { id: "openai", label: "OpenAI / OpenAI-compatible", supported: true },
  { id: "azure-openai", label: "Azure OpenAI (coming soon)", supported: false },
  { id: "anthropic", label: "Anthropic (coming soon)", supported: false },
];
