import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PHASES, labelFor } from '../../lib/taxonomy.js'
import { applyFilters, EMPTY_FILTERS } from '../../lib/filters.js'
import { formatDuration } from '../../lib/timings.js'
import { Spinner } from '../ui/Bits.jsx'

/**
 * Add blocks without leaving the planner.
 *
 * Defaults to whichever phase the session is missing, because the most common
 * next action is "I've got a warm-up and a game, I need something in between".
 */
export default function BlockPicker({
  drills,
  loading,
  session,
  onAddDrill,
  onAddFreeform,
  // 'panel' is the desktop right-hand rail; 'sheet' is the mobile bottom sheet,
  // which supplies its own surface, heading and scroll container.
  variant = 'panel',
}) {
  const inSheet = variant === 'sheet'
  const navigate = useNavigate()
  const usedPhases = useMemo(
    () => new Set(session.blocks.map(block => block.phase)),
    [session.blocks],
  )
  const suggestedPhase = PHASES.find(phase => !usedPhases.has(phase.key))?.key ?? 'technical'

  const [phase, setPhase] = useState(suggestedPhase)
  const [query, setQuery] = useState('')

  const inSession = useMemo(
    () => new Set(session.blocks.map(block => block.drillId).filter(Boolean)),
    [session.blocks],
  )

  // Match the session's age group and squad size by default — a coach in the
  // planner has already told us both, so making them re-filter is busywork.
  const matches = useMemo(
    () =>
      applyFilters(drills, {
        ...EMPTY_FILTERS,
        query,
        phases: [phase],
        ageGroups: session.ageGroup ? [session.ageGroup] : [],
        players: session.playerCount || null,
      }),
    [drills, query, phase, session.ageGroup, session.playerCount],
  )

  return (
    <div className={inSheet ? '' : 'surface no-print p-5'}>
      {!inSheet && <h2 className="font-display text-xl font-bold">Add to the session</h2>}
      <p className={`text-sm text-mist ${inSheet ? '' : 'mt-1'}`}>
        Showing drills that suit {labelFor('ageGroup', session.ageGroup)} and{' '}
        {session.playerCount} players.
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {PHASES.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => setPhase(item.key)}
            title={item.hint}
            aria-pressed={phase === item.key}
            className={phase === item.key ? 'chip-on' : 'chip-off'}
          >
            {item.label}
            {/* aria-label on a bare <span> has no role to attach to and is not
                reliably exposed; visually-hidden text always is. */}
            {usedPhases.has(item.key) && (
              <>
                <span aria-hidden>✓</span>
                <span className="sr-only">— already in the session</span>
              </>
            )}
          </button>
        ))}
      </div>

      <input
        type="search"
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder="Search within these…"
        aria-label="Search drills"
        className="field mt-3"
      />

      {/* In the sheet the dialog itself scrolls — a second scroll container
          inside it traps the flick and is miserable on a phone. */}
      <div className={`mt-4 space-y-2 ${inSheet ? '' : 'max-h-96 overflow-y-auto pr-1'}`}>
        {loading ? (
          <Spinner label="Loading drills" />
        ) : matches.length === 0 ? (
          <div className="rounded border border-dashed border-line px-4 py-6 text-center">
            <p className="text-sm text-mist">
              No {labelFor('phase', phase).toLowerCase()} drills match that for{' '}
              {labelFor('ageGroup', session.ageGroup)} with {session.playerCount} players.
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => onAddFreeform(phase)} className="btn-ghost text-sm">
                Add your own instead
              </button>
              <button type="button" onClick={() => navigate('/library')} className="btn-quiet">
                Browse the full library →
              </button>
            </div>
          </div>
        ) : (
          matches.map(drill => {
            const added = inSession.has(drill.id)
            return (
              <button
                key={drill.id}
                type="button"
                onClick={() => onAddDrill(drill)}
                aria-label={added ? `${drill.name} is in your session. Add it again.` : undefined}
                className="flex min-h-[2.75rem] w-full items-center gap-3 rounded-md border border-line bg-paper px-3 py-2 text-left transition-colors duration-[120ms] hover:border-pitch/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-pitch">{drill.name}</div>
                  <div className="truncate text-xs text-mist">{drill.summary}</div>
                </div>
                <span className="shrink-0 tnum text-xs text-mist">
                  {formatDuration(drill.durationMins)}
                </span>
                <span className="shrink-0 tnum text-sm text-pitch-mid">{added ? '✓' : '+'}</span>
              </button>
            )
          })
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
        <button type="button" onClick={() => onAddFreeform(phase)} className="btn-ghost text-sm">
          + Add your own activity
        </button>
        <button type="button" onClick={() => navigate('/library')} className="btn-quiet">
          Browse full library →
        </button>
      </div>
    </div>
  )
}
