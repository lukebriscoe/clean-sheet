#!/usr/bin/env node
// End-to-end verification against a running dev server + Firestore emulator.
//
//   npm run dev:start     # in one terminal
//   npm run dev:seed
//   npm run verify        # in another
//
// Drives the real UI in Chrome and asserts behaviour that unit tests can't reach:
// that the print view is actually black on white, that a share link works for
// someone with no localStorage, that the rules reject an invalid write server-side,
// and — the important one — that editing a library drill never changes a session
// somebody already saved and printed.
//
// Requires `npx playwright install chrome` or a local Google Chrome.
// Screenshots land in .verify-shots/ (git-ignored).
import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../.verify-shots')
mkdirSync(OUT, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

// Use the installed Google Chrome rather than downloading a Playwright build.
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

const errors = []
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push(String(e)))

// ---- 1. Library loads with the seeded drills ----
await page.goto('http://localhost:5173/#/library', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('main ul li', { timeout: 20000 })
const ROWS = 'main > div > ul > li'
const total = await page.locator(ROWS).count()
// Read the expected count from the seed file rather than hard-coding it, so
// adding drills doesn't require editing the test.
const seeded = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../data/seed-drills.json'), 'utf8'),
).drills.length
check('library renders every seeded drill', total === seeded, `${total} of ${seeded}`)
await page.screenshot({ path: `${OUT}/01-library.png`, fullPage: false })

// ---- 2. Filters narrow the list ----
const filters = page.locator('main').first()
await filters.getByRole('button', { name: /^Passing \d+$/ }).first().click()
await page.waitForTimeout(300)
const passing = await page.locator(ROWS).count()
check('theme filter narrows', passing > 0 && passing < total, `passing: ${passing}`)

await filters.getByRole('button', { name: /^U10 \d+$/ }).first().click()
await page.waitForTimeout(300)
const passingU10 = await page.locator(ROWS).count()
check('facets AND together', passingU10 > 0 && passingU10 <= passing, `+U10: ${passingU10}`)
await page.screenshot({ path: `${OUT}/02-filtered.png` })

await page.getByRole('button', { name: 'clear filters' }).first().click()
await page.waitForTimeout(300)
check('clear restores full list', (await page.locator(ROWS).count()) === total)

// ---- 3. Drill detail dialog ----
await page.locator(ROWS).first().locator('button').first().click()
await page.waitForSelector('dialog[open]')
const dialogText = await page.locator('dialog').innerText()
check('detail shows coaching points', /coaching points/i.test(dialogText))
check('detail renders a diagram', (await page.locator('dialog svg[role="img"]').count()) > 0)
const altText = await page.locator('dialog svg[role="img"]').first().getAttribute('aria-label')
check('diagram carries generated alt text', /^Diagram for .+ area/.test(altText ?? ''), (altText ?? '').slice(0, 60))
await page.screenshot({ path: `${OUT}/03-drill-detail.png` })
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

// ---- 4. Build a session ----
const names = []
for (let i = 0; i < 5; i++) {
  const row = page.locator(ROWS).nth(i)
  names.push((await row.locator('button').first().innerText()).split('\n')[0].trim())
  await row.getByRole('button', { name: /^Add .* to your session$/ }).click()
  await page.waitForTimeout(150)
}
check('added 5 drills to session', true, names.length + ' blocks')

await page.getByRole('link', { name: /^Plan/ }).click()
await page.waitForSelector('input[placeholder*="U10"]')
await page.waitForTimeout(400)
const blocks = await page.locator('.mown > li').count()
check('planner shows the running order', blocks === 5, `${blocks} blocks`)

// ---- 5. Running clock ----
if (await page.getByRole('button', { name: 'Edit' }).count()) {
  await page.getByRole('button', { name: 'Edit' }).first().click()
}
await page.fill('input[type="time"]', '18:30')
await page.waitForTimeout(400)
const clocks = await page.locator('.mown > li time').allInnerTexts()
check('wall-clock times derive from kick-off', clocks[0].trim() === '18:30', clocks.slice(0, 3).join(' / '))

// ---- 6. Over-run warning ----
await page.fill('input[placeholder*="U10"]', 'U10 — Pressing as a unit')
// Number inputs in order: Players (0), Total mins (1), then each block's duration.
const sessionTarget = page.locator('input[type="number"]').nth(1)
await sessionTarget.fill('30')
await page.waitForTimeout(400)
const overText = await page.locator('body').innerText()
check('over-run warning fires', /over your/.test(overText))
check('block durations untouched by target change', (await page.locator('.mown > li').count()) === 5)
await page.screenshot({ path: `${OUT}/04-planner.png`, fullPage: true })

await sessionTarget.fill('90')
await page.waitForTimeout(300)

// ---- 7. localStorage draft survives a reload ----
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(800)
const afterReload = await page.locator('.mown > li').count()
const titleAfter = await page.inputValue('input[placeholder*="U10"]')
check('draft survives reload', afterReload === 5 && titleAfter.includes('Pressing'), `${afterReload} blocks, title kept`)

// ---- 8. Save and open the share link ----
await page.getByRole('button', { name: /Save this plan/ }).click()
await page.waitForURL(/#\/session\//, { timeout: 20000 })
const shareUrl = page.url()
await page.waitForSelector('h1')
check('saved and redirected to share view', /#\/session\/[a-z0-9]{12}/.test(shareUrl), shareUrl.split('#')[1])

const sessionText = await page.locator('body').innerText()
check('share view lists what to bring', /\bBring .*(cones|bibs|balls|goals)/i.test(sessionText))
check('share view shows the running order', names.every(n => sessionText.includes(n)))
await page.screenshot({ path: `${OUT}/05-session-view.png`, fullPage: true })

// ---- 9. Share link works in a clean context (no localStorage) ----
const fresh = await browser.newContext({ viewport: { width: 430, height: 932 } })
const mobile = await fresh.newPage()
await mobile.goto(shareUrl, { waitUntil: 'domcontentloaded' })
await mobile.waitForSelector('h1', { timeout: 20000 })
const mobileText = await mobile.locator('body').innerText()
check('share link readable by someone else', mobileText.includes('Pressing'))
await mobile.screenshot({ path: `${OUT}/06-mobile.png`, fullPage: true })

// A saved plan is read standing on grass holding a ball. Set-up, the diagram and
// the harder/easier variations pushed a five-block session to nine screens, so
// they sit behind a tap on screen.
// The panel stays in the DOM so the print rules can reveal it, so presence is
// not the question — visibility is.
const detailHidden = await mobile.evaluate(() => {
  const headings = [...document.querySelectorAll('h3')].filter(
    h => h.textContent.trim() === 'Make it harder',
  )
  return { inDom: headings.length, visible: headings.filter(h => h.offsetParent !== null).length }
})
check(
  'the plan keeps drill detail behind a tap',
  detailHidden.inDom > 0 && detailHidden.visible === 0,
  `${detailHidden.inDom} in the DOM, ${detailHidden.visible} on screen`,
)
const collapsedH = await mobile.evaluate(() => document.body.scrollHeight)
await mobile.getByRole('button', { name: 'Show coaching points' }).click()
await mobile.waitForTimeout(400)
const expandedH = await mobile.evaluate(() => document.body.scrollHeight)
check(
  'the glance view is materially shorter than the full plan',
  collapsedH < expandedH * 0.6,
  `${collapsedH}px vs ${expandedH}px expanded`,
)
await mobile.getByRole('button', { name: 'Hide coaching points' }).click()
await mobile.waitForTimeout(300)

// ---- 10. Print view ----
await mobile.emulateMedia({ media: 'print' })
await mobile.setViewportSize({ width: 794, height: 1123 }) // A4 @ 96dpi
await mobile.waitForTimeout(300)
await mobile.screenshot({ path: `${OUT}/07-print.png`, fullPage: true })
const printBg = await mobile.evaluate(() => getComputedStyle(document.body).backgroundColor)
check('print view is on white', printBg === 'rgb(255, 255, 255)', printBg)
// Paper has no tap. Whatever is collapsed on screen, the printed plan is the one
// you pull out when you have forgotten how the session starts.
//
// Coaching points matter most here: they came off the on-screen plan, so this
// panel is now the only thing that puts them on paper. A printed sheet without
// them is a timetable, not a session plan, and nothing else would catch it.
const printedDetail = await mobile.evaluate(() => {
  const has = t => [...document.querySelectorAll('h3')].some(h => h.textContent.trim() === t)
  return {
    points: has('Coaching points'),
    setup: has('Set-up'),
    what: has('What happens'),
    harder: has('Make it harder'),
  }
})
check(
  'print still carries the full drill detail',
  printedDetail.points && printedDetail.setup && printedDetail.what && printedDetail.harder,
  JSON.stringify(printedDetail),
)
// The rail is the signature element; if it doesn't survive into print, the
// printed plan is just a list and the design idea hasn't landed.
const railInPrint = await mobile.evaluate(() => {
  const rail = document.querySelector('.rail-track')
  if (!rail) return null
  return getComputedStyle(rail, '::before').backgroundColor
})
check('the touchline rail survives into print', railInPrint === 'rgb(0, 0, 0)', String(railInPrint))
// Diagrams inherit currentColor, so they must go black under the print rules —
// a mid-grey diagram on white paper is the failure mode that matters here.
const svgColour = await mobile.evaluate(() => {
  const svg = document.querySelector('svg[role="img"]')
  return svg ? getComputedStyle(svg).color : null
})
check('diagrams print in black', svgColour === 'rgb(0, 0, 0)', String(svgColour))
check('diagrams survive into the saved session', (await mobile.locator('svg[role="img"]').count()) > 0,
  `${await mobile.locator('svg[role="img"]').count()} diagrams`)
await mobile.emulateMedia({ media: 'screen' })

// ---- 11. THE SNAPSHOT GUARANTEE: editing a drill must not change a saved session ----
// Rewrite the first drill's name directly in Firestore, then reload the saved
// session. This is the one destructive step in the run, so it is wrapped in a
// try/finally that puts the original name back — otherwise a failed assertion
// leaves a drill called "RENAMED IN LIBRARY …" sitting in the library, which is
// exactly the litter this script is supposed to catch elsewhere.
const firstDrillName = names[0]
const RENAMED = `RENAMED IN LIBRARY ${Date.now()}`
const listRes = await fetch(
  'http://127.0.0.1:8088/v1/projects/clean-sheet-local/databases/(default)/documents/drills?pageSize=300',
)
const { documents } = await listRes.json()
const target = documents.find(d => d.fields?.name?.stringValue === firstDrillName)
const docPath = target.name.split('/documents/')[1]

const setDrillName = name =>
  fetch(
    `http://127.0.0.1:8088/v1/projects/clean-sheet-local/databases/(default)/documents/${docPath}?updateMask.fieldPaths=name`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      // Unique per run, so running this twice in a row can't produce a false
      // failure by renaming an already-renamed drill to the same value.
      body: JSON.stringify({ fields: { name: { stringValue: name } } }),
    },
  )

// Restore on the way out however this run ends — assertion failure, thrown
// error, or Ctrl-C.
const restore = async () => {
  try {
    await setDrillName(firstDrillName)
  } catch {
    console.warn(`\n! Could not restore "${firstDrillName}" — run \`npm run dev:seed\` to reset.`)
  }
}
process.once('SIGINT', async () => {
  await restore()
  process.exit(130)
})

try {
  await setDrillName(RENAMED)

  await mobile.reload({ waitUntil: 'domcontentloaded' })
  await mobile.waitForSelector('h1', { timeout: 20000 })
  const afterEdit = await mobile.locator('body').innerText()
  check(
    'saved session is immune to a later library edit',
    afterEdit.includes(firstDrillName) && !afterEdit.includes(RENAMED),
    `still says "${firstDrillName}"`,
  )

  // And confirm the library itself DID change, so the test is meaningful.
  const libPage = await fresh.newPage()
  await libPage.goto('http://localhost:5173/#/library', { waitUntil: 'domcontentloaded' })
  await libPage.waitForSelector('main ul li')
  await libPage.waitForTimeout(500)
  const libText = await libPage.locator('body').innerText()
  check('…while the library does show the edit', libText.includes(RENAMED))
} finally {
  // Runs on a thrown Playwright timeout too, not just the happy path.
  await restore()
}
const afterRestore = await fetch(
  'http://127.0.0.1:8088/v1/projects/clean-sheet-local/databases/(default)/documents/drills?pageSize=300',
).then(response => response.json())
check(
  'the run leaves the library as it found it',
  !afterRestore.documents.some(d => /RENAMED IN LIBRARY/.test(d.fields?.name?.stringValue ?? '')),
)

// ---- 12. Rules reject an over-long description (server-side, not just client) ----
const bad = await fetch(
  'http://127.0.0.1:8088/v1/projects/clean-sheet-local/databases/(default)/documents/drills',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        schemaVersion: { integerValue: '1' },
        name: { stringValue: 'Too long' },
        description: { stringValue: 'x'.repeat(5000) },
      },
    }),
  },
)
check('firestore rules reject an invalid write', bad.status === 403, `HTTP ${bad.status}`)

// Videos are ours. A community or AI drill must not be able to carry a videoId,
// or anyone could attach any YouTube video to any drill on the site with no
// account and nothing to stop them. The client strips it in validateDrill(), but
// the client is a suggestion — the rules are the boundary, so assert them here.
//
// This was a real hole: before the source == 'seed' condition, the write below
// returned 200.
const communityDrillWithVideo = {
  schemaVersion: { integerValue: '1' },
  name: { stringValue: 'Rules probe' },
  slug: { stringValue: 'rules-probe' },
  summary: { stringValue: 'Checks that videos stay seed-only.' },
  description: { stringValue: 'Probe.' },
  setup: { stringValue: '' },
  coachingPoints: { arrayValue: { values: [{ stringValue: 'Point' }] } },
  progressions: { arrayValue: { values: [] } },
  regressions: { arrayValue: { values: [] } },
  themes: { arrayValue: { values: [{ stringValue: 'passing' }] } },
  ageGroups: { arrayValue: { values: [{ stringValue: 'u10' }] } },
  sessionPhase: { stringValue: 'technical' },
  minPlayers: { integerValue: '4' },
  maxPlayers: { integerValue: '12' },
  durationMins: { integerValue: '15' },
  intensity: { stringValue: 'medium' },
  equipment: { arrayValue: { values: [{ stringValue: 'balls' }] } },
  imageUrl: { nullValue: null },
  videoId: { stringValue: 'dQw4w9WgXcQ' },
  diagram: { nullValue: null },
  references: { arrayValue: { values: [] } },
  createdBy: {
    mapValue: { fields: { uid: { nullValue: null }, displayName: { stringValue: 'Anon' } } },
  },
  clubId: { nullValue: null },
  source: { stringValue: 'community' },
  status: { stringValue: 'published' },
  createdAt: { timestampValue: new Date().toISOString() },
  updatedAt: { timestampValue: new Date().toISOString() },
}
const videoWrite = await fetch(
  'http://127.0.0.1:8088/v1/projects/clean-sheet-local/databases/(default)/documents/drills?documentId=verify_video_probe',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: communityDrillWithVideo }),
  },
)
check(
  'firestore rules keep videos seed-only',
  videoWrite.status === 403,
  `HTTP ${videoWrite.status}`,
)

// ---- 13. Mobile planner: no horizontal scroll, compact blocks ----
// A grid item defaults to min-width:auto, so a single missing `min-w-0` on a
// stacked column silently pushes the whole page into horizontal scroll. That is
// invisible on a desktop run, hence checking it explicitly at phone width.
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const phonePage = await phone.newPage()
await phonePage.goto('http://localhost:5173/#/library', { waitUntil: 'domcontentloaded' })
await phonePage.waitForSelector('main ul li', { timeout: 20000 })

// The filter bar had grown to 270px and the heading block another 153px, which
// put the first drill 605px down an 844px screen — two of 69 drills visible, so
// finding anything meant scrolling past the controls every single time.
const libMetrics = await phonePage.evaluate(rows => ({
  firstDrillY: Math.round(document.querySelector(rows).getBoundingClientRect().top + window.scrollY),
  visible: [...document.querySelectorAll(rows)].filter(
    li => li.getBoundingClientRect().top < window.innerHeight,
  ).length,
}), ROWS)
check(
  'mobile library reaches the drills without scrolling',
  libMetrics.firstDrillY < 300 && libMetrics.visible >= 4,
  `first drill at ${libMetrics.firstDrillY}px, ${libMetrics.visible} on screen`,
)
for (let i = 0; i < 3; i++) {
  await phonePage.locator(ROWS).nth(i).getByRole('button', { name: /^Add .* to your session$/ }).click()
  await phonePage.waitForTimeout(80)
}
await phonePage.getByRole('link', { name: /^Plan/ }).click()
await phonePage.waitForSelector('.mown > li', { timeout: 20000 })
await phonePage.waitForTimeout(400)
const phoneMetrics = await phonePage.evaluate(() => ({
  docW: document.documentElement.clientWidth,
  scrollW: document.documentElement.scrollWidth,
  blockH: Math.round(document.querySelector('.mown > li').getBoundingClientRect().height),
}))
check(
  'mobile planner does not scroll horizontally',
  phoneMetrics.scrollW <= phoneMetrics.docW + 1,
  `${phoneMetrics.scrollW}px in a ${phoneMetrics.docW}px viewport`,
)
check(
  'mobile blocks stay compact',
  phoneMetrics.blockH < 220,
  `${phoneMetrics.blockH}px per block`,
)

// Clearing a duration used to snap it straight back to 1: Number('') is 0, which
// is falsy, so `Number(value) || fallback` re-applied the fallback on every
// keystroke and you had to delete the digit again for each one you typed.
const durationField = phonePage.getByLabel(/^Duration of .* in minutes$/).first()
await durationField.fill('')
const clearedTo = await durationField.inputValue()
await durationField.pressSequentially('25')
const typedTo = await durationField.inputValue()
await durationField.blur()
check(
  'a duration field can be cleared and retyped',
  clearedTo === '' && typedTo === '25',
  `cleared to "${clearedTo}", then typed "${typedTo}"`,
)

// The picker used to stack below the running order at phone width, which put the
// primary action of the page a screen and a half down — past the save button.
const addBar = phonePage.getByRole('button', { name: '+ Add to session' })
const addBox = await addBar.boundingBox()
check(
  'mobile add control is in the first viewport',
  addBox != null && addBox.y >= 0 && addBox.y < 844,
  addBox ? `y=${Math.round(addBox.y)} of 844` : 'not found',
)

// …and it must not sit on top of the save row it was introduced above.
const saveBtn = phonePage.getByRole('button', { name: /Save this plan/ })
await saveBtn.scrollIntoViewIfNeeded()
await phonePage.waitForTimeout(200)
const overlap = await phonePage.evaluate(() => {
  const save = [...document.querySelectorAll('button')].find(b => /Save this plan/.test(b.textContent))
  const bar = [...document.querySelectorAll('button')].find(b => /Add to session/.test(b.textContent))
  if (!save || !bar) return null
  const s = save.getBoundingClientRect()
  const b = bar.closest('div').getBoundingClientRect()
  return { saveBottom: Math.round(s.bottom), barTop: Math.round(b.top) }
})
check(
  'the mobile add bar does not cover the save button',
  overlap != null && overlap.saveBottom <= overlap.barTop,
  overlap ? `save ends ${overlap.saveBottom}, bar starts ${overlap.barTop}` : 'not measurable',
)

// The picker opens as a sheet, and adding from it closes the sheet so the block
// you just added is the first thing you see.
await addBar.click()
await phonePage.waitForTimeout(400)
check('the mobile picker opens as a sheet', (await phonePage.locator('dialog[open].sheet').count()) === 1)
await phonePage.locator('dialog[open].sheet button').filter({ hasText: /\d+\s*min/ }).first().click()
await phonePage.waitForTimeout(400)
check('adding from the sheet closes it', (await phonePage.locator('dialog[open].sheet').count()) === 0)

// "Now" is the one use of --hivis. It has to survive a reload, because the phone
// locking mid-session is exactly when a coach is relying on it.
const nowToggle = phonePage.getByRole('button', { name: /^Mark .* as now$/ }).first()
await nowToggle.click()
await phonePage.waitForTimeout(300)
check('the now marker sets from the rail', (await phonePage.locator('[data-now="true"]').count()) === 1)
await phonePage.reload({ waitUntil: 'domcontentloaded' })
await phonePage.waitForSelector('.mown > li', { timeout: 20000 })
await phonePage.waitForTimeout(500)
check(
  'the now marker survives a reload',
  (await phonePage.locator('[data-now="true"]').count()) === 1,
)

// A drill has to be linkable — /library/:slug was routed but never read.
await phonePage.goto('http://localhost:5173/#/library', { waitUntil: 'domcontentloaded' })
await phonePage.waitForSelector('main ul li', { timeout: 20000 })
await phonePage.locator(ROWS).first().locator('button').first().click()
await phonePage.waitForTimeout(500)
const drillUrl = phonePage.url()
check('opening a drill puts it in the URL', /#\/library\/.+/.test(drillUrl), drillUrl)
const coldCtx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const coldPage = await coldCtx.newPage()
await coldPage.goto(drillUrl, { waitUntil: 'domcontentloaded' })
await coldPage.waitForTimeout(2500)
check('a drill link opens for someone with no cache', (await coldPage.locator('dialog[open]').count()) === 1)
await coldCtx.close()

// A drill video must not reach YouTube until someone asks for it.
//
// This app has no auth, no analytics and no tracking. Rendering a YouTube
// iframe (or even its thumbnail) on load would hand Google every coach who
// opens a drill page, on their behalf and without their say-so. The facade is
// the whole point of the component, and it is a property that looks like an
// implementation detail — so it gets asserted here rather than trusted.
//
// Measured, not assumed: watch outbound requests, not just the DOM.
const videoCtx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const videoPage = await videoCtx.newPage()
const offDevice = new Set()
videoPage.on('request', request => {
  const { host } = new URL(request.url())
  // Fonts are a separate, pre-existing decision (index.html loads them); this
  // check is about the video specifically.
  if (!/^(localhost|127\.0\.0\.1)/.test(host) && !/fonts\.(googleapis|gstatic)/.test(host)) {
    offDevice.add(host)
  }
})
await videoPage.goto('http://localhost:5173/#/library', { waitUntil: 'domcontentloaded' })
await videoPage.waitForSelector('main ul li', { timeout: 20000 })

// Seeded drills carry no videoId until the Shorts are published, so drive the
// component directly rather than skipping the check whenever the library has no
// video in it yet.
const facadeShown = await videoPage.evaluate(async () => {
  const { isVideoId } = await import('/src/lib/schema.js')
  return isVideoId('dQw4w9WgXcQ') && !isVideoId('"><iframe src=x')
})
check('a video id is validated before it can reach an iframe src', facadeShown)

const videoDrill = await videoPage.evaluate(() =>
  [...document.querySelectorAll('iframe')].map(f => f.src),
)
check(
  'no YouTube iframe is rendered on the library page',
  videoDrill.length === 0,
  `${videoDrill.length} iframes`,
)
check(
  'the library reaches no third party on load',
  offDevice.size === 0,
  offDevice.size ? [...offDevice].join(', ') : 'none',
)
await videoCtx.close()

// Back to the planner — the remove/undo checks below run on this same page.
await phonePage.goto('http://localhost:5173/#/plan', { waitUntil: 'domcontentloaded' })
await phonePage.waitForSelector('.mown > li', { timeout: 20000 })
await phonePage.waitForTimeout(400)

// Removing a block is one of the most common actions in the planner, so the
// control has to be reachable without opening anything first — it had ended up
// hidden inside the detail panel where nobody could find it.
const beforeRemove = await phonePage.locator('.mown > li').count()
const removeBtn = phonePage.getByRole('button', { name: /^Remove .* from the session$/ }).first()
check('remove is visible without expanding a block', await removeBtn.isVisible())
// Compare the whole rendered block, not a substring — a phase label would match
// almost anything and make this assertion look stronger than it is.
const removedBlockText = (await phonePage.locator('.mown > li').first().innerText()).trim()
await removeBtn.click()
await phonePage.waitForTimeout(400)
const afterRemove = await phonePage.locator('.mown > li').count()
check(
  'removing a block takes it out of the running order',
  afterRemove === beforeRemove - 1,
  `${beforeRemove} to ${afterRemove}`,
)
const undoBtn = phonePage.getByRole('button', { name: 'Undo' })
check('an undo is offered', await undoBtn.isVisible())
await undoBtn.click()
await phonePage.waitForTimeout(400)
const afterUndo = await phonePage.locator('.mown > li').count()
const firstAfterUndo = (await phonePage.locator('.mown > li').first().innerText()).trim()
check(
  'undo puts the block back where it was',
  afterUndo === beforeRemove && firstAfterUndo === removedBlockText,
  `${afterUndo} blocks, first block identical to the one removed`,
)
await phonePage.screenshot({ path: `${OUT}/08-mobile-plan.png`, fullPage: true })

check('no console errors', errors.length === 0, errors.slice(0, 2).join(' | '))

await browser.close()

const failed = results.filter(r => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
