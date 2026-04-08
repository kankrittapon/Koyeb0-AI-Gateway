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

    return {
      provider: this.key,
      model: request.modelHint || config.G4F_MODEL || "g4f",
      content: `[stub] Experimental g4f response placeholder for mode ${request.mode || "chat"}`,
      requestId: crypto.randomUUID(),
      fallbackChain: []
    };
  }
}

