import { config } from "./config";

export function listModels() {
  const models = [
    {
      id: config.OLLAMA_MODEL,
      object: "model",
      provider: "ollama"
    }
  ];

  if (config.GEMINI_API_KEY) {
    models.push({
      id: config.GEMINI_MODEL,
      object: "model",
      provider: "gemini"
    });
  }

  if (config.ENABLE_G4F && config.G4F_MODEL) {
    models.push({
      id: config.G4F_MODEL,
      object: "model",
      provider: "g4f"
    });
  }

  return models;
}

