import { config } from "../config";
import { ChatRequest, ChatResponse, ProviderAdapter, ProviderHealth } from "../types";

export class GeminiProvider implements ProviderAdapter {
  key = "gemini" as const;
  displayName = "Google Gemini";

  isConfigured(): boolean {
    return Boolean(config.GEMINI_API_KEY);
  }

  async healthcheck(): Promise<ProviderHealth> {
    return {
      provider: this.key,
      healthy: this.isConfigured(),
      configured: this.isConfigured(),
      reason: this.isConfigured() ? undefined : "Missing GEMINI_API_KEY"
    };
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (!this.isConfigured()) {
      throw new Error("Gemini is not configured.");
    }

    const combinedPrompt = request.messages.map((message) => message.content).join("\n\n");

    return {
      provider: this.key,
      model: request.modelHint || config.GEMINI_MODEL,
      content: `[stub] Gemini response placeholder for: ${combinedPrompt.slice(0, 240)}`,
      requestId: crypto.randomUUID(),
      fallbackChain: []
    };
  }
}

