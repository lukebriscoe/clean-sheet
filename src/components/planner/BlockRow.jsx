import { useState } from 'react'
import { PHASES, labelFor, LIMITS } from '../../lib/taxonomy.js'
import { Markdown } from '../ui/Bits.jsx'
import PitchDiagram from '../ui/PitchDiagram.jsx'
import TouchlineRail from './TouchlineRail.jsx'

/**
 * One block in the running order, hanging off the touchline rail.
 *
 * The collapsed row carries the three things done most often: change the
 * duration, reorder, remove. Tapping the drill name expands the detail — that
 * frees the action row for a proper 44px remove button, which had ended up
 * buried in the detail panel where nobody could find it.
 *
 * Reordering is up/down buttons rather than drag: this is used one-handed while
 * holding a clipboard, where touch drag is fiddly, hard to undo, and
 * inaccessible to keyboard and screen reader users alike.
 */
export default function BlockRow({
  block,
  startTime,
  isFirst,
  isLast,
  isNow,
  onUpdate,
  onUpdateSnapshot,
  onMove,
  onRemove,
  onSetNow,
}) {
  const [expanded, setExpanded] = useState(false)
  const snapshot = block.drillSnapshot ?? {}
  const isFreeform = !block.drillId

  return (
    <li className="flex gap-2 px-2 py-2.5 sm:px-3 sm:py-3">
      <TouchlineRail
        startMin={block.startMin}
        startTime={startTime}
        isFirst={isFirst}
        isLast={isLast && !expanded}
        isNow={isNow}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="label-sm truncate">{labelFor('phase', block.phase)}</span>
          {isNow && (
            <span className="shrink-0 rounded-sm bg-hivis px-1.5 py-0.5 font-display text-[0.65rem] font-bold uppercase tracking-[0.08em] text-ink">
              Now
            </span>
          )}
        </div>

        {isFreeform ? (
          <input
            value={snapshot.name}
            onChange={event => onUpdateSnapshot(block.id, { name: event.target.value })}
            placeholder="Name this activity…"
            aria-label="Activity name"
            className="mt-0.5 w-full rounded border border-dashed border-line bg-transparent px-2 py-1 font-display text-lg font-bold text-pitch focus:border-pitch focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setExpanded(open => !open)}
            aria-expanded={expanded}
            className="mt-0.5 flex w-full items-start gap-1.5 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[1.05rem] font-bold leading-snug text-pitch">
                {snapshot.name}
              </span>
              {snapshot.summary && (
                <span className="mt-0.5 line-clamp-2 block text-sm leading-snug text-mist">
                  {snapshot.summary}
                </span>
              )}
            </span>
            <span
              aria-hidden
              className={`mt-1 shrink-0 text-mist transition-transform duration-[120ms] ${expanded ? 'rotate-180' : ''}`}
            >
              ⌄
            </span>
          </button>
        )}

        {/* One row, always — four controls fit inside 300px of usable width. */}
        <div className="mt-1.5 flex items-center gap-1">
          <label className="flex shrink-0 items-center gap-1.5">
            <span className="sr-only">Minutes</span>
            <input
              type="number"
              min="1"
              max="120"
              step="5"
              value={block.durationMins}
              onChange={event => onUpdate(block.id, { durationMins: Number(event.target.value) || 1 })}
              aria-label={`Duration of ${snapshot.name || 'this block'} in minutes`}
              className="tnum h-11 w-14 rounded-md border border-line bg-chalk px-1 text-center font-display font-bold focus:border-pitch focus:outline-none"
            />
            <span aria-hidden className="label-sm">min</span>
          </label>

          <div className="ml-auto flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => onMove(block.id, -1)}
              disabled={isFirst}
              aria-label={`Move ${snapshot.name || 'block'} earlier`}
              className="btn-icon"
            >
              <span aria-hidden>↑</span>
            </button>
            <button
              type="button"
              onClick={() => onMove(block.id, 1)}
              disabled={isLast}
              aria-label={`Move ${snapshot.name || 'block'} later`}
              className="btn-icon"
            >
              <span aria-hidden>↓</span>
            </button>
            <button
              type="button"
              onClick={() => onRemove(block.id)}
              aria-label={`Remove ${snapshot.name || 'this block'} from the session`}
              className="btn-icon hover:bg-whistle/10 hover:text-whistle"
            >
              <span aria-hidden className="text-lg leading-none">×</span>
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 space-y-4 border-t border-line pt-3">
            {/* Rare and destructive actions live here, off the main row. */}
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1">
                <span className="label-sm mb-1.5 block">Part of the session</span>
                <select
                  value={block.phase}
                  onChange={event => onUpdate(block.id, { phase: event.target.value })}
                  className="field"
                >
                  {PHASES.map(phase => (
                    <option key={phase.key} value={phase.key}>
                      {phase.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => onSetNow(isNow ? null : block.id)}
                aria-pressed={isNow}
                className={isNow ? 'btn-primary shrink-0' : 'btn-ghost shrink-0'}
              >
                {isNow ? 'Clear now' : 'Mark as now'}
              </button>
            </div>

            {isFreeform ? (
              <label className="block">
                <span className="label-sm mb-1.5 block">What happens</span>
                <textarea
                  value={snapshot.description}
                  onChange={event => onUpdateSnapshot(block.id, { description: event.target.value })}
                  placeholder="Describe the activity so the other coaches know what to run."
                  className="field min-h-[5rem] resize-y text-sm"
                />
              </label>
            ) : (
              <>
                {snapshot.diagram && (
                  <PitchDiagram diagram={snapshot.diagram} drillName={snapshot.name} />
                )}
                {snapshot.setup && (
                  <section>
                    <h4 className="label-sm mb-1.5">Setting it up</h4>
                    <Markdown source={snapshot.setup} />
                  </section>
                )}
                {snapshot.coachingPoints?.length > 0 && (
                  <section>
                    <h4 className="label-sm mb-1.5">Coaching points</h4>
                    <ul className="space-y-1.5">
                      {snapshot.coachingPoints.map((point, index) => (
                        <li key={index} className="flex gap-2 text-sm leading-snug">
                          <span aria-hidden className="font-bold text-pitch-mid">→</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}

            <label className="block">
              <span className="label-sm mb-1.5 block">Your notes for tonight</span>
              <textarea
                value={block.notes}
                maxLength={LIMITS.notes}
                onChange={event => onUpdate(block.id, { notes: event.target.value })}
                placeholder="e.g. Only 9 turned up — shrink the area and drop a defender."
                className="field min-h-[3.5rem] resize-y text-sm"
              />
            </label>
          </div>
        )}
      </div>
    </li>
  )
}
