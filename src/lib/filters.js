// Library filtering happens client-side, on purpose.
//
// Firestore charges per document read and cannot combine several array-contains
// clauses with range filters in one query anyway. A drill library of a few hundred
// entries is a couple of hundred KB — so we fetch once, cache, and filter in memory.
// That also makes the filters instant and keeps the app usable on a flaky
// touchline connection. Revisit if the library ever passes ~1000 drills.

export const EMPTY_FILTERS = {
  query: '',
  themes: [],
  ageGroups: [],
  equipment: [],
  phases: [],
  players: null, // squad size the coach actually has tonight
  maxDuration: null,
}

/** Is any filter actually narrowing the list? Drives the "clear all" affordance. */
export function hasActiveFilters(filters) {
  return (
    Boolean(filters.query.trim()) ||
    filters.themes.length > 0 ||
    filters.ageGroups.length > 0 ||
    filters.equipment.length > 0 ||
    filters.phases.length > 0 ||
    filters.players != null ||
    filters.maxDuration != null
  )
}

/** Toggle a value in one of the multi-select facets. */
export function toggleFacet(filters, facet, value) {
  const current = filters[facet] ?? []
  return {
    ...filters,
    [facet]: current.includes(value) ? current.filter(v => v !== value) : [...current, value],
  }
}

function matchesQuery(drill, query) {
  if (!query) return true
  // Search the fields a coach would actually search by. Deliberately not the full
  // description — matching a stray word in prose produces confusing results.
  const haystack = [drill.name, drill.summary, ...(drill.coachingPoints ?? [])]
    .join(' ')
    .toLowerCase()
  return query.split(/\s+/).every(term => haystack.includes(term))
}

/**
 * Multi-select facets are OR within a facet, AND across facets — "passing OR
 * dribbling, that also works for U10". That's what coaches expect from filters
 * even though it isn't stated anywhere.
 */
function matchesAny(selected, values = []) {
  return selected.length === 0 || selected.some(value => values.includes(value))
}

export function matchesFilters(drill, filters) {
  if (drill.status === 'hidden') return false
  if (!matchesQuery(drill, filters.query.trim().toLowerCase())) return false
  if (!matchesAny(filters.themes, drill.themes)) return false
  if (!matchesAny(filters.ageGroups, drill.ageGroups)) return false
  if (!matchesAny(filters.phases, [drill.sessionPhase])) return false

  // Equipment is the inverse of the other facets: selecting "cones, balls" means
  // "show me what I can run with ONLY these", not "anything using cones". A coach
  // filters by kit because of what's in the boot of their car.
  if (filters.equipment.length > 0) {
    const needed = (drill.equipment ?? []).filter(item => item !== 'none')
    if (!needed.every(item => filters.equipment.includes(item))) return false
  }

  if (filters.players != null) {
    const count = Number(filters.players)
    if (drill.minPlayers != null && count < drill.minPlayers) return false
    if (drill.maxPlayers != null && count > drill.maxPlayers) return false
  }

  if (filters.maxDuration != null && (drill.durationMins ?? 0) > Number(filters.maxDuration)) {
    return false
  }

  return true
}

export function applyFilters(drills = [], filters = EMPTY_FILTERS) {
  return drills.filter(drill => matchesFilters(drill, filters))
}

/** Counts per facet value, for showing "Passing (7)" next to each option. */
export function facetCounts(drills = [], key) {
  const counts = {}
  for (const drill of drills) {
    const values = Array.isArray(drill[key]) ? drill[key] : [drill[key]]
    for (const value of values) {
      if (value == null) continue
      counts[value] = (counts[value] ?? 0) + 1
    }
  }
  return counts
}
