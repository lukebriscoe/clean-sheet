// Session timings are always DERIVED, never stored. A block knows how long it
// lasts; where it falls in the session is a function of everything before it.
// That way reordering or retiming a block can never leave stale start times behind.

/** Total minutes across all blocks. */
export function totalMinutes(blocks = []) {
  return blocks.reduce((sum, block) => sum + (Number(block.durationMins) || 0), 0)
}

/**
 * Annotate each block with its running-order position.
 * Returns [{ ...block, startMin, endMin, index }] — offsets in minutes from kick-off.
 */
export function withRunningOrder(blocks = []) {
  let elapsed = 0
  return blocks.map((block, index) => {
    const duration = Number(block.durationMins) || 0
    const entry = { ...block, index, startMin: elapsed, endMin: elapsed + duration }
    elapsed += duration
    return entry
  })
}

/** "0:00", "1:35" — elapsed time from kick-off. */
export function formatOffset(minutes) {
  const safe = Math.max(0, Math.round(Number(minutes) || 0))
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}

/**
 * Wall-clock time of an offset, given a "HH:MM" start time.
 * Returns null when no start time is set — the session view then falls back to
 * showing elapsed offsets instead.
 */
export function formatClock(startTime, offsetMins) {
  if (!/^\d{1,2}:\d{2}$/.test(startTime ?? '')) return null
  const [hours, mins] = startTime.split(':').map(Number)
  if (hours > 23 || mins > 59) return null
  const total = (hours * 60 + mins + Math.round(offsetMins)) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** "1 hr 30 min", "45 min" — for headings and cards. */
export function formatDuration(minutes) {
  const safe = Math.max(0, Math.round(Number(minutes) || 0))
  const hours = Math.floor(safe / 60)
  const mins = safe % 60
  if (!hours) return `${mins} min`
  if (!mins) return `${hours} hr`
  return `${hours} hr ${mins} min`
}

/**
 * How the planned blocks compare to the coach's target duration.
 * `status` is 'empty' | 'under' | 'on-target' | 'over'.
 * A couple of minutes either way is not worth nagging about, so 'on-target'
 * has a small tolerance.
 */
export function durationStatus(blocks, targetMins, toleranceMins = 2) {
  const planned = totalMinutes(blocks)
  const target = Number(targetMins) || 0
  const diff = planned - target

  if (!blocks.length) return { status: 'empty', planned, target, diff: -target, remaining: target }
  if (Math.abs(diff) <= toleranceMins) {
    return { status: 'on-target', planned, target, diff, remaining: 0 }
  }
  return {
    status: diff > 0 ? 'over' : 'under',
    planned,
    target,
    diff,
    remaining: Math.abs(diff),
  }
}

/** Share of the session each block occupies — drives the timeline bar widths. */
export function blockProportions(blocks = []) {
  const total = totalMinutes(blocks)
  if (!total) return blocks.map(() => 0)
  return blocks.map(block => ((Number(block.durationMins) || 0) / total) * 100)
}
