import dotenv from "dotenv";
import dns from "node:dns";
import { z } from "zod";

dotenv.config();

dns.setDefaultResultOrder("ipv4first");

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  INTERNAL_API_KEY: z.string().min(1).default("change-me"),
  DATABASE_URL: z.string().optional().default(""),
  DB_FORCE_IPV4: z
    .string()
    .optional()
    .default("true")
    .transform((value) => value.toLowerCase() === "true"),
  LOG_PROMPT_PREVIEW: z
    .string()
    .optional()
    .default("true")
    .transform((value) => value.toLowerCase() === "true"),
  OLLAMA_BASE_URL: z.string().url().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().min(1).default("scb10x/llama3.2-typhoon2-3b-instruct"),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),
  ENABLE_G4F: z
    .string()
    .optional()
    .default("false")
    .transform((value) => value.toLowerCase() === "true"),
  G4F_BASE_URL: z.string().optional().default(""),
  G4F_MODEL: z.string().optional().default("")
});

export const config = envSchema.parse(process.env);
