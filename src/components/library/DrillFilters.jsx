import { AGE_GROUPS, THEMES, PHASES, EQUIPMENT, labelFor } from '../../lib/taxonomy.js'
import { toggleFacet, hasActiveFilters, facetCounts, EMPTY_FILTERS } from '../../lib/filters.js'
import { Chip } from '../ui/Bits.jsx'

/** How many facets are actually narrowing the list. */
export function activeFilterCount(filters) {
  return (
    filters.themes.length +
    filters.ageGroups.length +
    filters.phases.length +
    filters.equipment.length +
    (filters.players != null ? 1 : 0) +
    (filters.maxDuration != null ? 1 : 0)
  )
}

/**
 * The filter bar.
 *
 * On a phone this is search plus a single Filters button, and nothing else. The
 * previous version showed seven chips inline, which came to 270px of a 844px
 * screen — the first drill started 605px down and only two were visible, so
 * finding anything meant scrolling past the controls every time.
 *
 * Desktop keeps the quick chips inline, where there is room for them and they
 * save a tap.
 */
export function QuickFilters({ filters, onChange, drills, resultCount, moreOpen, onToggleMore }) {
  const counts = {
    themes: facetCounts(drills, 'themes'),
    ageGroups: facetCounts(drills, 'ageGroups'),
  }
  const topThemes = THEMES.slice(0, 4)
  const commonAges = AGE_GROUPS.filter(age => ['u9', 'u10', 'u11'].includes(age.key))
  const active = activeFilterCount(filters)

  // Each active facet, as something you can tap to clear individually.
  const activeChips = [
    ...filters.themes.map(k => ({ key: `t-${k}`, label: labelFor('theme', k), clear: () => onChange(toggleFacet(filters, 'themes', k)) })),
    ...filters.ageGroups.map(k => ({ key: `a-${k}`, label: labelFor('ageGroup', k), clear: () => onChange(toggleFacet(filters, 'ageGroups', k)) })),
    ...filters.phases.map(k => ({ key: `p-${k}`, label: labelFor('phase', k), clear: () => onChange(toggleFacet(filters, 'phases', k)) })),
    ...filters.equipment.map(k => ({ key: `e-${k}`, label: labelFor('equipment', k), clear: () => onChange(toggleFacet(filters, 'equipment', k)) })),
    ...(filters.players != null ? [{ key: 'players', label: `${filters.players} players`, clear: () => onChange({ ...filters, players: null }) }] : []),
    ...(filters.maxDuration != null ? [{ key: 'dur', label: `under ${filters.maxDuration} min`, clear: () => onChange({ ...filters, maxDuration: null }) }] : []),
  ]

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search drills</span>
          {/* Not "Search 69 drills" — that counted the whole library while the
              number beside it counts what survived the filters, so the two
              contradicted each other the moment anything was selected. */}
          <input
            type="search"
            value={filters.query}
            onChange={event => onChange({ ...filters, query: event.target.value })}
            placeholder="Search drills…"
            className="field"
          />
        </label>

        <button
          type="button"
          onClick={onToggleMore}
          aria-expanded={moreOpen}
          className={`${active > 0 || moreOpen ? 'chip-on' : 'chip-off'} shrink-0 font-semibold`}
        >
          Filters
          {active > 0 && <span className="tnum">{active}</span>}
          <span aria-hidden>{moreOpen ? '↑' : '↓'}</span>
        </button>
      </div>

      {/* Quick chips are a desktop convenience only. */}
      <div className="hidden flex-wrap items-center gap-1.5 lg:flex">
        {topThemes.map(theme => (
          <Chip
            key={theme.key}
            active={filters.themes.includes(theme.key)}
            count={counts.themes[theme.key]}
            onClick={() => onChange(toggleFacet(filters, 'themes', theme.key))}
          >
            {theme.label}
          </Chip>
        ))}
        {commonAges.map(age => (
          <Chip
            key={age.key}
            active={filters.ageGroups.includes(age.key)}
            count={counts.ageGroups[age.key]}
            onClick={() => onChange(toggleFacet(filters, 'ageGroups', age.key))}
          >
            {age.label}
          </Chip>
        ))}
        <span className="tnum ml-auto text-sm text-mist">{resultCount}</span>
      </div>

      {/* What is currently on, and a one-tap way to take each one off. */}
      {active > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 lg:hidden">
          {activeChips.map(chip => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              aria-label={`Remove filter: ${chip.label}`}
              className="inline-flex min-h-[2rem] items-center gap-1.5 rounded-md border border-pitch bg-pitch px-2.5 text-xs text-chalk"
            >
              {chip.label}
              <span aria-hidden className="text-sm leading-none">×</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="min-h-[2rem] px-1 text-xs font-semibold text-mist underline underline-offset-2"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}

/** The full facet set, revealed by "More filters". */
export default function DrillFilters({ filters, onChange, drills }) {
  const counts = {
    themes: facetCounts(drills, 'themes'),
    ageGroups: facetCounts(drills, 'ageGroups'),
    phases: facetCounts(drills, 'sessionPhase'),
  }

  const Group = ({ legend, children }) => (
    <fieldset>
      <legend className="label-sm mb-2">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </fieldset>
  )

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Group legend="Theme">
          {THEMES.map(theme => (
            <Chip
              key={theme.key}
              active={filters.themes.includes(theme.key)}
              count={counts.themes[theme.key]}
              onClick={() => onChange(toggleFacet(filters, 'themes', theme.key))}
            >
              {theme.label}
            </Chip>
          ))}
        </Group>

        <Group legend="Age group">
          {AGE_GROUPS.map(age => (
            <Chip
              key={age.key}
              active={filters.ageGroups.includes(age.key)}
              count={counts.ageGroups[age.key]}
              onClick={() => onChange(toggleFacet(filters, 'ageGroups', age.key))}
            >
              {age.label}
            </Chip>
          ))}
        </Group>
      </div>

      <Group legend="Part of the session">
        {PHASES.map(phase => (
          <Chip
            key={phase.key}
            active={filters.phases.includes(phase.key)}
            count={counts.phases[phase.key]}
            title={phase.hint}
            onClick={() => onChange(toggleFacet(filters, 'phases', phase.key))}
          >
            {phase.label}
          </Chip>
        ))}
      </Group>

      <Group legend="Kit you have with you">
        {EQUIPMENT.filter(item => item.key !== 'none').map(item => (
          <Chip
            key={item.key}
            active={filters.equipment.includes(item.key)}
            onClick={() => onChange(toggleFacet(filters, 'equipment', item.key))}
          >
            {item.label}
          </Chip>
        ))}
        {filters.equipment.length > 0 && (
          <p className="mt-1.5 w-full text-xs text-mist">
            Showing only drills you can run with exactly this kit.
          </p>
        )}
      </Group>

      <div className="flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="label-sm mb-1.5 block">Players tonight</span>
          <input
            type="number"
            min="1"
            max="40"
            value={filters.players ?? ''}
            placeholder="Any"
            onChange={event =>
              onChange({ ...filters, players: event.target.value ? Number(event.target.value) : null })
            }
            className="field w-28"
          />
        </label>
        <label className="block">
          <span className="label-sm mb-1.5 block">Max minutes</span>
          <input
            type="number"
            min="1"
            max="120"
            step="5"
            value={filters.maxDuration ?? ''}
            placeholder="Any"
            onChange={event =>
              onChange({
                ...filters,
                maxDuration: event.target.value ? Number(event.target.value) : null,
              })
            }
            className="field w-28"
          />
        </label>

        {hasActiveFilters(filters) && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="btn-quiet ml-auto"
          >
            Clear all filters
          </button>
        )}
      </div>
    </div>
  )
}
