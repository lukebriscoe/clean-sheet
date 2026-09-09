// One video frame at 1080x1920.
//
// Frame N is a pure function of (drill, motion, frame) — no clock, no
// requestAnimationFrame, no CSS transition. That is the whole contract with the
// renderer: Playwright can screenshot frames in any order, on any machine, and
// get the same pixels. Anything time-dependent added here silently makes the
// videos non-reproducible.

import { positionsAt, captionAt, withTimeline, frameToTime } from '../src/lib/motion.js'
import { areaLabel } from '../src/lib/diagram.js'
import { sentenceList } from '../src/lib/taxonomy.js'
import { sceneAt, subtitle, setupLine, coachingPoints } from './composition.js'
import AnimatedPitch from './AnimatedPitch.jsx'

// Shorts overlay their own UI along the bottom and right. Content stays inside
// these margins or the caption ends up behind the subscribe button.
const SAFE_X = 88
const SAFE_TOP = 150
const SAFE_BOTTOM = 380

const PAPER = 'rgb(241 243 239)'
const INK = 'rgb(26 33 29)'
const PITCH = 'rgb(15 59 42)'
const MIST = 'rgb(90 102 95)'
const HIVIS = 'rgb(242 194 48)'

const DISPLAY = "'Chivo', 'Helvetica Neue', sans-serif"
const BODY = "'Atkinson Hyperlegible', 'Helvetica Neue', sans-serif"

/** Fade in over the first `secs` of a scene, then hold. */
const fadeIn = (localSec, secs = 0.4) => Math.min(1, Math.max(0, localSec / secs))

export default function Frame({ drill, motion, frame, fps = 24 }) {
  const t = frameToTime(frame, fps)
  const scene = sceneAt(drill, motion, t)
  const shapes = drill.diagram?.shapes ?? []

  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        background: PAPER,
        color: INK,
        fontFamily: BODY,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* A high-vis rule across the very top. The one piece of brand furniture
          that persists across every scene, and a bar rather than text, which is
          the only way --hivis is allowed to appear. */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 12, background: HIVIS }} />

      {scene.kind === 'title' && <Title drill={drill} scene={scene} />}
      {scene.kind === 'setup' && <Setup drill={drill} scene={scene} shapes={shapes} />}
      {scene.kind === 'play' && (
        <Play drill={drill} motion={motion} scene={scene} shapes={shapes} />
      )}
      {scene.kind === 'points' && <Points drill={drill} scene={scene} />}
      {scene.kind === 'end' && <EndCard scene={scene} />}
    </div>
  )
}

// -- scenes -------------------------------------------------------------------

function Title({ drill, scene }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: `${SAFE_TOP}px ${SAFE_X}px ${SAFE_BOTTOM}px`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        opacity: fadeIn(scene.localSec, 0.3),
      }}
    >
      <div style={{ width: 120, height: 8, background: PITCH, marginBottom: 48 }} />
      <h1
        style={{
          fontFamily: DISPLAY,
          fontWeight: 900,
          fontSize: 116,
          lineHeight: 1.02,
          letterSpacing: '-0.02em',
          color: PITCH,
          margin: 0,
        }}
      >
        {drill.name}
      </h1>
      <p style={{ fontSize: 46, color: MIST, marginTop: 40 }}>{subtitle(drill)}</p>
    </div>
  )
}

function Setup({ drill, scene, shapes }) {
  const kit = sentenceList((drill.equipment ?? []).filter(k => k !== 'none'))
  return (
    <Stage
      heading="The set-up"
      caption={setupLine(drill)}
      footnote={kit ? `Bring ${kit}.` : null}
      opacity={fadeIn(scene.localSec)}
    >
      <AnimatedPitch diagram={drill.diagram} />
      <AreaLabel diagram={drill.diagram} />
    </Stage>
  )
}

function Play({ drill, motion, scene, shapes }) {
  const local = scene.localSec
  const positions = positionsAt(motion, shapes, local)
  const caption = captionAt(motion, shapes, local)

  // A trail from where each moving shape started this step to where it is now,
  // so a still frame still reads as motion rather than as a jumble of circles.
  const trails = []
  for (const step of withTimeline(motion, shapes)) {
    if (local < step.startSec || local >= step.startSec + step.moveSec) continue
    for (const move of step.moves) {
      const now = positions[move.ref]
      if (now) trails.push({ from: move.from, to: now })
    }
  }

  return (
    <Stage heading="How it runs" caption={caption} opacity={1}>
      <AnimatedPitch diagram={drill.diagram} positions={positions} trails={trails} />
      <AreaLabel diagram={drill.diagram} />
    </Stage>
  )
}

function Points({ drill, scene }) {
  const points = coachingPoints(drill)
  return (
    <div
      style={{
        position: 'absolute',
        inset: `${SAFE_TOP}px ${SAFE_X}px ${SAFE_BOTTOM}px`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        opacity: fadeIn(scene.localSec),
      }}
    >
      <Heading>What to look for</Heading>
      {points.map((point, i) => (
        <div key={i} style={{ display: 'flex', gap: 28, marginTop: i ? 56 : 44 }}>
          <div style={{ width: 8, background: HIVIS, flexShrink: 0, borderRadius: 4 }} />
          <p style={{ fontSize: 52, lineHeight: 1.32, margin: 0, color: INK }}>{point}</p>
        </div>
      ))}
    </div>
  )
}

function EndCard({ scene }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: PITCH,
        color: PAPER,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 36,
        opacity: fadeIn(scene.localSec, 0.25),
      }}
    >
      <p style={{ fontSize: 44, margin: 0, opacity: 0.8 }}>Plan your whole session, free</p>
      <p
        style={{
          fontFamily: DISPLAY,
          fontWeight: 700,
          fontSize: 68,
          margin: 0,
          letterSpacing: '-0.01em',
        }}
      >
        coaching.lukebriscoe.com
      </p>
      <div style={{ width: 160, height: 8, background: HIVIS, marginTop: 12 }} />
    </div>
  )
}

// -- shared furniture ---------------------------------------------------------

function Heading({ children }) {
  return (
    <h2
      style={{
        fontFamily: DISPLAY,
        fontWeight: 700,
        fontSize: 44,
        color: MIST,
        margin: 0,
      }}
    >
      {children}
    </h2>
  )
}

function AreaLabel({ diagram }) {
  const label = areaLabel(diagram?.area)
  if (!label) return null
  return <p style={{ fontSize: 36, color: MIST, textAlign: 'center', marginTop: 24 }}>{label}</p>
}

/**
 * The diagram scenes share one layout: a heading, the pitch, and a caption band
 * pinned above the safe area. Keeping the pitch in the same place across scenes
 * means it does not jump when the video cuts from set-up to play.
 */
function Stage({ heading, caption, footnote, opacity, children }) {
  return (
    // A flex column between the safe margins, NOT three absolutely positioned
    // blocks. The caption used to be pinned to the bottom and grew upwards, so a
    // three-line summary climbed into the diagram and collided with the area
    // label. Laying it out as a column means the pitch yields to the text
    // instead, and no combination of caption length and diagram aspect can
    // overlap.
    <div
      style={{
        position: 'absolute',
        top: SAFE_TOP,
        left: SAFE_X,
        right: SAFE_X,
        bottom: SAFE_BOTTOM,
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
        opacity,
      }}
    >
      <Heading>{heading}</Heading>

      {/* Takes the space that is left and no more; a tall diagram scales down
          rather than pushing the caption off the bottom of the frame. */}
      <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {children}
      </div>

      <div style={{ flex: '0 0 auto' }}>
        {caption && (
          <p style={{ fontSize: 50, lineHeight: 1.34, margin: 0, color: INK }}>{caption}</p>
        )}
        {footnote && (
          <p style={{ fontSize: 38, marginTop: 20, marginBottom: 0, color: MIST }}>{footnote}</p>
        )}
      </div>
    </div>
  )
}
