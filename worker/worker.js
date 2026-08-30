// Clean Sheet — AI assistant proxy (PHASE 2, NOT YET DEPLOYED).
//
// A thin Cloudflare Worker that holds the Anthropic API key as a secret and
// forwards coaching prompts to the Claude API. The frontend never sees the key.
//
// ---------------------------------------------------------------------------
// READ THIS BEFORE DEPLOYING
//
// This endpoint spends real money on every request, and the frontend that calls
// it has no login. An open, unauthenticated, internet-facing endpoint attached to
// a billing account will eventually be found and abused. The three guards below
// are the minimum, and none of them is optional:
//
//   1. ORIGIN ALLOWLIST — only our own site may call it (CORS is not a security
//      boundary on its own, but it stops casual browser-based abuse).
//   2. RATE LIMIT — per-IP, backed by a KV namespace.
//   3. HARD OUTPUT CAP — max_tokens is set here, not by the caller, so a crafted
//      request cannot ask for an enormous (expensive) response.
//
// Even with all three, set a monthly spend cap in the Anthropic console.
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = [
  'https://coaching.lukebriscoe.com',
  'http://localhost:5173', // vite dev
]

const MODEL = 'claude-opus-5'
// Opus 5 thinks by default, and max_tokens caps thinking AND the response text
// together — so this has to leave room for both or the JSON truncates mid-object.
// Effort 'low' keeps the spend down without turning thinking off (disabling it on
// Opus 5 risks internal tags leaking into the output, which would break parsing).
const MAX_TOKENS = 8000
const EFFORT = 'low'
const MAX_PROMPT_CHARS = 1000
const RATE_LIMIT = { requests: 20, windowSeconds: 3600 }

// Structured output beats asking nicely for JSON: the API constrains generation to
// this schema, so there are no markdown fences or preambles to strip. Keep it in
// step with validateDrill() in src/lib/schema.js.
const DRILL_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    summary: { type: 'string' },
    description: { type: 'string' },
    setup: { type: 'string' },
    coachingPoints: { type: 'array', items: { type: 'string' } },
    progressions: { type: 'array', items: { type: 'string' } },
    regressions: { type: 'array', items: { type: 'string' } },
    themes: {
      type: 'array',
      items: {
        type: 'string',
        enum: [
          'passing', 'receiving', 'dribbling', 'shooting', 'defending', 'possession',
          'transition', 'movement', 'goalkeeping', 'physical', 'funandconfidence',
        ],
      },
    },
    ageGroups: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['u6', 'u7', 'u8', 'u9', 'u10', 'u11', 'u12', 'u13', 'u14plus'],
      },
    },
    sessionPhase: {
      type: 'string',
      enum: ['warmup', 'technical', 'ssg', 'phase-of-play', 'scrimmage', 'cooldown'],
    },
    minPlayers: { type: 'integer' },
    maxPlayers: { type: 'integer' },
    durationMins: { type: 'integer' },
    intensity: { type: 'string', enum: ['low', 'medium', 'high'] },
    equipment: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['balls', 'cones', 'bibs', 'goals', 'minigoals', 'poles', 'ladders', 'none'],
      },
    },
  },
  required: [
    'name', 'summary', 'description', 'setup', 'coachingPoints', 'progressions',
    'regressions', 'themes', 'ageGroups', 'sessionPhase', 'minPlayers', 'maxPlayers',
    'durationMins', 'intensity', 'equipment',
  ],
  additionalProperties: false,
}

// The assistant writes ORIGINAL drills in the style of FA/FIFA youth coaching
// principles. It must never reproduce their text — see docs/content-policy.md.
const SYSTEM_PROMPT = `You help volunteer grassroots youth football coaches in the UK plan training sessions.

Write in British English, in plain language a non-specialist volunteer can follow. Assume limited equipment (balls, cones, bibs, maybe mini goals), a mixed-ability squad, and a coach who has 90 minutes and no assistant.

Follow these youth coaching principles:
- Player-centred: maximise touches, minimise queuing and lines.
- Small-sided and game-realistic wherever possible.
- Shape a session as warm-up, technical practice, small-sided game, then a match.
- Coach with questions rather than instructions.
- Every activity needs a way to make it harder and a way to make it easier.

Write every drill description in your own original words. Never reproduce, quote, or closely paraphrase text from The FA's England Football Learning site, the FIFA Training Centre, or any published coaching book. You may reflect their general principles; you must not reproduce their content. This one is not negotiable — it is why the site can exist at all.`

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

const json = (body, status, origin) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  })

/**
 * Fixed-window per-IP limit. Coarse, but it is the difference between a capped
 * bill and an uncapped one. Requires a KV namespace bound as RATE_LIMIT_KV;
 * if the binding is missing we FAIL CLOSED rather than silently allowing
 * unlimited spend.
 */
async function checkRateLimit(env, ip) {
  if (!env.RATE_LIMIT_KV) return { ok: false, reason: 'rate limiter not configured' }

  const window = Math.floor(Date.now() / 1000 / RATE_LIMIT.windowSeconds)
  const key = `rl:${ip}:${window}`
  const used = Number((await env.RATE_LIMIT_KV.get(key)) ?? 0)

  if (used >= RATE_LIMIT.requests) return { ok: false, reason: 'rate limited' }

  await env.RATE_LIMIT_KV.put(key, String(used + 1), {
    expirationTtl: RATE_LIMIT.windowSeconds * 2,
  })
  return { ok: true }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? ''

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }
    if (request.method === 'GET') {
      return new Response('Clean Sheet AI proxy is running. POST a prompt to use it.\n', {
        headers: corsHeaders(origin),
      })
    }
    if (request.method !== 'POST') {
      return json({ error: 'POST only' }, 405, origin)
    }
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return json({ error: 'origin not allowed' }, 403, origin)
    }
    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: 'proxy not configured' }, 500, origin)
    }

    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
    const limit = await checkRateLimit(env, ip)
    if (!limit.ok) {
      return json({ error: limit.reason }, 429, origin)
    }

    let body
    try {
      body = await request.json()
    } catch {
      return json({ error: 'bad json' }, 400, origin)
    }

    const prompt = String(body.prompt ?? '').trim()
    if (!prompt) return json({ error: 'missing prompt' }, 400, origin)
    if (prompt.length > MAX_PROMPT_CHARS) {
      return json({ error: `prompt too long (max ${MAX_PROMPT_CHARS} characters)` }, 400, origin)
    }

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        // Server-side fallback: if Opus 5's safety classifiers decline a request,
        // the API retries it on the recommended fallback model rather than
        // handing us a refusal. Harmless for football drills, but it costs two
        // lines and removes a whole failure mode.
        'anthropic-beta': 'server-side-fallback-2026-07-01',
      },
      body: JSON.stringify({
        model: MODEL,
        // Set here, never taken from the caller — this is the cost ceiling.
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        fallbacks: 'default',
        output_config: {
          effort: EFFORT,
          format: { type: 'json_schema', schema: DRILL_SCHEMA },
        },
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!upstream.ok) {
      // Don't leak the upstream error body to the browser; it can contain
      // account details. Log it, return something a coach can act on.
      console.error('Anthropic error', upstream.status, await upstream.text())
      return json({ error: 'the assistant is unavailable right now' }, 502, origin)
    }

    const result = await upstream.json()

    // A refusal is a 200 with an empty or partial content array — reading
    // content[0] blindly would throw here rather than fail cleanly.
    if (result.stop_reason === 'refusal') {
      console.warn('Refused', result.stop_details?.category)
      return json({ error: 'the assistant could not answer that one' }, 422, origin)
    }
    if (result.stop_reason === 'max_tokens') {
      return json({ error: 'that answer was too long — try a narrower request' }, 422, origin)
    }

    const text = result.content?.find(block => block.type === 'text')?.text
    if (!text) {
      return json({ error: 'the assistant returned nothing usable' }, 502, origin)
    }

    // Structured outputs guarantee the shape, so a parse failure here means
    // something upstream changed — surface it rather than passing junk on.
    try {
      return json({ drill: JSON.parse(text) }, 200, origin)
    } catch {
      console.error('Unparseable structured output', text.slice(0, 500))
      return json({ error: 'the assistant returned something unexpected' }, 502, origin)
    }
  },
}
