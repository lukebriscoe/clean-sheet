// The pitch, drawn at a given moment.
//
// Same shape vocabulary as the on-page diagrams (lib/diagram-shapes.js is the
// shared source of the geometry), with two deliberate differences:
//
//  1. NO ARROWS. A static diagram draws pass/run/dribble arrows because it has
//     to depict movement it cannot show. Here the movement is the point, so the
//     arrows would be redundant clutter over the top of the thing they describe.
//  2. A HIVIS TRAIL behind whatever is moving right now. THE HIVIS RULE says
//     --hivis marks "now and nothing else" and must be a bar, never text — a
//     trail is exactly that, and it is what makes a still frame readable.

import { diagramHeight } from '../src/lib/diagram.js'
import {
  PLAYER_R,
  BALL_R,
  BALL_DOT_R,
  conePath,
  gatePaths,
  goalPath,
  playerMarks,
} from '../src/lib/diagram-shapes.js'

const INK = 'rgb(15 59 42)' /* --pitch  */
const HIVIS = 'rgb(242 194 48)' /* --hivis */
const CHALK = 'rgb(255 255 255)'

export default function AnimatedPitch({ diagram, positions = [], trails = [] }) {
  const shapes = diagram?.shapes ?? []
  const height = diagramHeight(diagram?.area)
  // Author in 0–100 on both axes; scale y so a wide grid renders wide without
  // turning the players into ovals. Identical rule to PitchDiagram.
  const sy = y => (y / 100) * height

  // Where a shape is right now: its animated position if it has one, else the
  // coordinates it was drawn at in the diagram.
  const at = (shape, index) => {
    const moved = positions[index]
    return moved ? [moved[0], sy(moved[1])] : [shape.x, sy(shape.y)]
  }

  return (
    <svg
      viewBox={`-4 -4 108 ${height + 8}`}
      // maxHeight matters as much as width: diagram aspect runs from 0.45 to 1.5
      // (diagramHeight clamps it), and a 1.5 pitch sized purely by width is
      // taller than the frame has room for. preserveAspectRatio is on by
      // default, so clamping the height letterboxes rather than distorts.
      style={{ width: '100%', height: 'auto', maxHeight: '100%', display: 'block', color: INK }}
      aria-hidden="true"
    >
      {/* The playing area. Dashed, because it is cones on grass, not a wall. */}
      <rect
        x="0" y="0" width="100" height={height}
        fill="none" stroke="currentColor" strokeWidth="0.6"
        strokeDasharray="3 2" opacity="0.5"
      />

      {/* Zones sit underneath everything else. */}
      {shapes.map((s, i) =>
        s.t !== 'zone' ? null : (
          <g key={`z${i}`} opacity="0.45">
            <rect
              x={s.x} y={sy(s.y)} width={s.w} height={sy(s.h)}
              fill="currentColor" fillOpacity="0.08"
              stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 1.5"
            />
            {s.label && (
              <text
                x={s.x + s.w / 2} y={sy(s.y) + sy(s.h) / 2}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="3.4" fill="currentColor"
              >
                {s.label}
              </text>
            )}
          </g>
        ),
      )}

      {/* Movement trails, under everything so they never obscure a player.
          This is the ONLY hivis on the pitch: a bar showing the ground a player
          has just covered, which is what makes a still frame read as motion.
          An earlier version also ringed each moving player — with six players
          moving at once the frame went solid yellow, and "now" stops meaning
          anything when it is everywhere. */}
      {trails.map((trail, i) => (
        <line
          key={`t${i}`}
          x1={trail.from[0]} y1={sy(trail.from[1])}
          x2={trail.to[0]} y2={sy(trail.to[1])}
          stroke={HIVIS} strokeWidth="2.8" strokeLinecap="round"
        />
      ))}

      {/* Static furniture. */}
      {shapes.map((s, i) => {
        const [x, y] = at(s, i)
        switch (s.t) {
          case 'cone':
            return <path key={`c${i}`} d={conePath(x, y)} fill={HIVIS} />

          case 'gate':
            return (
              <g key={`g${i}`} fill={HIVIS} transform={`rotate(${s.angle} ${x} ${y})`}>
                {gatePaths(x, y).map((d, n) => <path key={n} d={d} />)}
              </g>
            )

          case 'goal':
            return (
              <path
                key={`gl${i}`} d={goalPath(x, y, s.facing)}
                fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"
              />
            )

          case 'label':
            return (
              <text
                key={`lb${i}`} x={x} y={y}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="3.6" fill="currentColor"
              >
                {s.text}
              </text>
            )

          default:
            return null
        }
      })}

      {/* Balls, then players on top — a player standing on their ball should
          occlude it, not the other way round. */}
      {shapes.map((s, i) => {
        if (s.t !== 'ball') return null
        const [x, y] = at(s, i)
        return (
          <g key={`b${i}`}>
            <circle cx={x} cy={y} r={BALL_R} fill={CHALK} stroke="currentColor" strokeWidth="1" />
            <circle cx={x} cy={y} r={BALL_DOT_R} fill="currentColor" />
          </g>
        )
      })}

      {shapes.map((s, i) => {
        if (s.t !== 'player') return null
        const [x, y] = at(s, i)
        const marks = playerMarks(s.team)
        return (
          <g key={`p${i}`}>
            <circle
              cx={x} cy={y} r={PLAYER_R}
              fill={marks.fill === 'currentColor' ? INK : CHALK}
              stroke="currentColor"
              strokeWidth="0.9"
              strokeDasharray={marks.strokeDasharray}
            />
            {s.label && (
              <text
                x={x} y={y}
                textAnchor="middle" dominantBaseline="central"
                fontSize="3" fill={s.team === 'a' ? CHALK : INK}
              >
                {s.label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
