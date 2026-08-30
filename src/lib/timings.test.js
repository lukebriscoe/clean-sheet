import { describe, it, expect } from 'vitest'
import {
  totalMinutes,
  withRunningOrder,
  formatOffset,
  formatClock,
  formatDuration,
  durationStatus,
  blockProportions,
} from './timings.js'

const blocks = [
  { id: 'a', durationMins: 15 },
  { id: 'b', durationMins: 20 },
  { id: 'c', durationMins: 25 },
]

describe('totalMinutes', () => {
  it('sums durations', () => expect(totalMinutes(blocks)).toBe(60))
  it('treats missing or junk durations as zero', () => {
    expect(totalMinutes([{ durationMins: 10 }, {}, { durationMins: 'abc' }])).toBe(10)
  })
  it('handles no blocks', () => expect(totalMinutes([])).toBe(0))
})

describe('withRunningOrder', () => {
  it('accumulates start offsets', () => {
    expect(withRunningOrder(blocks).map(b => [b.startMin, b.endMin])).toEqual([
      [0, 15],
      [15, 35],
      [35, 60],
    ])
  })

  it('does not mutate the input blocks', () => {
    const input = [{ id: 'a', durationMins: 10 }]
    withRunningOrder(input)
    expect(input[0]).not.toHaveProperty('startMin')
  })

  it('keeps later blocks correct when an earlier one has no duration', () => {
    const order = withRunningOrder([{ durationMins: 10 }, {}, { durationMins: 5 }])
    expect(order.map(b => b.startMin)).toEqual([0, 10, 10])
  })
})

describe('formatOffset', () => {
  it('formats under and over an hour', () => {
    expect(formatOffset(0)).toBe('0:00')
    expect(formatOffset(35)).toBe('0:35')
    expect(formatOffset(95)).toBe('1:35')
  })
  it('clamps negatives rather than printing nonsense', () => {
    expect(formatOffset(-10)).toBe('0:00')
  })
})

describe('formatClock', () => {
  it('adds the offset to a wall-clock start', () => {
    expect(formatClock('18:30', 0)).toBe('18:30')
    expect(formatClock('18:30', 45)).toBe('19:15')
  })
  it('wraps past midnight', () => expect(formatClock('23:30', 45)).toBe('00:15'))
  it('returns null for missing or malformed start times', () => {
    expect(formatClock('', 10)).toBeNull()
    expect(formatClock(undefined, 10)).toBeNull()
    expect(formatClock('25:00', 10)).toBeNull()
    expect(formatClock('half six', 10)).toBeNull()
  })
})

describe('formatDuration', () => {
  it('renders minutes, hours, and both', () => {
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(60)).toBe('1 hr')
    expect(formatDuration(90)).toBe('1 hr 30 min')
  })
})

describe('durationStatus', () => {
  it('flags an empty session', () => {
    expect(durationStatus([], 90)).toMatchObject({ status: 'empty', remaining: 90 })
  })
  it('flags a short session with the shortfall', () => {
    expect(durationStatus(blocks, 90)).toMatchObject({ status: 'under', remaining: 30, diff: -30 })
  })
  it('flags an over-run', () => {
    expect(durationStatus(blocks, 45)).toMatchObject({ status: 'over', remaining: 15, diff: 15 })
  })
  it('allows a couple of minutes either side before complaining', () => {
    // 60 minutes are planned, so a target within 2 minutes of 60 is "on target".
    expect(durationStatus(blocks, 61).status).toBe('on-target')
    expect(durationStatus(blocks, 58).status).toBe('on-target')
    // Beyond the tolerance: a bigger target means time left to fill...
    expect(durationStatus(blocks, 65).status).toBe('under')
    // ...and a smaller one means the session over-runs.
    expect(durationStatus(blocks, 55).status).toBe('over')
  })
})

describe('blockProportions', () => {
  it('returns percentage shares that sum to 100', () => {
    const shares = blockProportions(blocks)
    expect(shares[0]).toBeCloseTo(25)
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(100)
  })
  it('returns zeros rather than dividing by zero', () => {
    expect(blockProportions([{ durationMins: 0 }])).toEqual([0])
  })
})
