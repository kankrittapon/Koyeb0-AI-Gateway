# Koyeb0 AI Gateway

The first implementation of the Cloud Swarm AI gateway.

## Goals

- expose one gateway for all internal AI traffic
- centralize provider routing
- separate local Ollama, official cloud models, and experimental providers
- make provider health and fallback behavior observable

## Initial Endpoints

- `GET /`
- `GET /health`
- `GET /v1/providers`
- `GET /v1/policies`
- `POST /v1/chat`

## Policies

- `private_first`
  Routes to Ollama first, then Gemini
- `cheap_first`
  Routes to Gemini first, then Ollama
- `lab_mode`
  Allows experimental providers when enabled

## Development

1. Copy `.env.example` to `.env`
2. Install dependencies with `npm install`
3. Run `npm run dev`

## Notes

- Ollama is treated as the private inference backend.
- Gemini is the main official cloud fallback.
- `g4f` is optional and experimental only.

