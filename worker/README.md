# Clean Sheet AI proxy

A Cloudflare Worker that holds the Anthropic API key and forwards coaching prompts to
the Claude API, so the key never reaches the browser.

> **Status: phase 2. Not deployed, and not wired into the frontend yet.**
> The code is here so the shape is agreed, but v1 of Clean Sheet ships without the AI
> assistant. Nothing in the app calls this endpoint until `VITE_AI_WORKER_URL` is set.

## Why this is not just a fetch from the frontend

An Anthropic API key in a static site's JavaScript is a public API key. Anyone
viewing source can take it and spend your money. The Worker keeps the key
server-side; the browser only ever sees the Worker's URL.

## Before you deploy: the cost problem

Clean Sheet has no login. That means this endpoint is, by design, callable by
anyone who finds it — and every call costs money. Three guards are built in, and
none should be removed:

| Guard | What it does | Where |
|---|---|---|
| Origin allowlist | Rejects requests that don't come from our own site | `ALLOWED_ORIGINS` |
| Per-IP rate limit | 20 requests/hour, backed by KV | `checkRateLimit` |
| Hard `max_tokens` cap | The caller cannot request a huge, expensive response | `MAX_TOKENS` |
| Fixed `effort` level | The caller cannot dial up how much the model thinks | `EFFORT` |

The rate limiter **fails closed**: with no KV namespace bound, the Worker refuses
every request rather than forwarding unlimited traffic to a paid API.

An origin allowlist stops browser-based abuse but not a determined caller with
`curl`, who can set any `Origin` header they like. The rate limit is what actually
caps your exposure. **Also set a monthly spend limit in the Anthropic console** —
treat that as the real backstop, not these guards.

## Deploying

```bash
cd worker

# 1. Create the KV namespace for rate limiting, then paste the id into wrangler.toml
npx wrangler kv namespace create RATE_LIMIT_KV

# 2. Deploy
npx wrangler deploy

# 3. Set the API key as a secret (never put it in wrangler.toml)
npx wrangler secret put ANTHROPIC_API_KEY
```

Then add the Worker URL to the frontend:

```
# .env, and as a GitHub Actions secret for the deploy workflow
VITE_AI_WORKER_URL=https://clean-sheet-ai.<your-subdomain>.workers.dev
```

Add your production origin to `ALLOWED_ORIGINS` in `worker.js` before deploying —
requests from anywhere else get a 403.

## Testing it

```bash
# Should return the liveness message
curl https://clean-sheet-ai.<your-subdomain>.workers.dev

# Should return 403 — no allowed Origin header
curl -X POST https://clean-sheet-ai.<your-subdomain>.workers.dev \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"a 20 minute passing warm-up for 8 U10 players"}'

# Should return {"drill": {...}} matching the drill schema
curl -X POST https://clean-sheet-ai.<your-subdomain>.workers.dev \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://coaching.lukebriscoe.com' \
  -d '{"prompt":"a 20 minute passing warm-up for 8 U10 players"}'
```

## How it talks to Claude

Three things worth knowing before you change the request body:

- **Model is `claude-opus-5`.** It thinks by default, and `max_tokens` caps thinking
  *and* the response together — hence 8000 rather than something tight. Turning
  thinking off would be cheaper but risks internal tags leaking into the output,
  which would break JSON parsing; `effort: "low"` gets the saving safely instead.
- **Output is schema-constrained**, not prompted-for. `output_config.format` makes
  the API generate against `DRILL_SCHEMA` directly, so there are no markdown fences
  or preambles to strip and no "please respond only with JSON" in the system prompt.
  Keep `DRILL_SCHEMA` in step with `validateDrill()` in `src/lib/schema.js`.
- **Refusals are 200s, not errors.** A declined request returns `stop_reason:
  "refusal"` with empty content. The worker checks that before reading the content
  array; it also sends `fallbacks: "default"` so the API retries on another model
  first. Vanishingly unlikely for football drills, but it costs two lines.

## Content policy

The system prompt instructs the model to write **original** drill descriptions
following FA and FIFA youth coaching principles, and explicitly forbids reproducing
their published text. Anything the assistant generates is saved with
`source: "ai"` so AI-written drills stay identifiable in the library.
See [`../docs/content-policy.md`](../docs/content-policy.md).

## Free tier

Cloudflare Workers' free plan covers 100,000 requests/day and KV covers 100,000
reads and 1,000 writes/day — far more than this will ever need. The Worker itself
costs nothing; the Anthropic API calls are the only cost.
