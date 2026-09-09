// The shot list: how a drill becomes ~45 seconds of vertical video.
//
// A Short has to earn its first two seconds, so the drill name lands immediately,
// the pitch is set up before anything moves, and the call to action is last.
// Everything here is derived from the drill and its motion — no per-drill timing
// is stored anywhere, same rule as timings.js and motion.js.

import { totalDuration, speechDuration, readingDuration } from '../src/lib/motion.js'

/** Fixed scene lengths in seconds. `play` is however long the animation runs. */
const TITLE_SEC = 2
const SETUP_MIN_SEC = 3
const POINTS_MIN_SEC = 3.5
const END_SEC = 2.5

/**
 * ONE coaching point, not a list.
 *
 * A Short is a trailer for the drill, not a replacement for its page — the full
 * set of coaching points is a tap away in the library. Two points read aloud ran
 * to twelve seconds on their own, which is nearly half the budget for a scene
 * nobody watches twice.
 */
export const MAX_POINTS = 1

/**
 * What a Short gets. YouTube allows three minutes; attention allows far less,
 * and a drill that cannot be shown in half a minute is one the video should be
 * teasing rather than teaching.
 */
export const MAX_VIDEO_SEC = 30

/** The line under the drill name. Kept here so the video and its title agree. */
export function subtitle(drill) {
  const ages = drill.ageGroups ?? []
  const range = ages.length
    ? `${ages[0].toUpperCase()}–${ages[ages.length - 1].toUpperCase()}`
    : 'All ages'
  return `${range} · ${drill.durationMins} minutes`
}

/** The narration read over the setup shot. */
export function setupLine(drill) {
  return drill.summary ?? ''
}

/** At most two coaching points, because more will not be read. */
export function coachingPoints(drill) {
  return (drill.coachingPoints ?? []).filter(Boolean).slice(0, MAX_POINTS)
}

/**
 * The scene list, each annotated with where it falls on the clock.
 * Returns [{ kind, startSec, durSec, endSec }] — seconds from the first frame.
 *
 * Scenes carrying narration are stretched to fit the words, exactly as motion
 * steps are, so nothing is ever cut off mid-sentence.
 */
export function composition(drill, motion) {
  const shapes = drill.diagram?.shapes ?? []
  const points = coachingPoints(drill)

  // Only the setup line and the play beats are narrated (they are what makes up
  // `motion.script`). Everything else is text on screen, so it is paced at
  // reading speed — pacing it at speaking speed is what made the first cut run
  // to 49 seconds.
  const lengths = [
    ['title', Math.max(TITLE_SEC, readingDuration(drill.name))],
    ['setup', Math.max(SETUP_MIN_SEC, speechDuration(setupLine(drill)))],
    ['play', totalDuration(motion, shapes)],
    ['points', Math.max(POINTS_MIN_SEC, readingDuration(points.join(' ')))],
    ['end', END_SEC],
  ]

  let elapsed = 0
  return lengths.map(([kind, durSec]) => {
    const scene = { kind, startSec: elapsed, durSec, endSec: elapsed + durSec }
    elapsed = scene.endSec
    return scene
  })
}

/** Total video length in seconds. */
export function videoDuration(drill, motion) {
  const scenes = composition(drill, motion)
  return scenes.length ? scenes[scenes.length - 1].endSec : 0
}

/**
 * Which scene is on screen at time `t`, and how far into it we are.
 * `progress` is 0–1 through the scene, for fades and reveals.
 */
export function sceneAt(drill, motion, t) {
  const now = Math.max(0, Number(t) || 0)
  const scenes = composition(drill, motion)

  for (const scene of scenes) {
    if (now < scene.endSec) {
      return {
        ...scene,
        localSec: now - scene.startSec,
        progress: scene.durSec > 0 ? (now - scene.startSec) / scene.durSec : 1,
      }
    }
  }

  const last = scenes[scenes.length - 1]
  return { ...last, localSec: last.durSec, progress: 1 }
}
