#!/usr/bin/env node
// Writes the narration for derived drill motion.
//
//   ANTHROPIC_API_KEY=... npm run motion:narrate
//   npm run motion:narrate -- --only two-ways-across
//   npm run motion:narrate -- --force      # rewrite lines that already exist
//   npm run motion:narrate -- --dry-run    # show the prompt, call nothing
//
// Deliberately narrow. The choreography already exists — it was derived from the
// arrows the coach drew (see derive-motion.mjs) — so the model is never asked to
// invent movement, only to say what is already happening. That removes the whole
// class of "plausible but tactically wrong football" that makes generative video
// unusable for this, and makes a bad result a bad sentence rather than a bad drill.
//
// Output is written back into data/drill-motion.json and reviewed as a diff.

import { writeFile } from 'node:fs/promises'
import Anthropic from '@anthropic-ai/sdk'
import { withTimeline, speechDuration } from '../src/lib/motion.js'
import { videoDuration, MAX_VIDEO_SEC, setupLine } from '../render/composition.js'
import { MOTION_FILE, loadDrills, loadMotion, slugify } from './lib/motion-data.mjs'

const MODEL = 'claude-opus-5'
const MAX_WORDS = 9

const args = process.argv.slice(2)
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null
const force = args.includes('--force')
const dryRun = args.includes('--dry-run')

// The content policy is the reason this project can exist at all, so the wording
// is lifted verbatim from worker/worker.js rather than paraphrased. See
// docs/content-policy.md — it applies to AI output exactly as it does to a
// human contributor.
const SYSTEM = `You write narration for short training videos made for volunteer grassroots youth football coaches in the UK.

Write in British English, in plain language a non-specialist volunteer can follow. Assume limited equipment, a mixed-ability squad, and a coach watching on a phone at the side of a pitch.

Write every line in your own original words. Never reproduce, quote, or closely paraphrase text from The FA's England Football Learning site, the FIFA Training Centre, or any published coaching book. You may reflect their general principles; you must not reproduce their content. This one is not negotiable — it is why the site can exist at all.

You are given a drill and a list of BEATS. Each beat is a movement that is already animated — you are describing what the viewer is watching, not deciding what happens. Never invent movement that is not in the beats.

Rules for each line:
- At most ${MAX_WORDS} words. Shorter is better. These are captions on a 30-second video and every word costs screen time.
- Say what is happening and why it matters to the coach, not just what moves. "Play it wide and follow the pass" beats "The ball moves right".
- Present tense, describing the picture. No "you will see", no "in this drill", no numbering.
- Beat 0 is the set-up, held still before anything moves — introduce the picture.
- Do not repeat the drill name. It is already on screen.
- Vary the openings across beats. Do not start every line the same way.`

const SCHEMA = {
  type: 'object',
  properties: {
    lines: {
      type: 'array',
      description: 'One line per beat, in order. Exactly as many as there are beats.',
      items: { type: 'string' },
    },
  },
  required: ['lines'],
  additionalProperties: false,
}

/** A human-readable description of what each beat does, for the prompt. */
function describeBeats(drill, motion) {
  const shapes = drill.diagram.shapes
  const timeline = withTimeline(motion, shapes)

  return timeline.map((step, index) => {
    if (!step.moves.length) return `Beat ${index}: the set-up, nothing moves yet.`

    const parts = step.moves.map(move => {
      const shape = shapes[move.ref]
      const side =
        shape.team === 'b' ? 'a defending' : shape.team === 'n' ? 'a neutral' : 'an attacking'
      const what =
        shape.t === 'ball'
          ? 'the ball is passed'
          : `${side} player ${move.carry != null ? 'dribbles' : 'runs'}`
      const dir = direction(move.from, move.to)
      return `${what} ${dir}`
    })

    return `Beat ${index}: ${parts.join(', and ')}.`
  })
}

/** Plain-English direction, so the model is not asked to read coordinates. */
function direction(from, to) {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const far = Math.hypot(dx, dy) > 30 ? 'a long way ' : ''
  const words = []
  if (Math.abs(dy) > 8) words.push(dy < 0 ? 'forward' : 'back')
  if (Math.abs(dx) > 8) words.push(dx > 0 ? 'to the right' : 'to the left')
  return words.length ? `${far}${words.join(' and ')}` : 'a short distance'
}

function promptFor(drill, motion) {
  const beats = describeBeats(drill, motion)
  return [
    `DRILL: ${drill.name}`,
    `Summary: ${drill.summary}`,
    `Ages: ${(drill.ageGroups ?? []).join(', ')}. Phase: ${drill.sessionPhase}. Themes: ${(drill.themes ?? []).join(', ')}.`,
    `What happens: ${String(drill.description ?? '').replace(/\*\*/g, '').slice(0, 700)}`,
    drill.setup ? `Set-up: ${String(drill.setup).slice(0, 300)}` : null,
    '',
    `BEATS (${beats.length} lines needed, in this order):`,
    ...beats,
    '',
    `The set-up card already shows: "${setupLine(drill)}" — do not repeat it.`,
    `Return exactly ${beats.length} lines.`,
  ]
    .filter(Boolean)
    .join('\n')
}

// -----------------------------------------------------------------------------

const drills = await loadDrills()
const motion = await loadMotion()
const bySlug = new Map(drills.map(d => [d.slug ?? slugify(d.name), d]))

let targets = Object.keys(motion)
if (only) targets = targets.filter(slug => slug === only)
if (!force) targets = targets.filter(slug => !motion[slug].script)

if (!targets.length) {
  console.log(
    only
      ? `Nothing to do for "${only}" — it already has narration (use --force to rewrite).`
      : 'Every drill already has narration. Use --force to rewrite.',
  )
  process.exit(0)
}

if (dryRun) {
  const slug = targets[0]
  console.log(`--- SYSTEM ---\n${SYSTEM}\n\n--- USER (${slug}) ---\n${promptFor(bySlug.get(slug), motion[slug])}`)
  console.log(`\n(${targets.length} drills would be narrated)`)
  process.exit(0)
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('\n✗ ANTHROPIC_API_KEY is not set.\n')
  console.error('  export ANTHROPIC_API_KEY=sk-ant-...')
  console.error('  npm run motion:narrate\n')
  console.error('  (npm run motion:narrate -- --dry-run prints the prompt without calling anything.)\n')
  process.exit(1)
}

const client = new Anthropic()
let written = 0
let failed = 0
const overBudget = []

console.log(`Narrating ${targets.length} drills with ${MODEL}…\n`)

for (const [n, slug] of targets.entries()) {
  const drill = bySlug.get(slug)
  const entry = motion[slug]
  if (!drill) {
    console.error(`✗ ${slug}: no drill under that slug`)
    failed++
    continue
  }

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      // The system block is byte-identical across all 64 calls, so caching it
      // turns the bulk of the input into a cache read after the first drill.
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: promptFor(drill, entry) }],
    })

    if (response.stop_reason === 'refusal') {
      console.error(`✗ ${slug}: declined (${response.stop_details?.category ?? 'unknown'})`)
      failed++
      continue
    }

    const text = response.content.find(block => block.type === 'text')?.text
    const { lines } = JSON.parse(text)

    if (!Array.isArray(lines) || lines.length !== entry.steps.length) {
      console.error(`✗ ${slug}: got ${lines?.length ?? 0} lines for ${entry.steps.length} beats`)
      failed++
      continue
    }

    entry.steps = entry.steps.map((step, i) => ({ ...step, say: String(lines[i]).trim() }))
    entry.script = entry.steps.map(s => s.say).filter(Boolean).join(' ')

    const seconds = videoDuration(drill, entry)
    if (seconds > MAX_VIDEO_SEC) overBudget.push(`${slug} (${seconds.toFixed(1)}s)`)

    const longest = Math.max(...lines.map(l => l.trim().split(/\s+/).length))
    written++
    console.log(
      `✓ ${String(n + 1).padStart(2)}/${targets.length} ${slug.padEnd(34)} ` +
        `${seconds.toFixed(1)}s, longest line ${longest}w`,
    )
  } catch (error) {
    console.error(`✗ ${slug}: ${error.message}`)
    failed++
  }
}

const sorted = Object.fromEntries(Object.keys(motion).sort().map(k => [k, motion[k]]))
await writeFile(MOTION_FILE, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8')

console.log(`\n${written} narrated, ${failed} failed → data/drill-motion.json`)
if (overBudget.length) {
  console.log(`\n⚠ ${overBudget.length} over the ${MAX_VIDEO_SEC}s budget — rerun those with --force:`)
  for (const line of overBudget) console.log(`  · ${line}`)
}
console.log('\nReview the diff, then: npm run motion:check && npm run render')
