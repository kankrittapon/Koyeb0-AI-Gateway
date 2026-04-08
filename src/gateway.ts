import { routingPolicies } from "./policy";
import { providers } from "./providers";
import { ChatRequest, ChatResponse, PolicyKey, ProviderAttempt, ProviderKey } from "./types";

function resolvePolicy(request: ChatRequest): PolicyKey {
  return request.policy || "private_first";
}

export async function routeChat(request: ChatRequest): Promise<ChatResponse> {
  const policy = resolvePolicy(request);
  const chain = routingPolicies[policy];
  const attempted: ProviderKey[] = [];
  const attempts: ProviderAttempt[] = [];
  const errors: string[] = [];

  for (const providerKey of chain) {
    const provider = providers[providerKey];
    attempted.push(providerKey);

    if (!provider.isConfigured()) {
      errors.push(`${providerKey}: not configured`);
      attempts.push({
        provider: providerKey,
        success: false,
        latencyMs: 0,
        error: "not configured"
      });
      continue;
    }

    const startedAt = Date.now();
    try {
      const response = await provider.chat(request);
      attempts.push({
        provider: providerKey,
        success: true,
        latencyMs: Date.now() - startedAt
      });
      return {
        ...response,
        fallbackChain: attempted,
        attempts
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      attempts.push({
        provider: providerKey,
        success: false,
        latencyMs: Date.now() - startedAt,
        error: message
      });
      errors.push(`${providerKey}: ${message}`);
    }
  }

  throw new Error(`All providers failed. ${errors.join(" | ")}`);
}
