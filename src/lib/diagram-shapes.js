// The shape vocabulary, as pure geometry.
//
// Extracted from PitchDiagram.jsx so the video renderer (render/) draws players,
// cones and goals from exactly the same maths as the on-page diagrams. Two
// surfaces drawing the same marks by eye is how they drift, and the drift would
// only ever show up in a finished video.
//
// DESIGN RULE, restated because this module is where it is enforced:
// shape carries the meaning, colour is decoration. Team A is a filled circle,
// team B an outlined one, neutral a dashed outline, a cone is a triangle, a ball
// is a ring with a centre dot. Nothing here may depend on colour to be read —
// that is what makes the print stylesheet and colourblind readers work for free,
// and what will make these videos legible with the sound off.
//
// Every function takes coordinates that are ALREADY SCALED into viewBox space.
// Callers do their own y-scaling, because the two surfaces scale differently.

/** Player radius, in viewBox units. Constant regardless of area aspect ratio. */
export const PLAYER_R = 3.2

/** Ball ring radius, and the centre dot inside it. */
export const BALL_R = 2
export const BALL_DOT_R = 0.7

/** A cone: a triangle, which reads as a cone at any size and needs no colour. */
export function conePath(x, y) {
  return `M${x},${y - 2.6} L${x + 2.3},${y + 1.8} L${x - 2.3},${y + 1.8} z`
}

/** A gate: two cones with a gap, the thing you pass or dribble through. */
export function gatePaths(x, y) {
  return [
    `M${x - 4},${y - 2.6} l2.3,4.4 l-4.6,0 z`,
    `M${x + 4},${y - 2.6} l2.3,4.4 l-4.6,0 z`,
  ]
}

/**
 * A goal: posts as well as a goal line, so it reads as a goal rather than a
 * stray dash. The stubs point into the pitch.
 */
export function goalPath(x, y, facing = 'up') {
  const into = facing === 'down' ? -1 : facing === 'up' ? 1 : 0
  const side = facing === 'right' ? -1 : facing === 'left' ? 1 : 0
  const half = 7
  const depth = 2.6

  return into
    ? `M${x - half},${y + into * depth} L${x - half},${y} L${x + half},${y} L${x + half},${y + into * depth}`
    : `M${x + side * depth},${y - half} L${x},${y - half} L${x},${y + half} L${x + side * depth},${y + half}`
}

/** A dribble arrow: a sine wave along the line, which is how coaches draw it. */
export function wavyPath(x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.hypot(dx, dy)
  if (length < 1) return `M${x1},${y1} L${x2},${y2}`

  // Unit vector along the line, and its perpendicular.
  const ux = dx / length
  const uy = dy / length
  const px = -uy
  const py = ux

  const waves = Math.max(2, Math.round(length / 7))
  const step = length / waves
  let path = `M${x1},${y1}`
  for (let i = 0; i < waves; i++) {
    const side = i % 2 === 0 ? 1.8 : -1.8
    const midDist = step * (i + 0.5)
    const endDist = step * (i + 1)
    path +=
      ` Q${x1 + ux * midDist + px * side},${y1 + uy * midDist + py * side}` +
      ` ${x1 + ux * endDist},${y1 + uy * endDist}`
  }
  return path
}

/**
 * How a player is drawn, by team. Filled vs outlined is the whole distinction —
 * it survives greyscale printing and colourblindness, where a hue would not.
 */
export function playerMarks(team) {
  return {
    fill: team === 'a' ? 'currentColor' : 'none',
    strokeDasharray: team === 'n' ? '1.6 1.2' : undefined,
  }
}
