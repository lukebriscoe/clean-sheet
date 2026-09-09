#!/usr/bin/env node
// Validates data/drill-motion.json against data/seed-drills.json.
//
//   npm run motion:check
//
// Runs in CI. The important job is the fingerprint check: motion references
// shapes by index, so a redrawn diagram silently invalidates every move in that
// drill. This turns that into a failed build rather than a video of players
// running into the corner flag.

import { totalDuration } from '../src/lib/motion.js'
import { videoDuration, MAX_VIDEO_SEC } from '../render/composition.js'
import { loadDrills, loadMotion, validateMotion, slugify } from './lib/motion-data.mjs'

const drills = await loadDrills()
const motion = await loadMotion()
const bySlug = new Map(drills.map(drill => [drill.slug ?? slugify(drill.name), drill]))

const entries = Object.entries(motion)
if (!entries.length) {
  console.log('No motion authored yet — nothing to check.')
  process.exit(0)
}

const problems = []

for (const [slug, entry] of entries) {
  const drill = bySlug.get(slug)
  problems.push(...validateMotion(slug, entry, drill))

  // Duration needs the real interpolation maths, so it lives here rather than in
  // the pure validator — same code path the renderer will use.
  if (drill?.diagram?.shapes) {
    const animation = totalDuration(entry, drill.diagram.shapes)
    if (animation <= 0) problems.push(`${slug}: animation has no duration`)

    // The number that actually matters is the whole video, not just the middle
    // of it. Checking only the animation is how a drill with tidy choreography
    // and a rambling coaching point still ships as a 49-second "Short".
    const video = videoDuration(drill, entry)
    if (video > MAX_VIDEO_SEC) {
      problems.push(
        `${slug}: video runs ${video.toFixed(1)}s, over the ${MAX_VIDEO_SEC}s budget ` +
          `(${animation.toFixed(1)}s of that is the animation — shorten the narration lines)`,
      )
    }
  }
}

if (problems.length) {
  console.error(`\n${problems.length} problem${problems.length === 1 ? '' : 's'} found:\n`)
  for (const problem of problems) console.error(`  ✗ ${problem}`)
  console.error('')
  process.exit(1)
}

const withMotion = entries.length
const withDiagrams = drills.filter(d => d.diagram?.shapes?.length).length
console.log(
  `✓ ${withMotion} motion ${withMotion === 1 ? 'entry' : 'entries'} valid ` +
    `(${withDiagrams - withMotion} drill${withDiagrams - withMotion === 1 ? '' : 's'} with a diagram still to do)`,
)
