import { G4FProvider } from "./g4fProvider";
import { GeminiProvider } from "./geminiProvider";
import { OllamaProvider } from "./ollamaProvider";

export const providers = {
  ollama: new OllamaProvider(),
  gemini: new GeminiProvider(),
  g4f: new G4FProvider()
};

