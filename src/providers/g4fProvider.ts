import { config } from "../config";
import { ChatRequest, ChatResponse, ProviderAdapter, ProviderHealth } from "../types";

export class G4FProvider implements ProviderAdapter {
  key = "g4f" as const;
  displayName = "Experimental g4f";

  isConfigured(): boolean {
    return config.ENABLE_G4F && Boolean(config.G4F_BASE_URL && config.G4F_MODEL);
  }

  async healthcheck(): Promise<ProviderHealth> {
    return {
      provider: this.key,
      healthy: this.isConfigured(),
      configured: this.isConfigured(),
      reason: this.isConfigured() ? undefined : "g4f is disabled or incomplete."
    };
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (!this.isConfigured()) {
      throw new Error("g4f is not configured.");
    }

    const response = await fetch(`${config.G4F_BASE_URL.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer none"
      },
      body: JSON.stringify({
        model: request.modelHint || config.G4F_MODEL || "g4f",
        messages: request.messages
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`g4f returned HTTP ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };

    const content = data.choices?.[0]?.message?.content || "";
    if (!content) {
      throw new Error("g4f returned an empty response.");
    }

    return {
      provider: this.key,
      model: data.model || request.modelHint || config.G4F_MODEL || "g4f",
      content,
      requestId: crypto.randomUUID(),
      fallbackChain: []
    };
  }
}
