import express from "express";
import { z } from "zod";
import { config } from "./config";
import { routeChat } from "./gateway";
import { routingPolicies } from "./policy";
import { providers } from "./providers";
import { ChatRequest } from "./types";

const app = express();

app.use(express.json({ limit: "2mb" }));

const chatRequestSchema = z.object({
  mode: z.enum(["chat", "coding", "research"]).optional(),
  policy: z.enum(["private_first", "cheap_first", "lab_mode"]).optional(),
  modelHint: z.string().min(1).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string().min(1)
      })
    )
    .min(1),
  metadata: z.record(z.string(), z.unknown()).optional()
});

app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  (req as express.Request & { requestId?: string }).requestId = requestId;
  res.locals.requestId = requestId;
  const startedAt = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - startedAt;
    console.log(
      JSON.stringify({
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: duration
      })
    );
  });

  next();
});

app.use("/v1", (req, res, next) => {
  const providedKey = req.header("x-internal-api-key");

  if (!providedKey || providedKey !== config.INTERNAL_API_KEY) {
    res.status(401).json({
      error: "Unauthorized",
      requestId: res.locals.requestId
    });
    return;
  }

  next();
});

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
  const parsed = chatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid chat request",
      details: parsed.error.flatten(),
      requestId: res.locals.requestId
    });
    return;
  }

  const request = parsed.data as ChatRequest;

  try {
    const response = await routeChat(request);
    res.json({
      ...response,
      requestId: res.locals.requestId
    });
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "Unknown gateway error",
      requestId: res.locals.requestId
    });
  }
});

app.listen(config.PORT, () => {
  console.log(`Koyeb0 AI Gateway listening on port ${config.PORT}`);
});
