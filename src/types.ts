export type ProviderKey = "ollama" | "gemini" | "g4f";

export type RequestMode = "chat" | "coding" | "research";

export type PolicyKey = "private_first" | "cheap_first" | "lab_mode";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  mode?: RequestMode;
  policy?: PolicyKey;
  modelHint?: string;
  messages: ChatMessage[];
  metadata?: Record<string, unknown>;
}

export interface ChatResponse {
  provider: ProviderKey;
  model: string;
  content: string;
  requestId: string;
  fallbackChain: ProviderKey[];
}

export interface ProviderHealth {
  provider: ProviderKey;
  healthy: boolean;
  configured: boolean;
  reason?: string;
}

export interface ProviderAdapter {
  key: ProviderKey;
  displayName: string;
  isConfigured(): boolean;
  healthcheck(): Promise<ProviderHealth>;
  chat(request: ChatRequest): Promise<ChatResponse>;
}

