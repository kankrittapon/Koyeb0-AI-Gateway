import { config } from "../config";
import { ChatRequest, ChatResponse, ProviderAdapter, ProviderHealth } from "../types";

function buildPrompt(messages: ChatRequest["messages"]): string {
  return messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");
}

export class OllamaProvider implements ProviderAdapter {
  key = "ollama" as const;
  displayName = "Local Ollama";

  isConfigured(): boolean {
    return Boolean(config.OLLAMA_BASE_URL && config.OLLAMA_MODEL);
  }

  async healthcheck(): Promise<ProviderHealth> {
    if (!this.isConfigured()) {
      return { provider: this.key, healthy: false, configured: false, reason: "Missing Ollama configuration." };
    }

    try {
      const response = await fetch(`${config.OLLAMA_BASE_URL}/api/tags`);
      return {
        provider: this.key,
        healthy: response.ok,
        configured: true,
        reason: response.ok ? undefined : `HTTP ${response.status}`
      };
    } catch (error) {
      return {
        provider: this.key,
        healthy: false,
        configured: true,
        reason: error instanceof Error ? error.message : "Unknown Ollama error"
      };
    }
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const prompt = buildPrompt(request.messages);

    try {
      const response = await fetch(`${config.OLLAMA_BASE_URL}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: request.modelHint || config.OLLAMA_MODEL,
          prompt,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama returned HTTP ${response.status}`);
      }

      const data = (await response.json()) as { response?: string; model?: string };

      return {
        provider: this.key,
        model: data.model || request.modelHint || config.OLLAMA_MODEL,
        content: data.response || "",
        requestId: crypto.randomUUID(),
        fallbackChain: []
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Unknown Ollama chat error");
    }
  }
}

