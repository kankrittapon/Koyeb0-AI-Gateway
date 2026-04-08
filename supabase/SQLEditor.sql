create extension if not exists pgcrypto;

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  service_key text not null unique,
  display_name text not null,
  service_type text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique,
  display_name text not null,
  provider_type text not null,
  endpoint_url text,
  priority integer not null default 100,
  is_active boolean not null default true,
  supports_tools boolean not null default false,
  supports_embeddings boolean not null default false,
  privacy_mode text not null default 'standard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.routing_policies (
  id uuid primary key default gen_random_uuid(),
  policy_key text not null unique,
  description text,
  request_mode text not null,
  preferred_provider_key text,
  fallback_chain jsonb not null default '[]'::jsonb,
  max_retries integer not null default 2,
  timeout_ms integer not null default 30000,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  request_key text not null unique,
  source_service text not null,
  source_user_id text,
  request_mode text not null,
  policy_key text not null,
  model_hint text,
  prompt_preview text,
  status text not null,
  selected_provider text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.ai_request_attempts (
  id uuid primary key default gen_random_uuid(),
  request_key text not null,
  attempt_no integer not null,
  provider_key text not null,
  success boolean not null,
  latency_ms integer,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.provider_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null,
  healthy boolean not null,
  configured boolean not null,
  reason text,
  checked_at timestamptz not null default now()
);

create index if not exists idx_ai_requests_created_at on public.ai_requests(created_at desc);
create index if not exists idx_ai_requests_source_service on public.ai_requests(source_service);
create index if not exists idx_ai_request_attempts_request_key on public.ai_request_attempts(request_key);
create index if not exists idx_provider_health_snapshots_provider_key_checked_at on public.provider_health_snapshots(provider_key, checked_at desc);

insert into public.services (service_key, display_name, service_type)
values
  ('koyeb0', 'AI Gateway', 'gateway')
on conflict (service_key) do nothing;

insert into public.providers (provider_key, display_name, provider_type, priority, supports_tools, supports_embeddings, privacy_mode)
values
  ('ollama', 'Local Ollama', 'local-llm', 10, true, true, 'private'),
  ('gemini', 'Google Gemini', 'cloud-llm', 20, true, true, 'standard'),
  ('g4f', 'Experimental g4f', 'experimental', 30, true, false, 'standard')
on conflict (provider_key) do nothing;

insert into public.routing_policies (policy_key, description, request_mode, preferred_provider_key, fallback_chain, max_retries, timeout_ms)
values
  ('private_first', 'Private workloads prefer local inference before cloud fallback', 'chat', 'ollama', '["gemini"]'::jsonb, 2, 45000),
  ('cheap_first', 'Cloud-first low-cost path with local fallback', 'chat', 'gemini', '["ollama"]'::jsonb, 1, 30000),
  ('lab_mode', 'Experimental mode allowing optional g4f in the chain', 'chat', 'ollama', '["g4f","gemini"]'::jsonb, 2, 45000)
on conflict (policy_key) do nothing;
