import { describe, it, expect } from 'vitest'
import {
  ease,
  shapeOrigin,
  readingDuration,
  speechDuration,
  stepDuration,
  withTimeline,
  totalDuration,
  positionsAt,
  captionAt,
  frameToTime,
  frameCount,
  SPEED,
  MIN_MOVE,
} from './motion.js'

// A player with a ball four units down-right of them, plus a cone that must
// never move. Mirrors the shape of a real seed diagram.
const shapes = [
  { t: 'player', team: 'a', x: 20, y: 20 },
  { t: 'ball', x: 24, y: 24 },
  { t: 'cone', x: 50, y: 50 },
]

/** A move long enough that its duration is distance-driven, not the floor. */
const longMove = { ref: 0, to: [72, 20] } // 52 units → 2s at SPEED 26

describe('ease', () => {
  it('pins to the endpoints', () => {
    expect(ease(0)).toBe(0)
    expect(ease(1)).toBe(1)
  })
  it('is symmetrical about the midpoint', () => expect(ease(0.5)).toBe(0.5))
  it('clamps out-of-range input rather than overshooting', () => {
    expect(ease(-3)).toBe(0)
    expect(ease(9)).toBe(1)
  })
  it('starts slower than linear', () => expect(ease(0.25)).toBeLessThan(0.25))
})

describe('shapeOrigin', () => {
  it('returns coordinates for movable shapes', () => {
    expect(shapeOrigin(shapes[0])).toEqual([20, 20])
    expect(shapeOrigin(shapes[1])).toEqual([24, 24])
  })

  it('refuses shapes that cannot move', () => {
    expect(shapeOrigin(shapes[2])).toBeNull()
    expect(shapeOrigin({ t: 'zone', x: 1, y: 1 })).toBeNull()
    expect(shapeOrigin(undefined)).toBeNull()
  })

  it('clamps coordinates into the 0-100 space', () => {
    expect(shapeOrigin({ t: 'player', x: -20, y: 500 })).toEqual([0, 100])
  })
})

describe('stepDuration', () => {
  it('derives movement time from distance', () => {
    expect(stepDuration({ moves: [longMove], hold: 0 }, shapes)).toBeCloseTo(52 / SPEED)
  })

  it('adds the hold on top of the movement', () => {
    const moving = stepDuration({ moves: [longMove], hold: 0 }, shapes)
    expect(stepDuration({ moves: [longMove], hold: 1.5 }, shapes)).toBeCloseTo(moving + 1.5)
  })

  it('takes the longest move — concurrent moves are one beat', () => {
    const step = { moves: [longMove, { ref: 1, to: [26, 24] }], hold: 0 }
    expect(stepDuration(step, shapes)).toBeCloseTo(52 / SPEED)
  })

  it('gives tiny moves a floor so they do not flicker past', () => {
    expect(stepDuration({ moves: [{ ref: 0, to: [21, 20] }] }, shapes)).toBe(MIN_MOVE)
  })

  it('is just the hold when nothing moves', () => {
    expect(stepDuration({ moves: [], hold: 2 }, shapes)).toBe(2)
  })

  it('ignores moves pointing at a shape that cannot move', () => {
    expect(stepDuration({ moves: [{ ref: 2, to: [10, 10] }], hold: 1 }, shapes)).toBe(1)
  })

  it('survives a malformed step rather than throwing', () => {
    expect(stepDuration(undefined, shapes)).toBe(0)
    expect(stepDuration({ moves: 'nonsense', hold: 'abc' }, shapes)).toBe(0)
  })
})

describe('withTimeline', () => {
  const motion = {
    steps: [
      { say: 'first', moves: [longMove], hold: 1 },
      { say: 'second', moves: [], hold: 2 },
    ],
  }

  it('lays steps end to end', () => {
    const [a, b] = withTimeline(motion, shapes)
    expect(a.startSec).toBe(0)
    expect(a.endSec).toBeCloseTo(52 / SPEED + 1)
    expect(b.startSec).toBeCloseTo(a.endSec)
    expect(b.endSec).toBeCloseTo(a.endSec + 2)
  })

  it('starts each move from where the previous step left the shape', () => {
    const chained = {
      steps: [
        { moves: [{ ref: 0, to: [72, 20] }] },
        { moves: [{ ref: 0, to: [72, 60] }] },
      ],
    }
    const [, second] = withTimeline(chained, shapes)
    expect(second.moves[0].from).toEqual([72, 20])
  })

  it('drops moves referencing an unmovable or missing shape', () => {
    const bad = { steps: [{ moves: [{ ref: 2, to: [1, 1] }, { ref: 99, to: [1, 1] }] }] }
    expect(withTimeline(bad, shapes)[0].moves).toEqual([])
  })

  it('does not mutate the input steps', () => {
    const input = { steps: [{ moves: [longMove], hold: 1 }] }
    withTimeline(input, shapes)
    expect(input.steps[0]).not.toHaveProperty('startSec')
  })

  it('handles motion with no steps', () => {
    expect(withTimeline({}, shapes)).toEqual([])
    expect(withTimeline(undefined, shapes)).toEqual([])
  })
})

describe('totalDuration', () => {
  it('is the end of the last step', () => {
    const motion = { steps: [{ moves: [], hold: 1 }, { moves: [], hold: 2.5 }] }
    expect(totalDuration(motion, shapes)).toBe(3.5)
  })

  it('is zero for empty motion', () => expect(totalDuration({ steps: [] }, shapes)).toBe(0))
})

describe('positionsAt', () => {
  const motion = { steps: [{ moves: [longMove], hold: 1 }] }

  it('is the diagram at time zero', () => {
    expect(positionsAt(motion, shapes, 0)).toEqual([[20, 20], [24, 24], null])
  })

  it('leaves unmovable shapes null throughout', () => {
    expect(positionsAt(motion, shapes, 1)[2]).toBeNull()
  })

  it('lands exactly on the destination once the move is done', () => {
    const [player] = positionsAt(motion, shapes, 52 / SPEED)
    expect(player[0]).toBeCloseTo(72)
    expect(player[1]).toBeCloseTo(20)
  })

  it('holds the destination through the hold and beyond the end', () => {
    expect(positionsAt(motion, shapes, 999)[0][0]).toBeCloseTo(72)
  })

  it('is partway along midway through the move', () => {
    const [player] = positionsAt(motion, shapes, 52 / SPEED / 2)
    expect(player[0]).toBeGreaterThan(20)
    expect(player[0]).toBeLessThan(72)
  })

  it('is a pure function of time — frame order cannot matter', () => {
    const t = 1.1
    expect(positionsAt(motion, shapes, t)).toEqual(positionsAt(motion, shapes, t))
  })

  it('treats negative time as the start', () => {
    expect(positionsAt(motion, shapes, -5)).toEqual(positionsAt(motion, shapes, 0))
  })

  describe('carried balls', () => {
    const carried = { steps: [{ moves: [{ ...longMove, carry: 1 }], hold: 0 }] }

    it('keeps the ball offset from the player rather than under them', () => {
      const [player, ball] = positionsAt(carried, shapes, 52 / SPEED)
      expect(ball[0] - player[0]).toBeCloseTo(4)
      expect(ball[1] - player[1]).toBeCloseTo(4)
    })

    it('preserves the offset across consecutive steps', () => {
      const twoSteps = {
        steps: [
          { moves: [{ ref: 0, to: [72, 20], carry: 1 }] },
          { moves: [{ ref: 0, to: [72, 60], carry: 1 }] },
        ],
      }
      const [player, ball] = positionsAt(twoSteps, shapes, totalDuration(twoSteps, shapes))
      expect(player).toEqual([72, 60])
      expect(ball[0] - player[0]).toBeCloseTo(4)
      expect(ball[1] - player[1]).toBeCloseTo(4)
    })

    it('moves the ball in step with the player mid-move', () => {
      const [player, ball] = positionsAt(carried, shapes, 1)
      expect(ball[0] - player[0]).toBeCloseTo(4)
    })
  })
})

describe('captionAt', () => {
  const motion = {
    steps: [
      { say: 'Everyone starts with a ball.', moves: [], hold: 2 },
      { say: 'Now dribble into space.', moves: [], hold: 2 },
    ],
  }

  // Derived, not hardcoded — step length is narration-locked, so a boundary
  // written as a literal would silently drift with the words.
  const boundary = withTimeline(motion, shapes)[0].endSec

  it('returns the line for the step in progress', () => {
    expect(captionAt(motion, shapes, 0)).toBe('Everyone starts with a ball.')
    expect(captionAt(motion, shapes, boundary + 0.1)).toBe('Now dribble into space.')
  })

  it('switches exactly on the step boundary', () => {
    expect(captionAt(motion, shapes, boundary - 0.01)).toBe('Everyone starts with a ball.')
    expect(captionAt(motion, shapes, boundary)).toBe('Now dribble into space.')
  })

  it('holds each line long enough to actually say it', () => {
    for (const step of withTimeline(motion, shapes)) {
      // Tolerance because the hold is computed as (speech - move) and then
      // re-added to move, which does not round-trip exactly in binary floats.
      expect(step.endSec - step.startSec).toBeGreaterThanOrEqual(speechDuration(step.say) - 1e-9)
    }
  })

  it('returns null past the end', () => {
    expect(captionAt(motion, shapes, 99)).toBeNull()
  })

  it('returns null for a step with no narration', () => {
    expect(captionAt({ steps: [{ moves: [], hold: 1 }] }, shapes, 0)).toBeNull()
  })
})

describe('readingDuration', () => {
  const line = 'Head up between touches, can you see the space before you move into it?'

  it('is quicker than saying the same words out loud', () => {
    // The distinction that matters: a caption card nobody narrates should not
    // sit on screen for as long as it would take to read it aloud. Getting this
    // backwards is what made the first cut of these videos twice as long as it
    // needed to be.
    expect(readingDuration(line)).toBeLessThan(speechDuration(line))
  })

  it('scales with word count', () => {
    expect(readingDuration('Stop the ball.')).toBeLessThan(readingDuration(line))
  })

  it('is zero when there is nothing to read', () => {
    expect(readingDuration('')).toBe(0)
    expect(readingDuration(null)).toBe(0)
    expect(readingDuration(undefined)).toBe(0)
  })
})

describe('speechDuration', () => {
  it('scales with word count', () => {
    const short = speechDuration('Stop the ball.')
    const long = speechDuration('Stop the ball dead with the sole of your foot, then look up.')
    expect(long).toBeGreaterThan(short)
  })

  it('is zero when there is nothing to say', () => {
    expect(speechDuration('')).toBe(0)
    expect(speechDuration('   ')).toBe(0)
    expect(speechDuration(null)).toBe(0)
    expect(speechDuration(undefined)).toBe(0)
  })

  it('stretches a step whose hold is too short for its line', () => {
    const rushed = { steps: [{ say: 'Stop the ball dead with the sole of your foot.', hold: 0.1 }] }
    expect(totalDuration(rushed, shapes)).toBeCloseTo(speechDuration(rushed.steps[0].say))
  })

  it('leaves a generous hold alone', () => {
    const roomy = { steps: [{ say: 'Go.', hold: 8 }] }
    expect(totalDuration(roomy, shapes)).toBe(8)
  })

  it('lets movement run at its natural speed, stretching only the hold', () => {
    const [step] = withTimeline({ steps: [{ say: 'Dribble at speed into the space.', moves: [longMove] }] }, shapes)
    expect(step.moveSec).toBeCloseTo(52 / SPEED)
    expect(step.endSec).toBeCloseTo(speechDuration('Dribble at speed into the space.'))
  })
})

describe('frame helpers', () => {
  it('converts frames to seconds at the given rate', () => {
    expect(frameToTime(24, 24)).toBe(1)
    expect(frameToTime(12, 24)).toBe(0.5)
    expect(frameToTime(0, 24)).toBe(0)
  })

  it('defaults to 24fps', () => expect(frameToTime(24)).toBe(1))

  it('never divides by zero', () => expect(Number.isFinite(frameToTime(10, 0))).toBe(true))

  it('covers the whole animation, rounding up', () => {
    const motion = { steps: [{ moves: [], hold: 2.1 }] }
    expect(frameCount(motion, shapes, 24)).toBe(51)
    expect(frameToTime(frameCount(motion, shapes, 24), 24)).toBeGreaterThanOrEqual(2.1)
  })
})
