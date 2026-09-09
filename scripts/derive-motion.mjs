#!/usr/bin/env node
// Derives drill motion from the arrows already drawn in each diagram.
//
//   npm run motion:derive
//   npm run motion:derive -- --only two-ways-across
//
// A diagram's pass/run/dribble arrows ARE the choreography: someone already
// decided who moves, from where, to where, and drew it. 66 of the 69 seed drills
// carry them. Reading that instead of asking a model to invent movement means:
//
//   · the video can never contradict the diagram on the drill page,
//   · the motion is as reviewed as the diagram already is,
//   · nothing has to hand-author shape indices, so the whole class of
//     "index points at the wrong player" bug disappears, and
//   · it costs nothing and needs no API key.
//
// What arrows cannot supply is narration — an arrow knows it is a pass, not why.
// Steps are written with `say: null` here and filled in separately.
//
// Arrow → movement, using the diagram's own vocabulary:
//   pass     the BALL travels from → to
//   run      a PLAYER travels from → to, leaving the ball
//   dribble  a PLAYER travels from → to and takes the ball with them

import { writeFile } from 'node:fs/promises'
import { totalDuration } from '../src/lib/motion.js'
import {
  MOTION_FILE,
  loadDrills,
  loadMotion,
  fingerprint,
  slugify,
  validateMotion,
} from './lib/motion-data.mjs'

const ARROWS = ['pass', 'run', 'dribble']

/** How far from an arrow's tail we will look for the thing it refers to. */
const SNAP_RADIUS = 14

const args = process.argv.slice(2)
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])

/**
 * Nearest shape of the given types to a point, or null if nothing is close.
 *
 * Matches against WHERE THINGS ARE NOW, not where the diagram first drew them.
 * A passing sequence is drawn as a chain — pass A→B, then B→C — and the second
 * arrow's tail sits at the first one's head, where no ball was ever drawn.
 * Matching on original coordinates finds nothing there and silently drops the
 * rest of the sequence, which is what happened on 21 of the 67 drills.
 */
function nearest(shapes, positions, types, point, exclude = new Set()) {
  let best = null
  let bestDist = SNAP_RADIUS

  shapes.forEach((shape, index) => {
    if (!types.includes(shape.t) || exclude.has(index)) return
    const d = distance(positions[index], point)
    if (d < bestDist) {
      best = index
      bestDist = d
    }
  })

  return best
}

/**
 * Turn one arrow into a move, or explain why it could not be turned into one.
 *
 * `claimed` stops two arrows in the same beat both grabbing the same player —
 * a diagram with two passes from the same spot should move two different balls.
 */
function moveFor(arrow, shapes, positions, claimed) {
  const from = arrow.from
  const to = arrow.to

  if (arrow.t === 'pass') {
    const ball = nearest(shapes, positions, ['ball'], from, claimed)
    if (ball == null) return { skip: 'no ball near the tail of the pass' }
    claimed.add(ball)
    return { move: { ref: ball, to } }
  }

  const player = nearest(shapes, positions, ['player'], from, claimed)
  if (player == null) return { skip: `no player near the tail of the ${arrow.t}` }
  claimed.add(player)

  if (arrow.t === 'run') return { move: { ref: player, to } }

  // A dribble takes the ball along. If the drawing shows no ball at the player's
  // feet the run still reads correctly, so this degrades rather than failing.
  const ball = nearest(shapes, positions, ['ball'], positions[player], claimed)
  if (ball != null) claimed.add(ball)
  return { move: { ref: player, to, ...(ball != null ? { carry: ball } : {}) } }
}

/**
 * Build steps for a drill.
 *
 * One arrow per beat rather than all at once: a Short is watched on a phone, and
 * a diagram's worth of simultaneous movement is unreadable at that size. Passes
 * and the runs onto them are sequential beats, which is also how a coach
 * explains them.
 */
function deriveSteps(drill) {
  const shapes = drill.diagram?.shapes ?? []
  const arrows = shapes.filter(shape => ARROWS.includes(shape.t))
  const steps = [{ say: null, moves: [], hold: 1.2 }] // the set-up, held still
  const skipped = []

  // Live positions, walked forward as the sequence plays out. This is what lets
  // a chain of passes find the ball where the previous pass left it.
  const positions = shapes.map(shape => [shape.x ?? 0, shape.y ?? 0])

  for (const arrow of arrows) {
    const claimed = new Set()
    const { move, skip } = moveFor(arrow, shapes, positions, claimed)
    if (skip) {
      skipped.push(`${arrow.t}: ${skip}`)
      continue
    }

    // Offset is measured BEFORE the player moves, or it comes out as zero and
    // the ball ends up under their feet instead of beside them.
    const wasAt = positions[move.ref]
    if (move.carry != null) {
      const dx = positions[move.carry][0] - wasAt[0]
      const dy = positions[move.carry][1] - wasAt[1]
      positions[move.carry] = [move.to[0] + dx, move.to[1] + dy]
    }
    positions[move.ref] = [...move.to]

    steps.push({ say: null, moves: [move], hold: 0.6 })
  }

  return { steps, skipped, arrowCount: arrows.length }
}

// -----------------------------------------------------------------------------

const drills = await loadDrills()
const motion = await loadMotion()
const targets = drills.filter(drill => {
  const slug = drill.slug ?? slugify(drill.name)
  if (only && slug !== only) return false
  return drill.diagram?.shapes?.length
})

if (only && !targets.length) {
  console.error(`✗ No drill with a diagram under slug "${only}"`)
  process.exit(1)
}

let derived = 0
let noArrows = 0
let invalid = 0
const partial = []

for (const drill of targets) {
  const slug = drill.slug ?? slugify(drill.name)
  const { steps, skipped, arrowCount } = deriveSteps(drill)

  if (steps.length === 1) {
    noArrows++
    continue // nothing but a set-up shot — not worth a video
  }

  const entry = {
    shapeFingerprint: fingerprint(drill.diagram.shapes),
    script: null, // narration is written separately; see motion:narrate
    steps,
  }

  const problems = validateMotion(slug, { ...entry, script: 'placeholder' }, drill)
  if (problems.length) {
    invalid++
    for (const problem of problems) console.error(`✗ ${problem}`)
    continue
  }

  // Preserve any narration already written for this drill, so re-deriving the
  // motion never silently throws away words someone worked on.
  const existing = motion[slug]
  if (existing?.steps?.length === entry.steps.length) {
    entry.steps = entry.steps.map((step, i) => ({ ...step, say: existing.steps[i].say ?? null }))
    entry.script = existing.script ?? null
  }

  motion[slug] = entry
  derived++
  if (skipped.length) partial.push(`${slug} (${skipped.length}/${arrowCount} arrows: ${skipped[0]})`)
}

const sorted = Object.fromEntries(Object.keys(motion).sort().map(key => [key, motion[key]]))
await writeFile(MOTION_FILE, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8')

console.log(`✓ derived motion for ${derived} drills`)
if (noArrows) console.log(`· ${noArrows} skipped — a diagram but no movement arrows`)
if (invalid) console.log(`✗ ${invalid} failed validation`)
if (partial.length) {
  console.log(`\n${partial.length} drills where an arrow could not be matched to a shape:`)
  for (const line of partial.slice(0, 10)) console.log(`  · ${line}`)
  if (partial.length > 10) console.log(`  … and ${partial.length - 10} more`)
}
const needNarration = Object.values(sorted).filter(m => !m.script).length
console.log(`\n${Object.keys(sorted).length} entries in data/drill-motion.json — ${needNarration} still need narration`)
