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

    const contents = request.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }]
      }));

    const systemMessage = request.messages.find((message) => message.role === "system")?.content;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        request.modelHint || config.GEMINI_MODEL
      )}:generateContent?key=${encodeURIComponent(config.GEMINI_API_KEY)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: systemMessage ? { parts: [{ text: systemMessage }] } : undefined,
          contents
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini returned HTTP ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const content =
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("") ?? "";

    if (!content) {
      throw new Error("Gemini returned an empty response.");
    }

    return {
      provider: this.key,
      model: request.modelHint || config.GEMINI_MODEL,
      content,
      requestId: crypto.randomUUID(),
      fallbackChain: []
    };
  }
}
