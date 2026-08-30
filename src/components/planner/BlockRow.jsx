import { useState } from 'react'
import { PHASES, labelFor, LIMITS } from '../../lib/taxonomy.js'
import { Markdown } from '../ui/Bits.jsx'
import PitchDiagram from '../ui/PitchDiagram.jsx'
import TouchlineRail from './TouchlineRail.jsx'

/**
 * One block in the running order, hanging off the touchline rail.
 *
 * Reordering is up/down buttons rather than drag-and-drop, and they are 44px
 * targets: this gets used one-handed on a phone while holding a clipboard, where
 * touch drag is fiddly, hard to undo, and inaccessible to keyboard and screen
 * reader users alike.
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
    <li className="flex gap-2 px-2 py-3 sm:px-3">
      <TouchlineRail
        startMin={block.startMin}
        startTime={startTime}
        isFirst={isFirst}
        isLast={isLast && !expanded}
        isNow={isNow}
      />

      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <select
            value={block.phase}
            onChange={event => onUpdate(block.id, { phase: event.target.value })}
            aria-label="Part of the session"
            className="-ml-2 min-h-[2.75rem] rounded-md bg-transparent px-2 font-display text-[0.7rem] font-bold uppercase tracking-[0.08em] text-mist hover:bg-paper"
          >
            {PHASES.map(phase => (
              <option key={phase.key} value={phase.key}>
                {phase.label}
              </option>
            ))}
          </select>
          {isNow && (
            <span className="rounded-sm bg-hivis px-1.5 py-0.5 font-display text-[0.65rem] font-bold uppercase tracking-[0.08em] text-ink">
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
          <h3 className="mt-0.5 font-display text-lg font-bold leading-snug text-pitch">
            {snapshot.name}
          </h3>
        )}

        {snapshot.summary && <p className="mt-0.5 text-sm text-mist">{snapshot.summary}</p>}

        <div className="mt-2 flex flex-wrap items-center gap-1">
          <label className="flex items-center gap-1.5">
            <span className="label-sm">Mins</span>
            <input
              type="number"
              min="1"
              max="120"
              step="5"
              value={block.durationMins}
              onChange={event => onUpdate(block.id, { durationMins: Number(event.target.value) || 1 })}
              aria-label={`Duration of ${snapshot.name || 'this block'} in minutes`}
              className="tnum h-11 w-16 rounded-md border border-line bg-chalk px-2 text-center font-display font-bold focus:border-pitch focus:outline-none"
            />
          </label>

          <button
            type="button"
            onClick={() => setExpanded(open => !open)}
            aria-expanded={expanded}
            className="btn-quiet text-sm"
          >
            {expanded ? 'Less' : 'Details & notes'}
          </button>

          <div className="ml-auto flex items-center">
            <button
              type="button"
              onClick={() => onSetNow(isNow ? null : block.id)}
              aria-pressed={isNow}
              aria-label={isNow ? 'Clear the now marker' : `Mark ${snapshot.name || 'this block'} as now`}
              className={`btn-icon ${isNow ? 'text-pitch' : ''}`}
            >
              <span aria-hidden className="text-base">◉</span>
            </button>
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
              aria-label={`Remove ${snapshot.name || 'block'} from the session`}
              className="btn-icon hover:text-whistle"
            >
              <span aria-hidden>×</span>
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 space-y-4 border-t border-line pt-3">
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

            {!isFreeform && (
              <p className="text-xs text-mist">
                This is your own copy of <strong className="font-bold">{snapshot.name}</strong>.
                Editing the drill in the library later won&rsquo;t change this session.
              </p>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

export { labelFor }
