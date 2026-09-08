import { labelFor } from '../../lib/taxonomy.js'
import { formatDuration } from '../../lib/timings.js'
import { PhaseMark } from '../ui/Bits.jsx'

/**
 * One drill in the library, as a full-width row.
 *
 * Rows rather than a grid of shadowed cards: it reads like a team sheet or a
 * fixture list, which is how a coach actually scans for one thing among thirty.
 * It is also far better one-handed on a phone — a full-width target instead of a
 * third of a row — and it sidesteps the dashboard-of-cards look that belongs to
 * any SaaS product rather than to this one.
 */
export default function DrillRow({ drill, onOpen, onAdd, isAdded }) {
  return (
    <li className="group flex items-start gap-3 border-b border-line px-3 py-3 transition-colors duration-[120ms] last:border-b-0 hover:bg-paper sm:px-4">
      {/* Phase marker, tying the row back to the rail in the planner. */}
      <span className="flex w-1 shrink-0 justify-center pt-1.5">
        <PhaseMark phase={drill.sessionPhase} />
      </span>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onOpen(drill)}
          className="block w-full text-left"
        >
          <span className="font-display text-[1.125rem] font-bold leading-snug text-pitch underline-offset-4 group-hover:underline">
            {drill.name}
          </span>
          <span className="measure-tight mt-0.5 block text-[0.9375rem] leading-snug text-mist">
            {drill.summary}
          </span>
        </button>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] text-mist">
          {/* Duration leads the meta line on a phone, where the right-hand column
              is hidden. When you are filling a 90-minute session it is the most
              decision-relevant number on the row, so hiding it on the device this
              is built for was the wrong trade. The phase label gives up its slot
              to make room — PhaseMark and the row grouping already carry it. */}
          <span className="tnum font-bold text-ink sm:hidden">
            {formatDuration(drill.durationMins)}
          </span>
          <span className="hidden font-semibold sm:inline">
            {labelFor('phase', drill.sessionPhase)}
          </span>
          <span className="tnum">
            {drill.minPlayers}–{drill.maxPlayers} players
          </span>
          <span className="tnum">{summariseAges(drill.ageGroups)}</span>
          {drill.diagram && <span>diagram</span>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 pt-0.5">
        <span className="tnum hidden w-16 text-right font-display text-sm font-bold text-ink sm:block">
          {formatDuration(drill.durationMins)}
        </span>
        {/* The tick reports that the drill is already in the session; it does not
            block adding it again. Coaches genuinely run the same rondo as a
            warm-up and again as a re-set, and a disabled button made that
            impossible while looking like mere feedback. */}
        <button
          type="button"
          onClick={() => onAdd(drill)}
          aria-label={
            isAdded
              ? `${drill.name} is in your session. Add it again.`
              : `Add ${drill.name} to your session`
          }
          className={
            isAdded
              ? 'btn-icon border border-pitch/30 bg-paper text-pitch-mid'
              : 'btn-icon border border-line bg-chalk text-pitch hover:border-pitch/40'
          }
        >
          <span aria-hidden className="text-lg leading-none">{isAdded ? '✓' : '+'}</span>
        </button>
      </div>
    </li>
  )
}

/** "U9–U11" beats a wall of nine labels on a dense row. */
function summariseAges(ages = []) {
  if (!ages.length) return 'Any age'
  const labels = ages.map(age => labelFor('ageGroup', age))
  if (labels.length === 1) return labels[0]
  if (labels.length >= 8) return 'All ages'
  return `${labels[0]}–${labels[labels.length - 1]}`
}
