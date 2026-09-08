import { useMemo } from 'react'
import { normaliseDiagram, diagramHeight, areaLabel, describeDiagram } from '../../lib/diagram.js'

// Renders a stored diagram as inline SVG.
//
// Everything is drawn with `currentColor`, so the diagram inherits the surrounding
// text colour — dark theme on screen, solid black under the print stylesheet, with
// no separate print variant to maintain. Team A is filled and team B is outlined
// rather than orange-vs-blue, so the distinction survives both.

const R = 3.2 // player radius, in viewBox units — constant regardless of aspect

export default function PitchDiagram({ diagram, drillName = 'this drill', className = '' }) {
  const d = useMemo(() => normaliseDiagram(diagram), [diagram])
  if (!d) return null

  const height = diagramHeight(d.area)
  // Author in 0–100 on both axes; scale the y positions (not the shape sizes) so a
  // wide grid renders wide without turning the players into ovals.
  const sy = y => (y / 100) * height
  const alt = describeDiagram(d, drillName)

  return (
    <figure className={`print-block m-0 ${className}`}>
      <div className="overflow-x-auto rounded-md border border-line bg-paper p-3 print:border-[#999] print:bg-white">
        <svg
          viewBox={`-4 -4 108 ${height + 8}`}
          className="mx-auto block h-auto w-full max-w-md text-pitch print:text-black"
          role="img"
          aria-label={alt}
        >
          {/* The playing area. Dashed, because it's cones on grass, not a wall. */}
          <rect
            x="0" y="0" width="100" height={height}
            fill="none" stroke="currentColor" strokeWidth="0.6"
            strokeDasharray="3 2" opacity="0.5"
          />

          {/* Zones sit underneath everything else. */}
          {d.shapes.filter(s => s.t === 'zone').map((s, i) => (
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
                  fontSize="3.4" fill="currentColor" className="tnum"
                >
                  {s.label}
                </text>
              )}
            </g>
          ))}

          {/* Arrows, under the players so the heads don't cover anyone. */}
          <defs>
            <marker
              id="cs-arrow" viewBox="0 0 10 10" refX="8" refY="5"
              markerWidth="5" markerHeight="5" orient="auto-start-reverse"
            >
              <path d="M0,1 L9,5 L0,9 z" fill="currentColor" />
            </marker>
          </defs>
          {d.shapes.map((s, i) => {
            if (!['pass', 'run', 'dribble'].includes(s.t)) return null
            const [x1, y1] = [s.from[0], sy(s.from[1])]
            const [x2, y2] = [s.to[0], sy(s.to[1])]
            return (
              <path
                key={`a${i}`}
                d={s.t === 'dribble' ? wavyPath(x1, y1, x2, y2) : `M${x1},${y1} L${x2},${y2}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="0.9"
                // Standard coaching notation: dashed = pass, solid = run,
                // wavy = travelling with the ball.
                strokeDasharray={s.t === 'pass' ? '3 2' : undefined}
                markerEnd="url(#cs-arrow)"
                opacity="0.85"
              />
            )
          })}

          {/* Static objects. */}
          {d.shapes.map((s, i) => {
            switch (s.t) {
              case 'cone':
                // Triangle — reads as a cone at any size, and needs no colour.
                return (
                  <path
                    key={`c${i}`}
                    d={`M${s.x},${sy(s.y) - 2.6} L${s.x + 2.3},${sy(s.y) + 1.8} L${s.x - 2.3},${sy(s.y) + 1.8} z`}
                    fill="currentColor"
                    className="text-hivis print:text-black"
                  />
                )

              case 'gate':
                // Two cones with a gap — the thing you pass or dribble through.
                return (
                  <g key={`g${i}`} className="text-hivis print:text-black" fill="currentColor"
                     transform={`rotate(${s.angle} ${s.x} ${sy(s.y)})`}>
                    <path d={`M${s.x - 4},${sy(s.y) - 2.6} l2.3,4.4 l-4.6,0 z`} />
                    <path d={`M${s.x + 4},${sy(s.y) - 2.6} l2.3,4.4 l-4.6,0 z`} />
                  </g>
                )

              case 'ball':
                // A ring with a centre dot, not a solid disc — a filled circle is
                // already "attacker", and the two must stay distinguishable when
                // the whole diagram prints in black.
                return (
                  <g key={`b${i}`}>
                    <circle
                      cx={s.x} cy={sy(s.y)} r="2"
                      fill="none" stroke="currentColor" strokeWidth="1"
                      className="text-pitch print:text-black"
                    />
                    <circle
                      cx={s.x} cy={sy(s.y)} r="0.7"
                      fill="currentColor" className="text-pitch print:text-black"
                    />
                  </g>
                )

              case 'goal': {
                // Posts as well as a goal line, so it reads as a goal rather than
                // a stray dash. The stubs point into the pitch.
                const into = s.facing === 'down' ? -1 : s.facing === 'up' ? 1 : 0
                const side = s.facing === 'right' ? -1 : s.facing === 'left' ? 1 : 0
                const half = 7
                const depth = 2.6
                const x = s.x
                const y = sy(s.y)
                const path = into
                  ? `M${x - half},${y + into * depth} L${x - half},${y} L${x + half},${y} L${x + half},${y + into * depth}`
                  : `M${x + side * depth},${y - half} L${x},${y - half} L${x},${y + half} L${x + side * depth},${y + half}`
                return (
                  <path
                    key={`gl${i}`} d={path}
                    fill="none" stroke="currentColor" strokeWidth="1.3"
                    strokeLinejoin="round"
                    className="text-pitch print:text-black"
                  />
                )
              }

              case 'player':
                return (
                  <g key={`p${i}`}>
                    <circle
                      cx={s.x} cy={sy(s.y)} r={R}
                      // Filled vs outlined is the whole distinction — it survives
                      // greyscale printing and colourblindness.
                      fill={s.team === 'a' ? 'currentColor' : 'none'}
                      stroke="currentColor"
                      strokeWidth="0.9"
                      strokeDasharray={s.team === 'n' ? '1.6 1.2' : undefined}
                      className="text-pitch print:text-black"
                    />
                    {s.label && (
                      <text
                        x={s.x} y={sy(s.y)}
                        textAnchor="middle" dominantBaseline="central"
                        fontSize="3" className="tnum"
                        fill={s.team === 'a' ? 'rgb(var(--chalk))' : 'currentColor'}
                      >
                        {s.label}
                      </text>
                    )}
                  </g>
                )

              case 'label':
                return (
                  <text
                    key={`t${i}`} x={s.x} y={sy(s.y)}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize="3.6" fill="currentColor" className="tnum"
                  >
                    {s.text}
                  </text>
                )

              default:
                return null
            }
          })}
        </svg>
      </div>

      <figcaption className="mt-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <span className="label">{areaLabel(d.area)}</span>
        {d.caption && <span className="text-xs text-mist">{d.caption}</span>}
      </figcaption>
    </figure>
  )
}

/** A dribble arrow: a sine wave along the line, which is how coaches draw it. */
function wavyPath(x1, y1, x2, y2) {
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

/** The key, shown once under the library grid rather than on every diagram. */
export function DiagramKey({ className = '' }) {
  const Item = ({ children, label }) => (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <svg viewBox="0 0 14 10" className="h-2.5 w-3.5 overflow-visible text-pitch print:text-black">
        {children}
      </svg>
      <span>{label}</span>
    </span>
  )
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-mist ${className}`}>
      <Item label="Attacker">
        <circle cx="7" cy="5" r="3.4" fill="currentColor" />
      </Item>
      <Item label="Defender">
        <circle cx="7" cy="5" r="3.4" fill="none" stroke="currentColor" strokeWidth="1" />
      </Item>
      <Item label="Cone">
        <path d="M7,1.4 L10,8 L4,8 z" fill="currentColor" />
      </Item>
      <Item label="Ball">
        <circle cx="7" cy="5" r="2" fill="currentColor" />
      </Item>
      <Item label="Pass">
        <line x1="0" y1="5" x2="14" y2="5" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" />
      </Item>
      <Item label="Run">
        <line x1="0" y1="5" x2="14" y2="5" stroke="currentColor" strokeWidth="1" />
      </Item>
    </div>
  )
}
