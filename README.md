# Koyeb0 AI Gateway

`Koyeb0` is the central AI gateway in the Cloud Swarm architecture. It gives the rest of the system one stable AI endpoint while routing requests to local Ollama, Gemini, and optional experimental providers like `g4f`.

This service is a logical role name. `Koyeb0` can run on any real Koyeb account, and `Supabase0` can run on any real Supabase account.

## What Koyeb0 Does

- exposes one internal AI API for the rest of the platform
- routes requests by policy
- calls local Ollama for private workloads
- falls back to Gemini when needed
- optionally tries `g4f` in lab mode
- stores request, provider-attempt, and health logs in `Supabase0`
- exposes an OpenAI-compatible endpoint for apps such as Open WebUI or Next.js backends

## Endpoints

- `GET /`
- `GET /health`
- `GET /v1/providers`
- `GET /v1/policies`
- `GET /v1/models`
- `GET /v1/debug/requests`
- `POST /v1/chat`
- `POST /v1/chat/completions`

## Routing Policies

- `private_first`
  Ollama first, then Gemini
- `cheap_first`
  Gemini first, then Ollama
- `lab_mode`
  allows experimental providers when enabled

## Architecture Position

Recommended production flow:

- `Next.js frontend` on Vercel
- `Koyeb0` on Koyeb as Docker service
- `Supabase0` as the logging and control database
- `Local Ollama` on your Tailscale-connected host

Typical request flow:

1. user sends a message from the frontend or internal service
2. frontend/backend calls `Koyeb0`
3. `Koyeb0` chooses provider by policy
4. `Koyeb0` logs request and provider attempts to `Supabase0`
5. response returns to the caller through one stable API

## Environment Variables

Core:

- `PORT`
- `NODE_ENV`
- `INTERNAL_API_KEY`
- `DATABASE_URL`

Ollama:

- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`

Gemini:

- `GEMINI_API_KEY`
- `GEMINI_MODEL`

Experimental:

- `G4F_BASE_URL`
- `G4F_API_KEY`
- `ENABLE_G4F`

Optional behavior:

- `DEFAULT_POLICY`
- `REQUEST_TIMEOUT_MS`
- `LOG_LEVEL`

Use `.env.example` as the starting point.

## Local Development

1. Copy `.env.example` to `.env`.
2. Install dependencies:

```bash
npm install
```

3. Run the development server:

```bash
npm run dev
```

4. Run validation/build checks:

```bash
npm run check
npm run build
```

## Supabase Setup

Run the SQL file before production deployment if you want persistent logging:

- `supabase/SQLEditor.sql`

Target logical database:

- `Supabase0`

The SQL creates the tables needed for:

- gateway request logs
- provider attempt logs
- provider health logs

## Deploy To Koyeb

This repository is set up for Docker-based deployment using the included `Dockerfile`.

### Option A: GitHub -> Koyeb

1. Push this repository to GitHub.
2. In Koyeb, create a new App from GitHub.
3. Select this repository.
4. Choose Dockerfile-based deployment.
5. Set the service port to `8000` or map it from the `PORT` environment variable.
6. Add all required environment variables.
7. Deploy the service.

Recommended minimum Koyeb env vars:

```env
PORT=8000
NODE_ENV=production
INTERNAL_API_KEY=change-this
DATABASE_URL=postgresql://...
OLLAMA_BASE_URL=http://your-private-ollama-endpoint:11434
OLLAMA_MODEL=typhoon
GEMINI_API_KEY=your-gemini-key
GEMINI_MODEL=gemini-2.5-flash
ENABLE_G4F=false
DEFAULT_POLICY=private_first
REQUEST_TIMEOUT_MS=45000
LOG_LEVEL=info
```

### Option B: Prebuilt Image -> Koyeb

1. Build and push the container image to a registry.
2. In Koyeb, create a new App from a container image.
3. Point Koyeb to the image.
4. Set the port and env vars.
5. Deploy.

### Koyeb Deployment Notes

- `Koyeb0` should be deployed as a backend service, not as a frontend app.
- `DATABASE_URL` should point to `Supabase0`.
- `OLLAMA_BASE_URL` should point to a reachable Ollama endpoint.
- If Koyeb cannot reach your Tailscale-only Ollama directly, place a secure gateway in front of Ollama first.
- Keep `g4f` disabled in production unless you intentionally want lab behavior.

## Deploy Next.js

The recommended split is:

- backend services on Koyeb
- frontend on Vercel

### Recommended Production Layout

- `Vercel`: Next.js frontend
- `Koyeb`: `Koyeb0`, API services, workers
- `Supabase`: database/auth/storage as needed
- `Local host`: Ollama

### Next.js Integration Pattern

Do not call provider APIs directly from the browser. Prefer:

- browser -> Next.js server route
- Next.js server route -> `Koyeb0`

This keeps:

- `INTERNAL_API_KEY` off the client
- provider routing centralized
- request logging centralized
- provider changes isolated from the frontend

### Next.js Server Example

```ts
const response = await fetch(`${process.env.KOYEB0_BASE_URL}/v1/chat/completions`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-internal-api-key": process.env.KOYEB0_INTERNAL_API_KEY!,
  },
  body: JSON.stringify({
    model: "gateway-default",
    messages: [{ role: "user", content: "Hello" }],
    policy: "private_first",
  }),
});
```

Suggested frontend env vars:

```env
KOYEB0_BASE_URL=https://your-koyeb0-service.koyeb.app
KOYEB0_INTERNAL_API_KEY=change-this
```

### Deploy Next.js To Vercel

1. Push the Next.js repo to GitHub.
2. Import the repo into Vercel.
3. Confirm the framework is detected as Next.js.
4. Add environment variables such as `KOYEB0_BASE_URL` and `KOYEB0_INTERNAL_API_KEY`.
5. Deploy.

If you keep some backend routes in Next.js, use server-side environment variables only and do not expose the internal key with `NEXT_PUBLIC_`.

## Production Checklist

- [ ] run `supabase/SQLEditor.sql` in `Supabase0`
- [ ] set all Koyeb environment variables
- [ ] confirm Koyeb can reach Ollama
- [ ] set a default Ollama model such as `typhoon`
- [ ] test `GET /health`
- [ ] test `POST /v1/chat/completions`
- [ ] connect the Next.js server layer to `Koyeb0`
- [ ] keep `g4f` disabled unless intentionally testing it

## Notes

- Ollama is the private inference backend.
- Gemini is the official cloud fallback.
- `g4f` is optional and experimental only.
- `DATABASE_URL` is technically optional, but production should provide it.
- `Koyeb0` should stay focused on AI orchestration and not absorb unrelated business logic.

## Sources

- [Koyeb deploy guides](https://www.koyeb.com/docs)
- [Vercel Next.js docs](https://vercel.com/docs/frameworks/nextjs)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
