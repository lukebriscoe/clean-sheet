// Drill motion is stored as data, not as a video — the same argument diagram.js
// makes for shapes, extended by one axis.
//
// A diagram is the starting frame. Motion adds a list of steps on top: at each
// step some players and balls move somewhere, then everything holds still while
// the narrator catches up. Everything else about the drill is already in the
// diagram, so a motion entry is a few hundred bytes and reviews as a JSON diff.
//
// DESIGN RULE: durations are derived from distance, never stored.
// A move's length is a function of how far the shape travels, so every player on
// every drill moves at the same speed and nobody has to hand-tune seconds. This
// mirrors the rule in timings.js — store the facts, compute the clock.

/**
 * Movement speed in viewBox units per second. Coordinates are 0–100 across the
 * area whatever its real size, so this is "fraction of the pitch per second"
 * rather than yards — a tight grid and a full pitch both read at the same pace.
 */
const SPEED = 26

/** Even a tiny adjustment gets this long, or short moves flicker past. */
const MIN_MOVE = 0.35

/**
 * Narration pace, words per second, for text that is SPOKEN ALOUD.
 * Brisk but clear — Shorts are watched at pace, and a slower read pushes a
 * drill past the 30 seconds these are budgeted for.
 */
const WORDS_PER_SEC = 3.0

/**
 * Pace for text that is only ever READ ON SCREEN, never narrated.
 * Silent reading is far quicker than speech, so pacing a caption card at
 * speaking speed leaves it sitting there long after it has been read. Getting
 * this wrong is what made the first cut of these videos twice as long as it
 * needed to be.
 */
const READING_WORDS_PER_SEC = 5.5

/** Breathing room either side of a line, in seconds. */
const SPEECH_PADDING = 0.3

/** A shape has to be one of these to be worth animating. */
const MOVABLE = ['player', 'ball']

const num = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const clamp01 = value => Math.min(100, Math.max(0, num(value)))

const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1])

/**
 * Smoothstep. Players accelerate and settle rather than snapping to a constant
 * velocity, which is the difference between "animated diagram" and "clip art
 * sliding about". Cheap, and it reads as intent rather than as a transition.
 */
export function ease(progress) {
  const p = Math.min(1, Math.max(0, progress))
  return p * p * (3 - 2 * p)
}

/** Starting coordinate of a shape, as [x, y]. Null for shapes that can't move. */
export function shapeOrigin(shape) {
  if (!shape || !MOVABLE.includes(shape.t)) return null
  return [clamp01(shape.x), clamp01(shape.y)]
}

/**
 * How long a line of narration takes to say out loud.
 *
 * The timeline is narration-locked: a step never ends before its line has been
 * spoken. Without this a step's length depends only on how far players run, so
 * a short move with a long sentence flashes the caption past and desyncs the
 * voiceover — and the fix would be hand-tuning `hold` on every step, which is
 * exactly the kind of derived number this codebase refuses to store.
 */
export function speechDuration(say) {
  return paceOf(say, WORDS_PER_SEC)
}

/**
 * How long a viewer needs to READ a line that is never spoken — a title card,
 * a coaching point held on screen. Use this and not speechDuration for anything
 * outside the narration, or the video pays for words nobody is saying.
 */
export function readingDuration(text) {
  return paceOf(text, READING_WORDS_PER_SEC)
}

function paceOf(text, wordsPerSec) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean).length
  return words ? words / wordsPerSec + SPEECH_PADDING : 0
}

/**
 * How long one step takes: its movement plus its hold, or the time needed to
 * speak its line — whichever is longer.
 *
 * Moves within a step run concurrently — a pass and the run onto it are one
 * beat, not two — so the movement is as long as its slowest mover.
 */
export function stepDuration(step, shapes = []) {
  const moves = Array.isArray(step?.moves) ? step.moves : []
  let longest = 0

  for (const move of moves) {
    const from = shapeOrigin(shapes[move?.ref])
    if (!from || !Array.isArray(move.to)) continue
    const travel = distance(from, [clamp01(move.to[0]), clamp01(move.to[1])])
    longest = Math.max(longest, Math.max(MIN_MOVE, travel / SPEED))
  }

  return Math.max(longest + Math.max(0, num(step?.hold)), speechDuration(step?.say))
}

/**
 * Annotate each step with where it falls on the clock.
 * Returns [{ ...step, index, startSec, moveSec, holdSec, endSec }] — seconds
 * from the start of the animation.
 *
 * Note this walks positions forward as it goes: step 3's move starts from
 * wherever step 2 left the shape, not from its diagram origin.
 */
export function withTimeline(motion, shapes = []) {
  const steps = Array.isArray(motion?.steps) ? motion.steps : []
  const positions = new Map()
  let elapsed = 0

  return steps.map((step, index) => {
    const moves = (Array.isArray(step.moves) ? step.moves : [])
      .map(move => {
        const origin = positions.get(move?.ref) ?? shapeOrigin(shapes[move?.ref])
        if (!origin || !Array.isArray(move.to)) return null
        const to = [clamp01(move.to[0]), clamp01(move.to[1])]
        return { ref: move.ref, carry: move.carry ?? null, from: origin, to }
      })
      .filter(Boolean)

    let moveSec = 0
    for (const move of moves) {
      moveSec = Math.max(moveSec, Math.max(MIN_MOVE, distance(move.from, move.to) / SPEED))
      positions.set(move.ref, move.to)
    }

    // The hold absorbs any narration overhang, so movement always animates at
    // its natural speed and only the still time stretches to fit the words.
    const holdSec = Math.max(Math.max(0, num(step.hold)), speechDuration(step.say) - moveSec)
    const entry = {
      ...step,
      moves,
      index,
      startSec: elapsed,
      moveSec,
      holdSec,
      endSec: elapsed + moveSec + holdSec,
    }
    elapsed = entry.endSec
    return entry
  })
}

/** Total seconds of animation. */
export function totalDuration(motion, shapes = []) {
  const timeline = withTimeline(motion, shapes)
  return timeline.length ? timeline[timeline.length - 1].endSec : 0
}

/**
 * Every shape's position at time `t`, as [x, y] indexed the same as `shapes`.
 *
 * This is the whole renderer contract: frame N is a pure function of the motion
 * data and nothing else. No clock, no requestAnimationFrame, no CSS transition —
 * which is what lets Playwright screenshot frames out of order and still get a
 * reproducible video.
 */
export function positionsAt(motion, shapes = [], t) {
  const positions = shapes.map(shapeOrigin)
  const timeline = withTimeline(motion, shapes)
  const now = Math.max(0, num(t))

  for (const step of timeline) {
    if (now <= step.startSec) break

    // How far through this step's movement are we? Past the move and into the
    // hold, this pins at 1 and the shape simply sits at its destination.
    const progress = step.moveSec > 0
      ? ease(Math.min(1, (now - step.startSec) / step.moveSec))
      : 1

    for (const move of step.moves) {
      const x = move.from[0] + (move.to[0] - move.from[0]) * progress
      const y = move.from[1] + (move.to[1] - move.from[1]) * progress
      positions[move.ref] = [x, y]

      // A carried ball keeps its offset from the player rather than sitting
      // under them — the diagram vocabulary draws them as separate marks, and
      // overlapping the two makes both unreadable.
      //
      // The offset is measured against where the player started *this* step, so
      // it survives across steps: the ball was left at (previous destination +
      // offset), and move.from is that same previous destination.
      if (move.carry != null) {
        const ball = positions[move.carry]
        if (ball) {
          positions[move.carry] = [
            x + (ball[0] - move.from[0]),
            y + (ball[1] - move.from[1]),
          ]
        }
      }
    }
  }

  return positions
}

/**
 * The narration line that should be on screen at time `t`, or null.
 * Captions are burned in, so this is also what the caption track renders.
 */
export function captionAt(motion, shapes = [], t) {
  const now = Math.max(0, num(t))
  for (const step of withTimeline(motion, shapes)) {
    if (now >= step.startSec && now < step.endSec) return step.say ?? null
  }
  return null
}

/** Frame number to seconds. Kept here so the fps lives in one place. */
export function frameToTime(frame, fps = 24) {
  return Math.max(0, num(frame)) / Math.max(1, num(fps, 24))
}

/** How many frames an animation needs at a given rate. */
export function frameCount(motion, shapes = [], fps = 24) {
  return Math.ceil(totalDuration(motion, shapes) * Math.max(1, num(fps, 24)))
}

export { MOVABLE, SPEED, MIN_MOVE }
