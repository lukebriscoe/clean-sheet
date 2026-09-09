// Shared plumbing for the video pipeline: loading drills and motion, and the
// fingerprint that ties the two together.
//
// Motion references shapes by their INDEX in a drill's diagram.shapes array,
// which is compact and readable but silently wrong the moment someone reorders
// or inserts a shape — and scripts/add-seed-diagrams.mjs rewrites whole diagrams.
// So every motion entry records a fingerprint of the diagram it was authored
// against, and check-motion.mjs refuses to pass if the two have drifted apart.
// A changed diagram becomes a loud CI failure instead of a nonsense video.

import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
export const SEED_FILE = resolve(HERE, '../../data/seed-drills.json')
export const MOTION_FILE = resolve(HERE, '../../data/drill-motion.json')

/** Only these can be animated — everything else is furniture. */
export const MOVABLE = ['player', 'ball']

/**
 * Deterministic JSON with sorted keys, so a reformat or a differently-ordered
 * shape literal doesn't produce a spurious fingerprint mismatch. Only the
 * *values* should be able to break the fingerprint.
 */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

/** Short hash of a diagram's shapes — the thing motion indices are pinned to. */
export function fingerprint(shapes = []) {
  return createHash('sha256').update(canonical(shapes)).digest('hex').slice(0, 8)
}

export async function loadDrills() {
  const raw = JSON.parse(await readFile(SEED_FILE, 'utf8'))
  return raw.drills ?? []
}

export async function loadMotion() {
  try {
    return JSON.parse(await readFile(MOTION_FILE, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return {}
    throw error
  }
}

/** Slugs are derived the same way src/lib/ids.js does it. */
export function slugify(name) {
  return String(name ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Check one drill's motion against its diagram.
 * Returns an array of human-readable problems — empty means it's good.
 *
 * Deliberately returns every problem rather than throwing on the first, so a
 * regeneration run can be fixed in one pass instead of one error at a time.
 */
export function validateMotion(slug, motion, drill) {
  const problems = []
  const fail = message => problems.push(`${slug}: ${message}`)

  if (!drill) {
    fail('no drill in seed-drills.json with this slug')
    return problems
  }

  const shapes = drill.diagram?.shapes
  if (!Array.isArray(shapes) || !shapes.length) {
    fail('drill has no diagram to animate')
    return problems
  }

  const expected = fingerprint(shapes)
  if (motion.shapeFingerprint !== expected) {
    fail(
      `diagram has changed since the motion was authored ` +
        `(fingerprint ${motion.shapeFingerprint ?? 'missing'}, now ${expected}). ` +
        `Shape indices may no longer point where they did — regenerate this drill's motion.`,
    )
  }

  if (typeof motion.script !== 'string' || !motion.script.trim()) {
    fail('missing narration script')
  }

  const steps = motion.steps
  if (!Array.isArray(steps) || !steps.length) {
    fail('no steps')
    return problems
  }

  steps.forEach((step, s) => {
    const where = `step ${s}`
    if (step.say != null && typeof step.say !== 'string') {
      fail(`${where}: "say" must be a string`)
    }
    if (step.hold != null && (!Number.isFinite(step.hold) || step.hold < 0)) {
      fail(`${where}: "hold" must be a non-negative number`)
    }

    const moves = step.moves ?? []
    if (!Array.isArray(moves)) {
      fail(`${where}: "moves" must be an array`)
      return
    }

    moves.forEach((move, m) => {
      const at = `${where}, move ${m}`
      for (const key of ['ref', 'carry']) {
        const index = move[key]
        if (key === 'carry' && index == null) continue
        if (!Number.isInteger(index) || index < 0 || index >= shapes.length) {
          fail(`${at}: ${key} ${index} is not a shape index (0–${shapes.length - 1})`)
          continue
        }
        if (!MOVABLE.includes(shapes[index].t)) {
          fail(`${at}: ${key} ${index} points at a "${shapes[index].t}", which cannot move`)
        }
      }

      if (move.carry != null && shapes[move.carry]?.t !== 'ball') {
        fail(`${at}: carry ${move.carry} should be a ball`)
      }
      if (move.carry != null && move.carry === move.ref) {
        fail(`${at}: a shape cannot carry itself`)
      }

      const to = move.to
      if (!Array.isArray(to) || to.length !== 2 || !to.every(Number.isFinite)) {
        fail(`${at}: "to" must be a [x, y] pair`)
      } else if (to.some(n => n < 0 || n > 100)) {
        fail(`${at}: "to" ${JSON.stringify(to)} falls outside the 0–100 area`)
      }
    })
  })

  return problems
}
