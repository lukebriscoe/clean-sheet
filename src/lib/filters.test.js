import { describe, it, expect } from 'vitest'
import {
  EMPTY_FILTERS,
  applyFilters,
  matchesFilters,
  hasActiveFilters,
  toggleFacet,
  facetCounts,
} from './filters.js'

const drill = (overrides = {}) => ({
  name: 'Rondo 4v1',
  summary: 'Keep the ball away from one defender',
  coachingPoints: ['Open your body', 'Play the pass you can see'],
  themes: ['passing', 'possession'],
  ageGroups: ['u9', 'u10'],
  sessionPhase: 'technical',
  equipment: ['balls', 'cones', 'bibs'],
  minPlayers: 5,
  maxPlayers: 10,
  durationMins: 15,
  status: 'published',
  ...overrides,
})

const filters = (overrides = {}) => ({ ...EMPTY_FILTERS, ...overrides })

describe('applyFilters', () => {
  it('returns everything when no filters are set', () => {
    const drills = [drill(), drill({ name: 'Other' })]
    expect(applyFilters(drills, EMPTY_FILTERS)).toHaveLength(2)
  })

  it('excludes hidden drills even with no filters set', () => {
    expect(applyFilters([drill({ status: 'hidden' })], EMPTY_FILTERS)).toHaveLength(0)
  })
})

describe('query matching', () => {
  it('matches on name, summary and coaching points, case-insensitively', () => {
    expect(matchesFilters(drill(), filters({ query: 'RONDO' }))).toBe(true)
    expect(matchesFilters(drill(), filters({ query: 'away from' }))).toBe(true)
    expect(matchesFilters(drill(), filters({ query: 'open your body' }))).toBe(true)
  })

  it('requires every term to match, not just one', () => {
    expect(matchesFilters(drill(), filters({ query: 'rondo defender' }))).toBe(true)
    expect(matchesFilters(drill(), filters({ query: 'rondo shooting' }))).toBe(false)
  })
})

describe('facets', () => {
  it('ORs within a facet', () => {
    expect(matchesFilters(drill(), filters({ themes: ['shooting', 'passing'] }))).toBe(true)
    expect(matchesFilters(drill(), filters({ themes: ['shooting'] }))).toBe(false)
  })

  it('ANDs across facets', () => {
    expect(matchesFilters(drill(), filters({ themes: ['passing'], ageGroups: ['u10'] }))).toBe(true)
    expect(matchesFilters(drill(), filters({ themes: ['passing'], ageGroups: ['u6'] }))).toBe(false)
  })

  it('filters by session phase', () => {
    expect(matchesFilters(drill(), filters({ phases: ['technical'] }))).toBe(true)
    expect(matchesFilters(drill(), filters({ phases: ['warmup'] }))).toBe(false)
  })
})

describe('equipment is "what I have", not "what it uses"', () => {
  it('includes a drill whose kit is a subset of what the coach has', () => {
    expect(
      matchesFilters(drill(), filters({ equipment: ['balls', 'cones', 'bibs', 'goals'] })),
    ).toBe(true)
  })

  it('excludes a drill needing kit the coach did not select', () => {
    expect(matchesFilters(drill(), filters({ equipment: ['balls', 'cones'] }))).toBe(false)
  })

  it('treats "none" as needing nothing', () => {
    const noKit = drill({ equipment: ['none'] })
    expect(matchesFilters(noKit, filters({ equipment: ['balls'] }))).toBe(true)
  })
})

describe('squad size', () => {
  it('matches inside the drill range and fails outside it', () => {
    expect(matchesFilters(drill(), filters({ players: 8 }))).toBe(true)
    expect(matchesFilters(drill(), filters({ players: 4 }))).toBe(false)
    expect(matchesFilters(drill(), filters({ players: 14 }))).toBe(false)
  })

  it('ignores an absent bound rather than excluding the drill', () => {
    expect(matchesFilters(drill({ maxPlayers: null }), filters({ players: 30 }))).toBe(true)
  })
})

describe('maxDuration', () => {
  it('keeps drills at or under the cap', () => {
    expect(matchesFilters(drill(), filters({ maxDuration: 15 }))).toBe(true)
    expect(matchesFilters(drill(), filters({ maxDuration: 10 }))).toBe(false)
  })
})

describe('hasActiveFilters', () => {
  it('is false for the empty set and for whitespace-only queries', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false)
    expect(hasActiveFilters(filters({ query: '   ' }))).toBe(false)
  })

  it('is true once any facet is set', () => {
    expect(hasActiveFilters(filters({ themes: ['passing'] }))).toBe(true)
    expect(hasActiveFilters(filters({ players: 8 }))).toBe(true)
  })
})

describe('toggleFacet', () => {
  it('adds then removes a value', () => {
    const added = toggleFacet(EMPTY_FILTERS, 'themes', 'passing')
    expect(added.themes).toEqual(['passing'])
    expect(toggleFacet(added, 'themes', 'passing').themes).toEqual([])
  })

  it('leaves other facets untouched', () => {
    const start = filters({ ageGroups: ['u10'] })
    expect(toggleFacet(start, 'themes', 'passing').ageGroups).toEqual(['u10'])
  })
})

describe('facetCounts', () => {
  it('counts array fields and scalar fields alike', () => {
    const drills = [drill(), drill({ themes: ['passing'], sessionPhase: 'warmup' })]
    expect(facetCounts(drills, 'themes')).toEqual({ passing: 2, possession: 1 })
    expect(facetCounts(drills, 'sessionPhase')).toEqual({ technical: 1, warmup: 1 })
  })
})
