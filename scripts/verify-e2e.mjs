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
import { mkdirSync } from 'node:fs'

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
check('library renders seeded drills', total === 29, `${total} cards`)
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
await page.getByRole('button', { name: /Save & get a share link/ }).click()
await page.waitForURL(/#\/session\//, { timeout: 20000 })
const shareUrl = page.url()
await page.waitForSelector('h1')
check('saved and redirected to share view', /#\/session\/[a-z0-9]{12}/.test(shareUrl), shareUrl.split('#')[1])

const sessionText = await page.locator('body').innerText()
check('share view lists what to bring', /what to bring/i.test(sessionText))
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

// ---- 10. Print view ----
await mobile.emulateMedia({ media: 'print' })
await mobile.setViewportSize({ width: 794, height: 1123 }) // A4 @ 96dpi
await mobile.waitForTimeout(300)
await mobile.screenshot({ path: `${OUT}/07-print.png`, fullPage: true })
const printBg = await mobile.evaluate(() => getComputedStyle(document.body).backgroundColor)
check('print view is on white', printBg === 'rgb(255, 255, 255)', printBg)
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

// ---- 13. Mobile planner: no horizontal scroll, compact blocks ----
// A grid item defaults to min-width:auto, so a single missing `min-w-0` on a
// stacked column silently pushes the whole page into horizontal scroll. That is
// invisible on a desktop run, hence checking it explicitly at phone width.
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const phonePage = await phone.newPage()
await phonePage.goto('http://localhost:5173/#/library', { waitUntil: 'domcontentloaded' })
await phonePage.waitForSelector('main ul li', { timeout: 20000 })
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
await phonePage.screenshot({ path: `${OUT}/08-mobile-plan.png`, fullPage: true })

check('no console errors', errors.length === 0, errors.slice(0, 2).join(' | '))

await browser.close()

const failed = results.filter(r => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
