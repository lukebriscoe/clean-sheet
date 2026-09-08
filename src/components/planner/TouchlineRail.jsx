import { formatOffset, formatClock } from '../../lib/timings.js'

/**
 * The touchline rail — the signature element.
 *
 * A vertical line down the left of the running order with a boundary tick at the
 * head of each block, the way a pitch is marked out in yards. Times sit ON the
 * rail rather than beside it, so the session reads as a single continuous
 * measure of time rather than a stack of cards.
 *
 * It carries real information (when each block starts, which one is now, where
 * the session ends) and it survives into the print output — which is the point at
 * which it stops being a UI flourish and becomes the artefact a coach folds into
 * a coat pocket.
 *
 * Note on proportionality: block heights are driven by their content, so rail
 * segment length cannot honestly encode duration. Proportion is carried by the
 * horizontal <ShapeStrip> at the top of the planner instead.
 */
export default function TouchlineRail({
  startMin,
  startTime,
  isFirst,
  isLast,
  isNow,
  onToggleNow,
  blockName,
  durationMins,
}) {
  const clock = formatClock(startTime, startMin)
  const label = clock ?? formatOffset(startMin)

  // The time doubles as the "I'm on this one" control. Putting the target on the
  // rail rather than adding a button means the marker costs no extra chrome and
  // sits where the eye already is when you glance down mid-session. It stays a
  // plain <time> where there is nothing to toggle (the printed sheet).
  //
  // `durationMins` is passed on the read-only plan, where duration is a fact and
  // belongs under the clock it qualifies. The planner leaves it out: there the
  // duration is an editable field, and an <input> cannot live inside this button.
  const time = (
    <>
      <time className="clock w-full text-right">{label}</time>
      {durationMins != null && (
        <span className="clock-dur w-full text-right">{durationMins} min</span>
      )}
      {/* The chip sits here rather than above the drill name for two reasons:
          it lands beside the high-vis rail segment that is the actual marker,
          and above the name it added a line that knocked the clock out of
          alignment with the title on whichever block was current. It is the
          non-colour carrier of "now" — the bar alone would fail on paper and
          for a colourblind reader. */}
      {isNow && (
        <span className="no-print mt-1.5 inline-block rounded-sm bg-hivis px-1.5 py-0.5 font-display text-[0.75rem] font-bold leading-none text-ink">
          Now
        </span>
      )}
    </>
  )

  return (
    <div className="flex shrink-0 items-stretch gap-2 self-stretch">
      {/* .print-keep opts back out of the blanket `button { display: none }` in
          print.css — without it, making the time a control would silently strip
          the start times off the printed sheet. */}
      {onToggleNow ? (
        <button
          type="button"
          onClick={onToggleNow}
          aria-pressed={Boolean(isNow)}
          aria-label={
            isNow
              ? `${blockName || 'This block'} is marked as now. Tap to clear.`
              : `Mark ${blockName || 'this block'} as now`
          }
          className="print-keep w-[4.5rem] shrink-0 self-start rounded-md pb-3 pt-[0.1rem] hover:bg-paper sm:w-[5.25rem]"
        >
          {time}
        </button>
      ) : (
        <div className="w-[4.5rem] shrink-0 pt-[0.1rem] sm:w-[5.25rem]">{time}</div>
      )}
      <div
        className="rail-track"
        data-first={isFirst ? 'true' : undefined}
        data-last={isLast ? 'true' : undefined}
        data-now={isNow ? 'true' : undefined}
        aria-hidden
      >
        <span className="rail-minutes" />
        <span className="rail-tick" />
      </div>
    </div>
  )
}

/**
 * The end of the rail. Gives the session a finish line rather than letting the
 * last block just stop — the same way a pitch has a goal line.
 */
export function RailFinish({ totalMin, startTime, over = false }) {
  const clock = formatClock(startTime, totalMin)
  return (
    <div className="flex items-center gap-2 border-t border-line px-2 py-2.5 sm:px-3">
      <time className="tnum w-[4.5rem] text-right font-display text-[1.125rem] font-bold text-pitch sm:w-[5.25rem]">
        {clock ?? formatOffset(totalMin)}
      </time>
      <div className="w-3 shrink-0">
        <span className="mx-auto block h-[3px] w-3 bg-pitch" />
      </div>
      <span className={`text-[0.9375rem] font-bold ${over ? 'text-whistle' : 'text-mist'}`}>
        {over ? 'Over your target' : 'Finish'}
      </span>
    </div>
  )
}

/**
 * The shape of the session at a glance: one horizontal strip, one segment per
 * block, width proportional to duration. This is where proportionality lives —
 * a fat warm-up looks fat before you read a word.
 *
 * Drawn as pitch-marking values (greens on paper) with a single high-vis segment
 * for the block a coach is on, rather than a chart-style multi-hue bar.
 */
export function ShapeStrip({ blocks, targetMins, nowId = null }) {
  const total = blocks.reduce((sum, b) => sum + (Number(b.durationMins) || 0), 0)
  const target = Number(targetMins) || 0
  const scale = Math.max(total, target) || 1

  return (
    <div>
      <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-sm bg-paper">
        {blocks.map((block, index) => {
          const width = ((Number(block.durationMins) || 0) / scale) * 100
          const isNow = nowId === block.id
          return (
            <span
              key={block.id}
              style={{ width: `${width}%` }}
              title={`${block.drillSnapshot?.name ?? 'Block'}, ${block.durationMins} min`}
              className={
                isNow
                  ? 'bg-hivis'
                  : index % 2 === 0
                    ? 'bg-pitch'
                    : 'bg-pitch-mid'
              }
            />
          )
        })}
        {total < target && (
          <span
            style={{ width: `${((target - total) / scale) * 100}%` }}
            className="border border-dashed border-line bg-transparent"
          />
        )}
      </div>
    </div>
  )
}
