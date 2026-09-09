#!/usr/bin/env node
// Renders drill motion to vertical mp4s for YouTube Shorts.
//
//   npm run render                  # every drill with motion
//   npm run render -- --only traffic-lights
//   npm run render -- --force       # ignore the up-to-date check
//
// Frames come from render/ (a separate Vite entry, never shipped to coaches),
// driven one frame at a time and piped straight into ffmpeg. Two things make
// this fast enough to be practical:
//
//   1. ONE navigation per drill, then window.__setFrame(n) + screenshot in a
//      loop. A navigation per frame is ~40x slower and was the difference
//      between half an hour and half a day for the full library.
//   2. Frames go to ffmpeg's stdin rather than to disk, so a 45-second video
//      never writes ~1,000 PNGs just to read them straight back.
//
// Requires ffmpeg on PATH (brew install ffmpeg).

import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { extname, join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadDrills, loadMotion, slugify } from './lib/motion-data.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const DIST = join(ROOT, 'dist')
const OUT_DIR = join(ROOT, 'build/video')
const AUDIO_DIR = join(ROOT, 'build/audio')
const STAMP_DIR = join(ROOT, 'build/.render')

const FPS = 24
const WIDTH = 1080
const HEIGHT = 1920

const args = process.argv.slice(2)
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null
const force = args.includes('--force')

// -- preflight ----------------------------------------------------------------

if (!(await exists(join(DIST, 'render/index.html')))) {
  fail('dist/render/index.html not found — run `npm run build` first.')
}
if (!(await hasFfmpeg())) {
  fail('ffmpeg not found on PATH. Install it with:  brew install ffmpeg')
}

// Vite writes content-hashed asset filenames into the entry HTML, so hashing
// that one small file is a cheap proxy for "did the renderer change at all".
const rendererHash = createHash('sha256')
  .update(await readFile(join(DIST, 'render/index.html')))
  .digest('hex')
  .slice(0, 16)

const drills = await loadDrills()
const motionData = await loadMotion()
const bySlug = new Map(drills.map(d => [d.slug ?? slugify(d.name), d]))

let slugs = Object.keys(motionData)
if (only) {
  if (!motionData[only]) fail(`No motion authored for "${only}" in data/drill-motion.json`)
  slugs = [only]
}
if (!slugs.length) fail('No motion authored yet — nothing to render.')

await mkdir(OUT_DIR, { recursive: true })
await mkdir(STAMP_DIR, { recursive: true })

// -- serve dist ---------------------------------------------------------------

// 127.0.0.1, never "localhost" — the two are not interchangeable once anything
// resolves v6 first, and a renderer that silently fails to load is expensive.
const server = await serveDist()
const origin = `http://127.0.0.1:${server.address().port}`

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
})
page.on('pageerror', error => console.error(`  [page error] ${error.message}`))

let rendered = 0
let skipped = 0

for (const slug of slugs) {
  const drill = bySlug.get(slug)
  if (!drill) {
    console.error(`✗ ${slug}: no drill under that slug — skipping`)
    continue
  }

  const outFile = join(OUT_DIR, `${slug}.mp4`)
  const stamp = stampFor(drill, motionData[slug])

  if (!force && (await isUpToDate(slug, outFile, stamp))) {
    console.log(`· ${slug} — up to date`)
    skipped++
    continue
  }

  await renderOne({ page, origin, slug, outFile })
  await writeFile(join(STAMP_DIR, `${slug}.hash`), stamp, 'utf8')
  rendered++
}

await browser.close()
server.close()

console.log(`\n${rendered} rendered, ${skipped} up to date → build/video/`)

// -- rendering ----------------------------------------------------------------

async function renderOne({ page, origin, slug, outFile }) {
  await page.goto(`${origin}/render/?slug=${encodeURIComponent(slug)}&frame=0&fps=${FPS}`, {
    waitUntil: 'load',
  })
  await page.waitForFunction(() => window.__ready === true, { timeout: 15000 })

  const total = await page.evaluate(() => window.__frameCount)
  if (!Number.isFinite(total) || total < 1) {
    throw new Error(`${slug}: renderer reported no frames`)
  }

  const audio = join(AUDIO_DIR, `${slug}.mp3`)
  const hasAudio = await exists(audio)
  const ffmpeg = spawnFfmpeg(outFile, hasAudio ? audio : null)

  const started = Date.now()
  for (let frame = 0; frame < total; frame++) {
    await page.evaluate(n => window.__setFrame(n), frame)
    const png = await page.screenshot({ type: 'png' })
    if (!ffmpeg.stdin.write(png)) {
      await new Promise(r => ffmpeg.stdin.once('drain', r))
    }
    if (frame % 120 === 0) {
      process.stdout.write(`\r  ${slug} — frame ${frame}/${total}`)
    }
  }

  ffmpeg.stdin.end()
  const code = await new Promise(r => ffmpeg.on('close', r))
  if (code !== 0) throw new Error(`${slug}: ffmpeg exited ${code}`)

  const secs = ((Date.now() - started) / 1000).toFixed(1)
  const size = ((await stat(outFile)).size / 1e6).toFixed(1)
  process.stdout.write(
    `\r✓ ${slug} — ${total} frames, ${(total / FPS).toFixed(1)}s, ${size}MB` +
      `${hasAudio ? '' : ' (no voiceover yet)'} in ${secs}s\n`,
  )
}

function spawnFfmpeg(outFile, audioFile) {
  const args = [
    '-y',
    '-loglevel', 'error',
    '-f', 'image2pipe',
    '-framerate', String(FPS),
    '-i', '-',
  ]

  if (audioFile) args.push('-i', audioFile)

  args.push(
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', '18',
    // YouTube re-encodes everything; yuv420p is what every player can decode,
    // and the default from PNG input (yuv444p) is not.
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
  )

  if (audioFile) {
    // Voiceover is authored to the animation, but end the video on the video
    // stream so a slightly long mp3 cannot pad the tail with a frozen frame.
    args.push('-c:a', 'aac', '-b:a', '160k', '-shortest')
  }

  args.push(outFile)

  const proc = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] })
  proc.stdin.on('error', () => {}) // ffmpeg exiting early would otherwise EPIPE
  return proc
}

// -- helpers ------------------------------------------------------------------

/**
 * A drill re-renders when its diagram, its motion, or the renderer itself
 * changes. Hashing the renderer bundle means a tweak to Frame.jsx invalidates
 * every video, which is what you want — otherwise half the library silently
 * keeps the old look.
 */
function stampFor(drill, motion) {
  return createHash('sha256')
    .update(JSON.stringify(drill.diagram ?? null))
    .update(JSON.stringify(motion))
    .update(JSON.stringify(drill.coachingPoints ?? []))
    .update(String(drill.name))
    .update(String(drill.summary))
    .update(rendererHash)
    .digest('hex')
    .slice(0, 16)
}

async function isUpToDate(slug, outFile, stamp) {
  if (!(await exists(outFile))) return false
  try {
    return (await readFile(join(STAMP_DIR, `${slug}.hash`), 'utf8')).trim() === stamp
  } catch {
    return false
  }
}

async function serveDist() {
  const types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
  }
  const server = createServer(async (req, res) => {
    let path = decodeURIComponent(req.url.split('?')[0])
    if (path.endsWith('/')) path += 'index.html'
    try {
      const body = await readFile(join(DIST, path))
      res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' })
      res.end(body)
    } catch {
      res.writeHead(404)
      res.end('not found')
    }
  })
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  return server
}

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

function hasFfmpeg() {
  return new Promise(r => {
    const proc = spawn('ffmpeg', ['-version'], { stdio: 'ignore' })
    proc.on('error', () => r(false))
    proc.on('close', code => r(code === 0))
  })
}

function fail(message) {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}
