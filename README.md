# Clean Sheet

A free training-session planner for grassroots football coaches.

Start with a blank sheet, pull drills from a shared library, and end up with a
timed running order you can read on your phone at the side of a pitch or print for
the other coaches. Built for volunteer youth coaches in the UK — no accounts, no
cost, no app to install.

**Live:** https://coaching.lukebriscoe.com

---

## ⚠️ v1 has open write access

**There is no login. Anyone can add a drill or save a session.** That is a
deliberate trade-off, not an oversight — volunteer coaches will not create an
account to look up a warm-up on a Tuesday night, and the library is only useful if
people contribute to it.

It is made survivable by `firestore.rules`, which with no auth is the *entire*
defence:

- every field is type-, value-, and length-validated, and unknown keys are rejected
- **deletes are forbidden outright** — nothing anonymous is destructive, bad content
  is hidden reversibly via `status`
- a document locks to its owner the moment `createdBy.uid` is non-null, so turning
  on auth later is a rules change, not a data migration

Read [`docs/v1-tradeoffs.md`](docs/v1-tradeoffs.md) before judging any of this — it
covers the reasoning, the risks, and the ten-line diff that closes write access.

---

## What's in it

- **Drill library** — 29 seed drills, filterable by theme, age group, session phase,
  squad size, duration and the kit you actually have with you. Anyone can add more.
- **Diagrams** — 27 of the drills have a pitch diagram, stored as data and rendered
  as inline SVG. They cost nothing to host, print crisply in black and white, and
  generate their own alt text. See [`docs/data-model.md`](docs/data-model.md).
- **Session planner** — build a timed running order, reorder blocks, set per-block
  durations and notes, and see a live warning when you're over your target.
- **Share and print** — every saved session gets a link for the other coaches and a
  stripped-back A4 print view with a "what to bring" list at the top.
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
The emulator UI is at http://127.0.0.1:4001.

To point at a real Firebase project, `cp .env.example .env` and fill it in — see
[`docs/deploy.md`](docs/deploy.md).

```bash
npm test            # vitest — timings, filters, diagrams, session reducer
npm run verify      # end-to-end browser checks (needs dev:start running)
npm run build       # production build
npm run preview     # serve the build locally
```

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

Longer tour: [`docs/data-model.md`](docs/data-model.md).

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

## Tech

React 18 + Vite, plain JavaScript, Tailwind v3 over CSS custom properties. The
whole theme lives in `src/styles/theme.css` — retheming means editing that one
file. Type is Chivo (display, tabular figures) and Atkinson Hyperlegible (body,
picked for bright-daylight legibility). See `CLAUDE.md` for the design rules.
Firestore for the shared data. Static build deployed to GitHub Pages by GitHub
Actions on every push to `main`.

Deliberately free-tier end to end: GitHub Pages for hosting, Firebase's free tier
for the database, and (later) Cloudflare Workers for the AI proxy.

`HashRouter` rather than `BrowserRouter` — Pages has no server rewrite, and the
`404.html` redirect trick flashes and breaks in enough edge cases that it isn't
worth it for a tool coaches open on a phone in a car park.

---

## Licence

MIT. Fork it for your club — `.env.example` and
[`docs/deploy.md`](docs/deploy.md) cover pointing it at your own Firebase project.
