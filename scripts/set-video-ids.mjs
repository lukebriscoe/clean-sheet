#!/usr/bin/env node
// Links uploaded YouTube videos to their drills.
//
//   npm run video:link -- traffic-lights=dQw4w9WgXcQ two-ways-across=abc12345678
//   npm run video:link -- --from links.txt        # one "slug=id" per line
//   pbpaste | npm run video:link -- --stdin
//   npm run video:link -- --list                  # what is linked today
//
// Writes `videoId` into data/seed-drills.json. Nothing reaches the site until
// you then run `npm run seed:prod` — and the rules must be deployed first, or
// every write is silently rejected (firestore.rules only permits videoId on a
// seed drill, so an out-of-date ruleset rejects the whole document).
//
// Accepts a bare id, a youtu.be link, or a full watch/shorts URL — pasting
// straight from YouTube Studio is the normal case and should just work.

import { readFile, writeFile } from 'node:fs/promises'
// parseVideoId lives in src/lib/schema.js beside isVideoId, so the two agree on
// what a video id is and both are covered by npm test.
import { parseVideoId } from '../src/lib/schema.js'
import { SEED_FILE, loadDrills, slugify } from './lib/motion-data.mjs'

const args = process.argv.slice(2)
const drills = await loadDrills()
const bySlug = new Map(drills.map(d => [d.slug ?? slugify(d.name), d]))

if (args.includes('--list')) {
  const linked = drills.filter(d => d.videoId)
  if (!linked.length) console.log('No drills have a video linked yet.')
  for (const d of linked) {
    console.log(`${(d.slug ?? slugify(d.name)).padEnd(34)} youtu.be/${d.videoId}`)
  }
  console.log(`\n${linked.length} of ${drills.length} drills linked.`)
  process.exit(0)
}

// -- gather "slug=value" pairs from wherever they came from -------------------

let pairs = args.filter(arg => arg.includes('=') && !arg.startsWith('--'))

if (args.includes('--from')) {
  const path = args[args.indexOf('--from') + 1]
  if (!path) fail('--from needs a file path')
  pairs = pairs.concat(splitLines(await readFile(path, 'utf8')))
}

if (args.includes('--stdin')) {
  pairs = pairs.concat(splitLines(await readStdin()))
}

if (!pairs.length) {
  fail(
    'Nothing to link.\n\n' +
      '  npm run video:link -- <slug>=<youtube id or url> [...]\n' +
      '  npm run video:link -- --from links.txt\n' +
      '  npm run video:link -- --list',
  )
}

// -- validate everything BEFORE writing anything ------------------------------

const updates = []
const problems = []
const seen = new Set()

for (const pair of pairs) {
  const index = pair.indexOf('=')
  const slug = pair.slice(0, index).trim()
  const value = pair.slice(index + 1).trim()

  if (!bySlug.has(slug)) {
    problems.push(`${slug}: no drill in seed-drills.json with that slug`)
    continue
  }
  if (seen.has(slug)) {
    problems.push(`${slug}: listed twice`)
    continue
  }
  const id = parseVideoId(value)
  if (!id) {
    problems.push(`${slug}: "${value}" is not a YouTube id or link`)
    continue
  }

  seen.add(slug)
  updates.push({ slug, id, drill: bySlug.get(slug), was: bySlug.get(slug).videoId ?? null })
}

// A duplicate id means two drills point at the same video, which is almost
// always a copy-paste slip while working through a list in YouTube Studio.
const byId = new Map()
for (const update of updates) {
  if (byId.has(update.id)) {
    problems.push(`${update.slug} and ${byId.get(update.id)} both point at youtu.be/${update.id}`)
  }
  byId.set(update.id, update.slug)
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} problem${problems.length === 1 ? '' : 's'} — nothing written:\n`)
  for (const problem of problems) console.error(`  · ${problem}`)
  console.error('')
  process.exit(1)
}

// -- write --------------------------------------------------------------------

const seed = JSON.parse(await readFile(SEED_FILE, 'utf8'))
const seedBySlug = new Map(seed.drills.map(d => [d.slug ?? slugify(d.name), d]))

for (const { slug, id } of updates) {
  seedBySlug.get(slug).videoId = id
}
await writeFile(SEED_FILE, `${JSON.stringify(seed, null, 2)}\n`, 'utf8')

for (const { slug, id, was } of updates) {
  console.log(`✓ ${slug.padEnd(34)} youtu.be/${id}${was && was !== id ? `  (was ${was})` : ''}`)
}

const total = seed.drills.filter(d => d.videoId).length
console.log(`\n${updates.length} linked — ${total} of ${seed.drills.length} drills now have a video.`)
console.log('\nNext:')
console.log('  firebase deploy --only firestore:rules   # required first, or writes are rejected')
console.log('  npm run seed:prod')

// -- helpers ------------------------------------------------------------------

function splitLines(text) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && line.includes('='))
}

function readStdin() {
  return new Promise(resolve => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', chunk => (data += chunk))
    process.stdin.on('end', () => resolve(data))
  })
}

function fail(message) {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}
