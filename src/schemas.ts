import { z } from "zod";

export const chatRequestSchema = z.object({
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

export const openAiChatSchema = z.object({
  model: z.string().min(1).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string().min(1)
      })
    )
    .min(1),
  user: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});
