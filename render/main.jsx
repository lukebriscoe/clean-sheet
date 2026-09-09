// Entry point for the frame renderer.
//
//   /render/?slug=traffic-lights&frame=120
//
// Playwright drives this: it navigates once per drill, then calls
// window.__setFrame(n) and screenshots, which is far faster than a navigation
// per frame. Opening it by hand with no `frame` plays the video in the browser
// so you can eyeball the composition without rendering anything.

import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'
import seed from '../data/seed-drills.json'
import motionData from '../data/drill-motion.json'
import { slugFor } from './slug.js'
import { videoDuration } from './composition.js'
import Frame from './Frame.jsx'

const FPS = 24

const params = new URLSearchParams(location.search)
const slug = params.get('slug')
const fps = Number(params.get('fps')) || FPS

const drill = seed.drills.find(d => slugFor(d) === slug)
const motion = motionData[slug]

function Renderer() {
  const fixedFrame = params.has('frame') ? Number(params.get('frame')) : null
  const [frame, setFrame] = useState(fixedFrame ?? 0)

  // Playwright's handle on the frame. Exposed as a function rather than driven
  // by the URL so stepping a frame costs a repaint, not a page load. The frame
  // count comes from here too, so the renderer never has to duplicate the
  // composition maths to work out how long a video is.
  useEffect(() => {
    window.__setFrame = next => setFrame(next)
    window.__frameCount = Math.ceil(videoDuration(drill, motion) * fps)
    window.__ready = true
  }, [])

  // Preview mode only: no `frame` in the URL means a human is looking at it, so
  // play in real time. The renderer never takes this path — it always pins a
  // frame — so nothing time-dependent can leak into a screenshot.
  useEffect(() => {
    if (fixedFrame != null) return
    const total = videoDuration(drill, motion) * fps
    const start = performance.now()
    let raf
    const tick = () => {
      setFrame(Math.floor(((performance.now() - start) / 1000) * fps) % Math.ceil(total))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [fixedFrame, fps])

  return <Frame drill={drill} motion={motion} frame={frame} fps={fps} />
}

const root = createRoot(document.getElementById('root'))

if (!slug) {
  root.render(<Problem>No <code>?slug=</code> given.</Problem>)
} else if (!drill) {
  root.render(<Problem>No drill in seed-drills.json with slug <code>{slug}</code>.</Problem>)
} else if (!drill.diagram?.shapes?.length) {
  root.render(<Problem><code>{slug}</code> has no diagram to animate.</Problem>)
} else if (!motion) {
  root.render(<Problem>No motion authored for <code>{slug}</code> in drill-motion.json.</Problem>)
} else {
  // Fonts must be laid out before the first screenshot or every frame reflows
  // mid-render. Blocking on document.fonts is cheap and removes a whole class
  // of "why is frame 0 different" bug.
  document.fonts.ready.then(() => root.render(<Renderer />))
}

function Problem({ children }) {
  return (
    <div style={{ padding: 48, fontFamily: 'monospace', fontSize: 20, color: '#B23A2F' }}>
      {children}
    </div>
  )
}
