import express from "express";
import { config } from "./config";
import { GatewayRoutingError, routeChat } from "./gateway";
import { getRecentRequests, persistSafely, recordAiRequest, recordProviderAttempts, recordProviderHealth } from "./db";
import { listModels } from "./models";
import { routingPolicies } from "./policy";
import { providers } from "./providers";
import { chatRequestSchema, openAiChatSchema } from "./schemas";
import { ChatRequest } from "./types";

const app = express();

app.use(express.json({ limit: "2mb" }));

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
  await persistSafely("provider health", () => recordProviderHealth(providerHealth));

  res.status(healthy ? 200 : 503).json({
    service: "koyeb0-ai-gateway",
    healthy,
    providers: providerHealth
  });
});

app.get("/v1/providers", async (_req, res) => {
  const providerHealth = await Promise.all(Object.values(providers).map((provider) => provider.healthcheck()));
  await persistSafely("provider health", () => recordProviderHealth(providerHealth));
  res.json(providerHealth);
});

app.get("/v1/policies", (_req, res) => {
  res.json(routingPolicies);
});

app.get("/v1/models", (_req, res) => {
  res.json({
    object: "list",
    data: listModels()
  });
});

app.get("/v1/debug/requests", async (_req, res) => {
  const rows = await getRecentRequests();
  res.json({
    data: rows,
    requestId: res.locals.requestId
  });
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
    await persistSafely("ai request", () => recordAiRequest({
      requestId: res.locals.requestId,
      sourceService: request.sourceService || "unknown",
      sourceUserId: request.sourceUserId,
      requestMode: request.mode || "chat",
      policyKey: request.policy || "private_first",
      modelHint: request.modelHint,
      promptPreview: config.LOG_PROMPT_PREVIEW ? request.messages.map((message) => message.content).join("\n").slice(0, 1000) : undefined,
      status: "succeeded",
      provider: response.provider
    }));
    await persistSafely("provider attempts", () => recordProviderAttempts(res.locals.requestId, response.attempts || []));
    res.json({
      ...response,
      requestId: res.locals.requestId
    });
  } catch (error) {
    const attempts = error instanceof GatewayRoutingError ? error.attempts : [];
    await persistSafely("ai request", () => recordAiRequest({
      requestId: res.locals.requestId,
      sourceService: request.sourceService || "unknown",
      sourceUserId: request.sourceUserId,
      requestMode: request.mode || "chat",
      policyKey: request.policy || "private_first",
      modelHint: request.modelHint,
      promptPreview: config.LOG_PROMPT_PREVIEW ? request.messages.map((message) => message.content).join("\n").slice(0, 1000) : undefined,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown gateway error"
    }));
    await persistSafely("provider attempts", () => recordProviderAttempts(res.locals.requestId, attempts));
    res.status(502).json({
      error: error instanceof Error ? error.message : "Unknown gateway error",
      requestId: res.locals.requestId
    });
  }
});

app.post("/v1/chat/completions", async (req, res) => {
  const parsed = openAiChatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid OpenAI-compatible request",
      details: parsed.error.flatten(),
      requestId: res.locals.requestId
    });
    return;
  }

  const openAiRequest = parsed.data;
  const request: ChatRequest = {
    modelHint: openAiRequest.model,
    messages: openAiRequest.messages,
    metadata: openAiRequest.metadata,
    sourceService: "openai-compatible",
    sourceUserId: openAiRequest.user
  };

  try {
    const response = await routeChat(request);
    await persistSafely("ai request", () => recordAiRequest({
      requestId: res.locals.requestId,
      sourceService: "openai-compatible",
      sourceUserId: openAiRequest.user,
      requestMode: "chat",
      policyKey: request.policy || "private_first",
      modelHint: request.modelHint,
      promptPreview: config.LOG_PROMPT_PREVIEW ? request.messages.map((message) => message.content).join("\n").slice(0, 1000) : undefined,
      status: "succeeded",
      provider: response.provider
    }));
    await persistSafely("provider attempts", () => recordProviderAttempts(res.locals.requestId, response.attempts || []));

    res.json({
      id: res.locals.requestId,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: response.model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: response.content
          },
          finish_reason: "stop"
        }
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      },
      provider: response.provider,
      attempts: response.attempts || []
    });
  } catch (error) {
    const attempts = error instanceof GatewayRoutingError ? error.attempts : [];
    await persistSafely("ai request", () => recordAiRequest({
      requestId: res.locals.requestId,
      sourceService: "openai-compatible",
      sourceUserId: openAiRequest.user,
      requestMode: "chat",
      policyKey: "private_first",
      modelHint: request.modelHint,
      promptPreview: config.LOG_PROMPT_PREVIEW ? request.messages.map((message) => message.content).join("\n").slice(0, 1000) : undefined,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown gateway error"
    }));
    await persistSafely("provider attempts", () => recordProviderAttempts(res.locals.requestId, attempts));

    res.status(502).json({
      error: {
        message: error instanceof Error ? error.message : "Unknown gateway error",
        type: "gateway_error"
      }
    });
  }
});

app.listen(config.PORT, () => {
  console.log(`Koyeb0 AI Gateway listening on port ${config.PORT}`);
});
