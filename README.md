# Koyeb0 AI Gateway

`Koyeb0` is the central AI gateway in the Cloud Swarm architecture. It gives the rest of the system one stable AI endpoint while routing requests to local Ollama, Gemini, and optional experimental providers like `g4f`.

This service is a logical role name. `Koyeb0` can run on any real Koyeb account, and `Supabase0` can run on any real Supabase account.

Current recommended local default model:

- `scb10x/llama3.2-typhoon2-3b-instruct`

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

## Deploy To Railway

This repository is set up for Docker-based deployment using the included `Dockerfile`.

Recommended deployment target now:

- architecture name: `Koyeb0`
- real host: `Railway`
- database: `Supabase0`

### GitHub -> Railway

1. Push this repository to GitHub.
2. In Railway, create a `New Project`.
3. Choose `Deploy from GitHub repo`.
4. Select `Koyeb0-AI-Gateway`.
5. Railway will detect the `Dockerfile`.
6. Set all required environment variables.
7. Deploy the service.
8. After deploy, copy the public Railway URL.

Recommended minimum Railway env vars:

```env
PORT=8080
NODE_ENV=production
INTERNAL_API_KEY=change-this
DATABASE_URL=postgresql://postgres:YOUR_SUPABASE_DB_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres
OLLAMA_BASE_URL=http://your-private-ollama-endpoint:11434
OLLAMA_MODEL=scb10x/llama3.2-typhoon2-3b-instruct
GEMINI_API_KEY=your-gemini-key
GEMINI_MODEL=gemini-2.5-flash
ENABLE_G4F=false
```

### Railway Deployment Notes

- `Koyeb0` should be deployed as a backend service, not a frontend app.
- `DATABASE_URL` must point to `Supabase0`.
- `OLLAMA_BASE_URL` must point to a reachable Ollama endpoint.
- If Railway cannot reach your Tailscale-only Ollama directly, put a secure gateway in front of Ollama first.
- Keep `g4f` disabled in production unless you intentionally want lab behavior.
- Keep the architecture name `Koyeb0` even if the actual host is Railway.

### Verify After Deploy

- `GET /health`
- `GET /v1/models`
- `POST /v1/chat/completions`
- check that request logs are written to `Supabase0`

## Deploy On The Ollama Host (`100.68.88.63`)

Recommended production shape now:

- run `Koyeb0` on the same Tailscale host as Ollama
- keep Ollama private
- let `Koyeb1-3` call `Koyeb0` over Tailscale

Files prepared for this deployment path:

- `deploy/ai-brain/docker-compose.yml`
- `deploy/ai-brain/.env.example`

Recommended setup:

1. clone this repo on `100.68.88.63`
2. copy `deploy/ai-brain/.env.example` to `deploy/ai-brain/.env`
3. set:
- `TAILSCALE_BIND_IP=100.68.88.63`
- `KOYEB0_HOST_PORT=18080`
- `INTERNAL_API_KEY=...`
- `DATABASE_URL=...`
- `OLLAMA_BASE_URL=http://host.docker.internal:11434`
- `OLLAMA_MODEL=scb10x/llama3.2-typhoon2-3b-instruct`
- `GEMINI_API_KEY=...` if used
4. run:

```bash
cd deploy/ai-brain
docker compose up -d --build
```

5. verify from the host:

```bash
curl http://100.68.88.63:18080/health
```

This compose binds `Koyeb0` to the Tailscale IP only, so it is not exposed on every interface by default.

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
- [ ] set the default Ollama model to `scb10x/llama3.2-typhoon2-3b-instruct`
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

## Deployment Plan (TH)

### ถ้า Koyeb ของคุณยังไม่มีแผนฟรี

- ให้ถือว่า repo นี้อยู่ในสถานะ `deploy-ready`
- ยังไม่ต้องเปลี่ยน architecture name
- ให้เตรียม env และ secret ให้ครบก่อน
- เมื่อมี account ที่ deploy ได้ ค่อยใช้ขั้นตอนด้านล่างทันที

### Koyeb0 เราจะใช้ทำอะไร

- เป็น AI Gateway กลางของทุก service
- รับ request จาก `Koyeb1` และ `Koyeb3`
- route ไป `Ollama`, `Gemini`, และ optional `g4f`
- เขียน log ลง `Supabase0`

### วิธี deploy Koyeb0

1. เปิด Koyeb แล้วสร้าง `Web Service`
2. เลือก deploy จาก GitHub
3. เลือก repo `Koyeb0-AI-Gateway`
4. เลือก branch `main`
5. เลือก build แบบ `Dockerfile`
6. ตั้ง `Port` เป็น `8080`
7. ใส่ environment variables ต่อไปนี้:
- `PORT=8080`
- `NODE_ENV=production`
- `INTERNAL_API_KEY=...`
- `DATABASE_URL=postgresql://postgres:YOUR_SUPABASE_DB_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres`
- `OLLAMA_BASE_URL=...`
- `OLLAMA_MODEL=typhoon`
- `OLLAMA_MODEL=scb10x/llama3.2-typhoon2-3b-instruct`
- `GEMINI_API_KEY=...` ถ้าใช้
- `GEMINI_MODEL=gemini-2.5-flash`
- `ENABLE_G4F=false`
8. กด deploy
9. หลัง deploy ให้ทดสอบ:
- `GET /health`
- `GET /v1/models`
- `POST /v1/chat/completions`

### สิ่งที่ต้องสำเร็จหลัง deploy

- service รันได้
- ต่อ `Supabase0` ได้
- เรียก Ollama ได้
- พร้อมให้ `Koyeb1` และ `Koyeb3` เรียกใช้งาน

## Sources

- [Koyeb deploy guides](https://www.koyeb.com/docs)
- [Vercel Next.js docs](https://vercel.com/docs/frameworks/nextjs)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
