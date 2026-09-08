# Clean Sheet

A free training-session planner for grassroots football coaches.

Start with a blank sheet, pull drills from a shared library, and end up with a
timed running order you can follow on your phone at the side of a pitch or print
for the other coaches. Built for volunteer youth coaches in the UK — no accounts,
no cost, no app to install.

**Live:** https://coaching.lukebriscoe.com

---

## What's in it

- **Drill library** — 69 drills, filterable by theme, age group, session phase,
  squad size, duration and the kit you actually have with you. The kit filter is
  inverted on purpose: it shows what you can run with *only* what you picked,
  because coaches filter by what's in the car. Anyone can add a drill, and every
  drill has its own link you can send to another coach.
- **Diagrams** — 67 of the drills have a pitch diagram, stored as data rather than
  as images and rendered to inline SVG. They cost nothing to host, print crisply in
  black and white, generate their own alt text, and are readable without colour —
  shape carries the meaning. See [`docs/data-model.md`](docs/data-model.md).
- **Session planner** — build a timed running order, reorder blocks, set per-block
  durations and notes, and see a live warning when you're over your target. Start
  times are derived from durations, so trimming a block moves everything below it.
  Removing a block is one tap and can be undone.
- **Built for a phone first.** This gets used one-handed, outdoors, while holding a
  clipboard. Every control is at least 44px, the drill picker opens as a bottom
  sheet within thumb reach, and your draft saves itself to the device as you go.
- **A "now" marker for the touchline.** Tap a start time to mark the block you're
  standing in front of. It survives the phone locking itself mid-session, and it
  works on a plan someone shared with you as well as on your own.
- **Share and print** — every saved session gets a link for the other coaches, plus
  an A4 print view with a kit list at the top. The printed sheet carries the full
  coaching points and diagrams even though the screen keeps them behind a tap.
- **Not yet: the AI assistant.** `worker/` is scaffolded and documented but not
  deployed. See [`docs/v1-tradeoffs.md`](docs/v1-tradeoffs.md) §6.

---

## Running it locally

```bash
npm install
npm run dev:start   # Firestore emulator + Vite together
npm run dev:seed    # load data/seed-drills.json into the emulator
```

Then open the URL Vite prints. In dev the app **always** talks to the local
emulator, so you can't accidentally write test data into the live shared library.
The emulator UI is at http://127.0.0.1:4001, and Firestore is on port 8088 rather
than the usual 8080 — that port is contended by too many other local dev servers to
be a sensible default.

To point at a real Firebase project, `cp .env.example .env` and fill it in — see
[`docs/deploy.md`](docs/deploy.md).

```bash
npm test            # vitest — 81 unit tests: timings, filters, diagrams, reducer
npm run verify      # 45 end-to-end browser checks (needs dev:start running)
npm run build       # production build
npm run preview     # serve the build locally
```

`npm run verify` drives the real UI in Chrome and covers what unit tests can't:
that the print view is genuinely black on white, that a share link opens for
someone with no localStorage, that the rules reject an invalid write server-side,
and that editing a library drill never changes a session somebody already saved.

---

## Where things live

```
data/seed-drills.json     the starter library, reviewable in a PR
firestore.rules           validation-as-defence (read this one)
scripts/seed-drills.js    idempotent importer — emulator or prod
scripts/add-seed-diagrams.mjs  authoring script for the seed diagrams
scripts/verify-e2e.mjs    browser checks against a running dev server
worker/                   AI proxy — phase 2, not deployed
docs/                     data model, trade-offs, content policy, deploy
src/
  lib/       timings.js, filters.js, schema.js, taxonomy.js  ← the logic + tests
  state/     session-context.jsx — the draft session, autosaved to localStorage
  hooks/     one per Firestore collection
  pages/     Library, Planner, SessionView
```

Longer tour: [`docs/data-model.md`](docs/data-model.md). If something in here looks
odd, [`docs/v1-tradeoffs.md`](docs/v1-tradeoffs.md) probably explains why, and
`CLAUDE.md` carries the working notes and the design rules.

---

## Contributing a drill

Through the site — there's an "Add a drill" button on the library page, no account
needed.

**Write it in your own words** rather than pasting from a coaching site or book.
If a drill is based on one you've read, describe it yourself and link to the
original as further reading — there's a field for it. The reasoning is in
[`docs/content-policy.md`](docs/content-policy.md).

To add one to the *seed* library instead, edit `data/seed-drills.json` and open a
PR — that way it gets reviewed before it ships.

---

## How it's built

React 18 + Vite, plain JavaScript, Tailwind v3 over CSS custom properties.
Firestore for the shared data. Static build deployed to GitHub Pages by GitHub
Actions on every push to `main`.

The theme lives entirely in `src/styles/theme.css` — retheming means editing that
one file, and components never hard-code a colour. It's a light palette built from
an overcast UK training night: green is demoted to ink and line rather than the
filled green header every football product reaches for, and the one high-vis
accent means "now" and nothing else. Type is Chivo (display, real tabular figures)
and Atkinson Hyperlegible (body, picked for bright-daylight legibility).

The signature element is the touchline rail down the running order — a continuous
line with five-minute tick marks, drawn the way a pitch is marked out in yards,
with the start times sitting on it. It survives into print, which is what makes it
an artefact rather than a flourish. Design rules are in `CLAUDE.md`.

Deliberately free-tier end to end: GitHub Pages for hosting, Firebase's free tier
for the database, and (later) Cloudflare Workers for the AI proxy.

`HashRouter` rather than `BrowserRouter` — Pages has no server rewrite, and the
`404.html` redirect trick flashes and breaks in enough edge cases that it isn't
worth it for a tool coaches open on a phone in a car park.

---

## No accounts, and how that's made safe

There is no login, so anyone can add a drill or save a session. That's a deliberate
trade-off: volunteer coaches will not create an account to look up a warm-up on a
Tuesday night, and a shared library is only useful if people contribute to it.

With no auth, `firestore.rules` is the *entire* defence, so it does real work:

- every field is type-, value- and length-validated, and unknown keys are rejected
- **deletes are forbidden outright** — nothing anonymous is destructive, and bad
  content is hidden reversibly via `status`
- a document locks to its owner the moment `createdBy.uid` is non-null, so turning
  auth on later is a rules change, not a data migration

[`docs/v1-tradeoffs.md`](docs/v1-tradeoffs.md) §1 covers the reasoning, what we
accept, and the three rules changes that close write access if you fork this for a
club — no data migration, because every document already carries
`createdBy: { uid: null }`.

Note that the rules deploy separately from the site: pushing to `main` publishes
the frontend only, and `firebase deploy --only firestore:rules` is a manual step.

---

## Licence

MIT. Fork it for your club — `.env.example` and
[`docs/deploy.md`](docs/deploy.md) cover pointing it at your own Firebase project.
