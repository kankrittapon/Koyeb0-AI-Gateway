# Koyeb0 AI Gateway

Production-MVP AI gateway for the Cloud Swarm architecture.

## Goals

- expose one gateway for all internal AI traffic
- centralize provider routing
- separate local Ollama, official cloud models, and experimental providers
- make provider health and fallback behavior observable

## Endpoints

- `GET /`
- `GET /health`
- `GET /v1/providers`
- `GET /v1/policies`
- `GET /v1/models`
- `GET /v1/debug/requests`
- `POST /v1/chat`
- `POST /v1/chat/completions`

## Policies

- `private_first`
  Routes to Ollama first, then Gemini
- `cheap_first`
  Routes to Gemini first, then Ollama
- `lab_mode`
  Allows experimental providers when enabled

## What It Does

- validates internal AI requests
- chooses providers based on policy
- calls local Ollama first when needed
- falls back to Gemini
- optionally tries experimental `g4f`
- logs requests and provider attempts to Supabase/Postgres
- exposes an OpenAI-compatible endpoint for clients like Open WebUI

## Development

1. Copy `.env.example` to `.env`
2. Install dependencies with `npm install`
3. Run `npm run dev`

## Deploy

- Koyeb can deploy this repo using the included `Dockerfile`
- set `PORT`, `INTERNAL_API_KEY`, `DATABASE_URL`, `OLLAMA_BASE_URL`, and provider env vars
- run the SQL in `supabase/SQLEditor.sql` before enabling DB-backed logging

## Notes

- Ollama is treated as the private inference backend.
- Gemini is the main official cloud fallback.
- `g4f` is optional and experimental only.
- `DATABASE_URL` is optional, but production should provide it.

## Supabase

- SQL file: `supabase/SQLEditor.sql`
- target: `Supabase0`
