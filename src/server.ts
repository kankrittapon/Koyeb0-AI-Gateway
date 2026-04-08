import express from "express";
import { config } from "./config";
import { routeChat } from "./gateway";
import { routingPolicies } from "./policy";
import { providers } from "./providers";
import { ChatRequest } from "./types";

const app = express();

app.use(express.json({ limit: "2mb" }));

app.get("/", (_req, res) => {
  res.json({
    service: "koyeb0-ai-gateway",
    status: "ok",
    environment: config.NODE_ENV
  });
});

app.get("/health", async (_req, res) => {
  const providerHealth = await Promise.all(Object.values(providers).map((provider) => provider.healthcheck()));
  const healthy = providerHealth.some((provider) => provider.healthy);

  res.status(healthy ? 200 : 503).json({
    service: "koyeb0-ai-gateway",
    healthy,
    providers: providerHealth
  });
});

app.get("/v1/providers", async (_req, res) => {
  const providerHealth = await Promise.all(Object.values(providers).map((provider) => provider.healthcheck()));
  res.json(providerHealth);
});

app.get("/v1/policies", (_req, res) => {
  res.json(routingPolicies);
});

app.post("/v1/chat", async (req, res) => {
  const request = req.body as ChatRequest;

  if (!Array.isArray(request.messages) || request.messages.length === 0) {
    res.status(400).json({ error: "messages is required" });
    return;
  }

  try {
    const response = await routeChat(request);
    res.json(response);
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "Unknown gateway error"
    });
  }
});

app.listen(config.PORT, () => {
  console.log(`Koyeb0 AI Gateway listening on port ${config.PORT}`);
});
