import type { AISettings } from "@/types";
import { AIProvider, REWRITE_PROMPTS, RewriteRequest } from "./AIProvider";

// OpenAI-compatible Chat Completions provider. Works with api.openai.com and
// any drop-in compatible endpoint (e.g. local proxies that accept the same shape).
export class OpenAIProvider implements AIProvider {
  readonly id = "openai" as const;
  readonly displayName = "OpenAI (BYOK)";

  async rewrite(req: RewriteRequest, settings: AISettings): Promise<string> {
    if (!settings.apiKey) throw new Error("Missing API key. Add one in Settings.");
    const url =
      (settings.baseUrl?.replace(/\/+$/, "") || "https://api.openai.com") + "/v1/chat/completions";
    const body = {
      model: settings.model || "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        { role: "system", content: REWRITE_PROMPTS[req.mode] },
        { role: "user", content: req.text },
      ],
    };
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`AI request failed (${res.status}): ${txt.slice(0, 200)}`);
    }
    const data: any = await res.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI response was empty.");
    return content.trim();
  }
}
