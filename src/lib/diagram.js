// Drill diagrams are stored as data, not images.
//
// A football drill diagram is a small set of primitives on a marked area: cones,
// players, balls, goals, zones, and three kinds of arrow. Storing that as a shapes
// array rather than a PNG means the diagram costs a few hundred bytes inside a
// document we're already writing, renders as vector (so it prints crisply at A4),
// carries its own alt text, works offline, and can be reviewed in a pull request.
//
// DESIGN RULE: shape carries the meaning, colour is decoration.
// Team A is a filled circle, team B is an outlined circle, cones are triangles.
// Nothing depends on colour to be understood — which is what makes the print
// stylesheet (everything black on white) and colourblind readers work for free.

/**
 * Authoring coordinates are always 0–100 on both axes, whatever the real pitch
 * dimensions. The renderer scales the *positions* to the area's aspect ratio and
 * leaves the shape sizes alone, so a 30×20 grid renders wide without turning the
 * players into ovals.
 */
export const SHAPE_TYPES = [
  'player', // { team: 'a' | 'b' | 'n', label? }  n = neutral / coach / keeper
  'cone',
  'ball',
  'goal', //  { facing?: 'up' | 'down' | 'left' | 'right' }
  'gate', //  a pair of cones to pass or dribble through
  'zone', //  { w, h, label? } — end zones, channels, target areas
  'pass', //  { from: [x,y], to: [x,y] } — dashed arrow
  'run', //   solid arrow
  'dribble', // wavy arrow
  'label',
]

const TEAMS = ['a', 'b', 'n']

/** Aspect ratio of the drawn box, clamped so extreme pitches stay readable. */
export function diagramHeight(area) {
  const w = Number(area?.w) || 1
  const h = Number(area?.h) || 1
  return Math.min(150, Math.max(45, Math.round((h / w) * 100)))
}

const num = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const clamp01 = value => Math.min(100, Math.max(0, num(value)))

const point = pair =>
  Array.isArray(pair) && pair.length === 2 ? [clamp01(pair[0]), clamp01(pair[1])] : null

/**
 * Normalise a stored diagram into something the renderer can trust. Community and
 * AI-authored drills go through here, so it drops anything malformed rather than
 * throwing — a bad shape should cost you that shape, not the whole drill page.
 */
export function normaliseDiagram(diagram) {
  if (!diagram || typeof diagram !== 'object') return null

  const shapes = (Array.isArray(diagram.shapes) ? diagram.shapes : [])
    .map(shape => {
      if (!shape || !SHAPE_TYPES.includes(shape.t)) return null

      if (shape.t === 'pass' || shape.t === 'run' || shape.t === 'dribble') {
        const from = point(shape.from)
        const to = point(shape.to)
        return from && to ? { t: shape.t, from, to } : null
      }

      if (shape.t === 'zone') {
        return {
          t: 'zone',
          x: clamp01(shape.x),
          y: clamp01(shape.y),
          w: Math.min(100, Math.max(1, num(shape.w, 20))),
          h: Math.min(100, Math.max(1, num(shape.h, 20))),
          label: shape.label ? String(shape.label).slice(0, 24) : null,
        }
      }

      const base = { t: shape.t, x: clamp01(shape.x), y: clamp01(shape.y) }
      if (shape.t === 'player') {
        return {
          ...base,
          team: TEAMS.includes(shape.team) ? shape.team : 'a',
          label: shape.label ? String(shape.label).slice(0, 3) : null,
        }
      }
      if (shape.t === 'goal') return { ...base, facing: shape.facing ?? 'up' }
      if (shape.t === 'gate') return { ...base, angle: num(shape.angle, 0) }
      if (shape.t === 'label') {
        const text = String(shape.text ?? '').trim().slice(0, 40)
        return text ? { ...base, text } : null
      }
      return base
    })
    .filter(Boolean)
    .slice(0, 60) // a diagram past this is unreadable anyway

  if (!shapes.length) return null

  return {
    area: {
      w: Math.min(120, Math.max(1, num(diagram.area?.w, 20))),
      h: Math.min(120, Math.max(1, num(diagram.area?.h, 20))),
      unit: diagram.area?.unit === 'm' ? 'm' : 'yd',
    },
    shapes,
    caption: diagram.caption ? String(diagram.caption).slice(0, 160) : null,
  }
}

/** "A 20 × 20 yard area" — the dimension line under the diagram. */
export function areaLabel(area) {
  if (!area) return ''
  return `${area.w} × ${area.h} ${area.unit}`
}

/**
 * A sentence describing the diagram, for screen readers and for the printed page
 * if images ever fail. Built from the same data, so it can never drift out of sync
 * with what's drawn — which is the main reason this beats shipping a PNG.
 */
export function describeDiagram(diagram, drillName = 'the drill') {
  const d = normaliseDiagram(diagram)
  if (!d) return ''

  const counts = {}
  for (const shape of d.shapes) {
    const key =
      shape.t === 'player' ? `player-${shape.team}` : shape.t
    counts[key] = (counts[key] ?? 0) + 1
  }

  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
  const parts = []

  const teamA = counts['player-a'] ?? 0
  const teamB = counts['player-b'] ?? 0
  const neutral = counts['player-n'] ?? 0
  if (teamA) parts.push(plural(teamA, 'attacking player'))
  if (teamB) parts.push(plural(teamB, 'defending player'))
  if (neutral) parts.push(plural(neutral, 'neutral player'))
  if (counts.cone) parts.push(plural(counts.cone, 'cone'))
  if (counts.gate) parts.push(plural(counts.gate, 'cone gate'))
  if (counts.ball) parts.push(plural(counts.ball, 'ball'))
  if (counts.goal) parts.push(plural(counts.goal, 'goal'))
  if (counts.zone) parts.push(plural(counts.zone, 'marked zone'))

  const movement = []
  if (counts.pass) movement.push(plural(counts.pass, 'pass'))
  if (counts.run) movement.push(plural(counts.run, 'run'))
  if (counts.dribble) movement.push(plural(counts.dribble, 'dribble'))

  let text = `Diagram for ${drillName}: a ${areaLabel(d.area)} area`
  if (parts.length) text += ` with ${joinList(parts)}`
  if (movement.length) text += `. Arrows show ${joinList(movement)}`
  return `${text}.`
}

function joinList(items) {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** Blank diagram for the editor. A 20×20 grid is the most common drill shape. */
export function emptyDiagram() {
  return { area: { w: 20, h: 20, unit: 'yd' }, shapes: [], caption: null }
}
