#!/usr/bin/env node
// Titles and descriptions for the YouTube upload form.
//
//   npm run video:listings              # every drill with a rendered mp4
//   npm run video:listings -- --all     # every drill with motion, rendered or not
//   npm run video:listings -- --link    # add the drill's page URL under the description
//
// The description is the drill's own `summary` — one sentence, already written
// in our voice and already reviewed, so nothing new is invented for YouTube and
// the content policy has no fresh surface to cover. The title is built from the
// same taxonomy the library filters on, so a search for "U8 dribbling drill"
// lands on something真 relevant rather than on a made-up phrase.

import { readdir } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadDrills, loadMotion, slugify } from './lib/motion-data.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const VIDEO_DIR = resolve(HERE, '../build/video')
const SITE = 'https://coaching.lukebriscoe.com'
const HANDLE = '@cleansheetcoaching'

const args = process.argv.slice(2)
const all = args.includes('--all')
const withLink = args.includes('--link')

const AGE = { u6: 'U6', u7: 'U7', u8: 'U8', u9: 'U9', u10: 'U10', u11: 'U11', u12: 'U12', u13: 'U13', u14plus: 'U14+' }
const THEME = {
  passing: 'passing', receiving: 'receiving', dribbling: 'dribbling', shooting: 'shooting',
  defending: 'defending', possession: 'possession', transition: 'transition', movement: 'movement',
  goalkeeping: 'goalkeeping', physical: 'fitness', funandconfidence: 'fun',
}

/** "U6–U10" from the age list, which is already ordered youngest first. */
function ages(drill) {
  const list = (drill.ageGroups ?? []).map(a => AGE[a]).filter(Boolean)
  if (!list.length) return 'all ages'
  return list.length === 1 ? list[0] : `${list[0]}–${list[list.length - 1]}`
}

const drills = await loadDrills()
const motion = await loadMotion()
const bySlug = new Map(drills.map(d => [d.slug ?? slugify(d.name), d]))

let rendered = new Set()
try {
  rendered = new Set((await readdir(VIDEO_DIR)).filter(f => f.endsWith('.mp4')).map(f => f.replace(/\.mp4$/, '')))
} catch {
  /* nothing rendered yet */
}

const slugs = Object.keys(motion)
  .filter(slug => motion[slug].script && (all || rendered.has(slug)))
  .sort()

if (!slugs.length) {
  console.error('\nNothing to list — no narrated drill has a rendered video in build/video/.')
  console.error('Try: npm run video:listings -- --all\n')
  process.exit(1)
}

for (const slug of slugs) {
  const drill = bySlug.get(slug)
  if (!drill) continue

  const theme = THEME[(drill.themes ?? [])[0]] ?? 'football'
  const title = `${drill.name} — ${theme} drill for ${ages(drill)}`
  const description = `${HANDLE} ${drill.summary}`

  console.log(`\n── ${slug}${rendered.has(slug) ? '' : '  (not rendered yet)'}`)
  console.log(`title  ${title}`)
  console.log(`desc   ${description}`)
  if (withLink) console.log(`       ${SITE}/#/library/${slug}`)
}

console.log(`\n${slugs.length} listing${slugs.length === 1 ? '' : 's'}.`)
console.log('Set "Not made for kids" on each — the audience is adult volunteer coaches.\n')
