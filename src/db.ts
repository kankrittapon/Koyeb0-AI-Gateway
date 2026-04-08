import { Pool } from "pg";
import { config } from "./config";
import { ProviderAttempt, ProviderHealth } from "./types";

let pool: Pool | null = null;

if (config.DATABASE_URL) {
  pool = new Pool({
    connectionString: config.DATABASE_URL,
    ssl:
      config.NODE_ENV === "production"
        ? {
            rejectUnauthorized: false
          }
        : undefined
  });
}

export function hasDatabase(): boolean {
  return Boolean(pool);
}

export async function recordAiRequest(input: {
  requestId: string;
  sourceService?: string;
  sourceUserId?: string;
  requestMode: string;
  policyKey: string;
  modelHint?: string;
  promptPreview?: string;
  status: "succeeded" | "failed";
  provider?: string;
  errorMessage?: string;
}): Promise<void> {
  if (!pool) return;

  await pool.query(
    `
      insert into public.ai_requests (
        request_key,
        source_service,
        source_user_id,
        request_mode,
        policy_key,
        model_hint,
        prompt_preview,
        status,
        selected_provider,
        error_message,
        created_at,
        completed_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now(), now())
      on conflict (request_key) do update
      set
        source_service = excluded.source_service,
        source_user_id = excluded.source_user_id,
        request_mode = excluded.request_mode,
        policy_key = excluded.policy_key,
        model_hint = excluded.model_hint,
        prompt_preview = excluded.prompt_preview,
        status = excluded.status,
        selected_provider = excluded.selected_provider,
        error_message = excluded.error_message,
        completed_at = now()
    `,
    [
      input.requestId,
      input.sourceService || "unknown",
      input.sourceUserId || null,
      input.requestMode,
      input.policyKey,
      input.modelHint || null,
      input.promptPreview || null,
      input.status,
      input.provider || null,
      input.errorMessage || null
    ]
  );
}

export async function recordProviderAttempts(requestId: string, attempts: ProviderAttempt[]): Promise<void> {
  if (!pool || attempts.length === 0) return;

  const values = attempts.map((attempt, index) => [
    requestId,
    index + 1,
    attempt.provider,
    attempt.success,
    attempt.latencyMs,
    attempt.error || null
  ]);

  for (const value of values) {
    await pool.query(
      `
        insert into public.ai_request_attempts (
          request_key,
          attempt_no,
          provider_key,
          success,
          latency_ms,
          error_message,
          created_at
        ) values ($1,$2,$3,$4,$5,$6, now())
      `,
      value
    );
  }
}

export async function recordProviderHealth(healthItems: ProviderHealth[]): Promise<void> {
  if (!pool || healthItems.length === 0) return;

  for (const health of healthItems) {
    await pool.query(
      `
        insert into public.provider_health_snapshots (
          provider_key,
          healthy,
          configured,
          reason,
          checked_at
        ) values ($1,$2,$3,$4, now())
      `,
      [health.provider, health.healthy, health.configured, health.reason || null]
    );
  }
}

export async function getRecentRequests(limit = 20): Promise<unknown[]> {
  if (!pool) return [];

  const result = await pool.query(
    `
      select
        request_key,
        source_service,
        source_user_id,
        request_mode,
        policy_key,
        model_hint,
        status,
        selected_provider,
        error_message,
        created_at,
        completed_at
      from public.ai_requests
      order by created_at desc
      limit $1
    `,
    [limit]
  );

  return result.rows;
}

