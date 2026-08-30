import { describe, it, expect } from 'vitest'
import { normaliseDiagram, describeDiagram, diagramHeight, areaLabel } from './diagram.js'

const rondo = {
  area: { w: 10, h: 10, unit: 'yd' },
  shapes: [
    { t: 'player', team: 'a', x: 50, y: 8 },
    { t: 'player', team: 'a', x: 92, y: 50 },
    { t: 'player', team: 'b', x: 50, y: 50 },
    { t: 'ball', x: 50, y: 14 },
    { t: 'pass', from: [50, 14], to: [86, 48] },
  ],
}

describe('normaliseDiagram', () => {
  it('passes a well-formed diagram through', () => {
    const d = normaliseDiagram(rondo)
    expect(d.shapes).toHaveLength(5)
    expect(d.area).toEqual({ w: 10, h: 10, unit: 'yd' })
  })

  it('returns null for junk rather than throwing', () => {
    expect(normaliseDiagram(null)).toBeNull()
    expect(normaliseDiagram('nope')).toBeNull()
    expect(normaliseDiagram({})).toBeNull()
    expect(normaliseDiagram({ shapes: [] })).toBeNull()
  })

  // The whole point of normalising: community and AI-authored drills come through
  // here, and one bad shape must not cost the coach the entire drill page.
  it('drops unknown shape types but keeps the good ones', () => {
    const d = normaliseDiagram({
      area: { w: 10, h: 10 },
      shapes: [{ t: 'player', team: 'a', x: 10, y: 10 }, { t: 'wormhole', x: 5, y: 5 }],
    })
    expect(d.shapes).toHaveLength(1)
    expect(d.shapes[0].t).toBe('player')
  })

  it('drops arrows with a missing or malformed endpoint', () => {
    const d = normaliseDiagram({
      area: { w: 10, h: 10 },
      shapes: [
        { t: 'cone', x: 1, y: 1 },
        { t: 'pass', from: [0, 0] },
        { t: 'run', from: [0, 0], to: [1] },
        { t: 'run', from: 'somewhere', to: [1, 1] },
      ],
    })
    expect(d.shapes).toHaveLength(1)
  })

  it('clamps coordinates into the 0–100 box', () => {
    const d = normaliseDiagram({
      area: { w: 10, h: 10 },
      shapes: [{ t: 'cone', x: -40, y: 400 }],
    })
    expect(d.shapes[0]).toMatchObject({ x: 0, y: 100 })
  })

  it('defaults a bad team to attacker rather than dropping the player', () => {
    const d = normaliseDiagram({
      area: { w: 10, h: 10 },
      shapes: [{ t: 'player', team: 'purple', x: 10, y: 10 }],
    })
    expect(d.shapes[0].team).toBe('a')
  })

  it('caps the shape count so one document cannot render forever', () => {
    const many = Array.from({ length: 200 }, (_, i) => ({ t: 'cone', x: i % 100, y: 10 }))
    expect(normaliseDiagram({ area: { w: 10, h: 10 }, shapes: many }).shapes).toHaveLength(60)
  })

  it('drops empty labels but keeps real ones', () => {
    const d = normaliseDiagram({
      area: { w: 10, h: 10 },
      shapes: [
        { t: 'label', x: 5, y: 5, text: '   ' },
        { t: 'label', x: 5, y: 5, text: 'fast' },
      ],
    })
    expect(d.shapes).toHaveLength(1)
    expect(d.shapes[0].text).toBe('fast')
  })

  it('falls back to yards for an unrecognised unit', () => {
    expect(normaliseDiagram({ area: { w: 10, h: 10, unit: 'furlongs' }, shapes: [{ t: 'cone', x: 1, y: 1 }] }).area.unit).toBe('yd')
    expect(normaliseDiagram({ area: { w: 10, h: 10, unit: 'm' }, shapes: [{ t: 'cone', x: 1, y: 1 }] }).area.unit).toBe('m')
  })
})

describe('diagramHeight', () => {
  it('is square for a square area', () => expect(diagramHeight({ w: 20, h: 20 })).toBe(100))
  it('is short for a wide area', () => expect(diagramHeight({ w: 40, h: 20 })).toBe(50))
  it('clamps extremes so nothing renders as a sliver or a tower', () => {
    expect(diagramHeight({ w: 100, h: 1 })).toBe(45)
    expect(diagramHeight({ w: 1, h: 100 })).toBe(150)
  })
  it('survives a missing area', () => expect(diagramHeight(undefined)).toBe(100))
})

describe('describeDiagram', () => {
  // The alt text is generated from the same data that gets drawn, so it can never
  // drift out of sync with the picture — the main reason this beats shipping a PNG.
  it('describes the contents in a readable sentence', () => {
    const alt = describeDiagram(rondo, 'Rondo 4v1')
    expect(alt).toContain('Rondo 4v1')
    expect(alt).toContain('10 × 10 yd')
    expect(alt).toContain('2 attacking players')
    expect(alt).toContain('1 defending player')
    expect(alt).toContain('1 pass')
  })

  it('returns an empty string when there is no diagram', () => {
    expect(describeDiagram(null)).toBe('')
  })

  it('reads naturally with one item and with several', () => {
    const one = describeDiagram({ area: { w: 5, h: 5 }, shapes: [{ t: 'cone', x: 1, y: 1 }] })
    expect(one).toContain('1 cone')
    expect(one).not.toContain('and')

    const several = describeDiagram({
      area: { w: 5, h: 5 },
      shapes: [
        { t: 'cone', x: 1, y: 1 },
        { t: 'ball', x: 2, y: 2 },
        { t: 'player', team: 'a', x: 3, y: 3 },
      ],
    })
    expect(several).toMatch(/1 attacking player, 1 cone and 1 ball/)
  })
})

describe('areaLabel', () => {
  it('formats dimensions', () => expect(areaLabel({ w: 20, h: 15, unit: 'yd' })).toBe('20 × 15 yd'))
  it('is blank with no area', () => expect(areaLabel(null)).toBe(''))
})
