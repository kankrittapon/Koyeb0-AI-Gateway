import { routingPolicies } from "./policy";
import { providers } from "./providers";
import { ChatRequest, ChatResponse, PolicyKey, ProviderKey } from "./types";

function resolvePolicy(request: ChatRequest): PolicyKey {
  return request.policy || "private_first";
}

export async function routeChat(request: ChatRequest): Promise<ChatResponse> {
  const policy = resolvePolicy(request);
  const chain = routingPolicies[policy];
  const attempted: ProviderKey[] = [];
  const errors: string[] = [];

  for (const providerKey of chain) {
    const provider = providers[providerKey];
    attempted.push(providerKey);

    if (!provider.isConfigured()) {
      errors.push(`${providerKey}: not configured`);
      continue;
    }

    try {
      const response = await provider.chat(request);
      return {
        ...response,
        fallbackChain: attempted
      };
    } catch (error) {
      errors.push(`${providerKey}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  throw new Error(`All providers failed. ${errors.join(" | ")}`);
}

