import { AGE_GROUPS, THEMES, PHASES, EQUIPMENT } from '../../lib/taxonomy.js'
import { toggleFacet, hasActiveFilters, facetCounts, EMPTY_FILTERS } from '../../lib/filters.js'
import { Chip } from '../ui/Bits.jsx'

/**
 * The one-line filter bar: search plus the three facets a coach uses every time.
 * Everything else lives behind "More filters" so the bar stays a single line on a
 * phone rather than becoming a wall of chips above the results.
 */
export function QuickFilters({
  filters,
  onChange,
  drills,
  resultCount,
  moreOpen,
  onToggleMore,
}) {
  const counts = {
    themes: facetCounts(drills, 'themes'),
    ageGroups: facetCounts(drills, 'ageGroups'),
  }
  const topThemes = THEMES.slice(0, 4)
  const commonAges = AGE_GROUPS.filter(age => ['u9', 'u10', 'u11'].includes(age.key))

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative min-w-[12rem] flex-1">
        <span className="sr-only">Search drills</span>
        <input
          type="search"
          value={filters.query}
          onChange={event => onChange({ ...filters, query: event.target.value })}
          placeholder="Search drills…"
          className="field"
        />
      </label>

      <div className="flex flex-wrap items-center gap-1.5">
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
      </div>

      <button
        type="button"
        onClick={onToggleMore}
        aria-expanded={moreOpen}
        className="chip-off font-semibold"
      >
        {moreOpen ? 'Fewer filters' : 'More filters'}
        <span aria-hidden>{moreOpen ? '↑' : '↓'}</span>
      </button>

      <span className="tnum ml-auto text-sm text-mist">{resultCount}</span>
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
