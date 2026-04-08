import { PolicyKey, ProviderKey } from "./types";

export const routingPolicies: Record<PolicyKey, ProviderKey[]> = {
  private_first: ["ollama", "gemini"],
  cheap_first: ["gemini", "ollama"],
  lab_mode: ["ollama", "g4f", "gemini"]
};

