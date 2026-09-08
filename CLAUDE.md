# Clean Sheet — working notes

Training session planner for grassroots football coaches. Read
[`README.md`](README.md) first, then [`docs/v1-tradeoffs.md`](docs/v1-tradeoffs.md)
— most of what looks odd in this codebase is explained there.

## Conventions

- **Plain JavaScript and JSX. No TypeScript.** Matches `what-can-i-do` and
  `calorie-track`.
- **Tailwind v3 mapped onto CSS custom properties.** Every colour is an RGB triplet
  in `src/styles/theme.css`; `tailwind.config.js` maps the names. Don't hard-code a
  colour in a component.
- **One hook per Firestore collection**, calling Firestore directly. No `lib/db`
  abstraction layer.
- **Tests colocated** as `*.test.js`, `environment: 'node'`, no jsdom. Logic is
  tested (`lib/`, the session reducer); components are not.
- Commands: `npm run dev:start` (emulator + Vite), `npm run dev:seed`, `npm test`.

## Things that will bite you

**`firestore.rules` is the only real validation.** v1 has no auth, so the client is
a suggestion. `src/lib/schema.js` exists for friendly error messages; the rules are
the boundary. **If you change `LIMITS` or add a value to a taxonomy list in
`src/lib/taxonomy.js`, mirror it into `firestore.rules` in the same commit** —
rules can't import JS, so the duplication is deliberate and it *will* silently
reject valid writes if the two drift.

**Session blocks carry a frozen `drillSnapshot`.** Editing a drill in the library
must never change a session someone already saved and printed. Don't "optimise"
this into a join. There's a test for it in `src/state/session-context.test.js`.

**Timings are derived, never stored.** `src/lib/timings.js` computes start offsets
from durations. Don't add a `startMin` field to a stored block.

**Equipment filtering is inverted.** Selecting kit means "show me what I can run
with *only* this", not "anything using cones". Intentional — coaches filter by
what's in the car. See `matchesFilters` in `src/lib/filters.js`.

**Deletes are forbidden by the rules.** Hide via `status: 'hidden'` instead. Don't
add a delete path expecting it to work.

**`nowId` must never reach Firestore.** The "now" marker lives on the session
object so it survives a phone locking mid-training, which means it rides along in
localStorage — but `firestore.rules` uses `hasOnly()`, so an extra key rejects the
*whole* write. `sanitiseSessionForSave()` in `src/lib/schema.js` strips it along
with `savedId`; that is the single place a device-local field gets dropped, so add
any new one there rather than at the call site. There's a test for it in
`src/state/session-context.test.js`.

**Never wrap a group of chips in `Field` without `group`.** `<button>` is a
*labelable* element, so a `<label>` around a chip row silently adopts the first
chip as its control: that chip's accessible name becomes the whole group's text,
and tapping the section heading toggles it. `Field` takes a `group` prop that
renders `fieldset`/`legend` instead — use it for anything that isn't a single
input. `DrillFilters` already did this correctly; `DrillForm` did not.

**On `<input type="number">`, `min` must sit on the `step` ladder.** `min="1"
step="5"` means the browser only accepts 1, 6, 11, 16… — which made the add-drill
form's own default of 15 minutes invalid and blocked every submission behind a
native tooltip the app never sees. The failure is completely silent from the
app's side: no error state, no console, `onSubmit` simply never fires.

**`button { display: none }` in print.css is a blanket rule.** A control that also
carries information has to opt back out with `.print-keep`, or printing silently
deletes it. This currently applies to the rail's start times, which are buttons so
they can toggle the "now" marker — without the opt-out, the printed sheet loses its
schedule and nothing warns you.

**Anything sticky below the header offsets by `var(--header-h)`, never a literal.**
The header grows a row whenever a session is in progress, so its height is not a
constant; `App.jsx` measures it with a `ResizeObserver`. A hardcoded offset works
until a coach has blocks in their plan, then tucks the library's filter bar under
the header — i.e. it looks fine in testing and breaks for every returning user.

**Diagrams are data, not images**, rendered to SVG by `PitchDiagram.jsx`. The rule
that makes it work: *shape carries the meaning, colour is decoration* — team A is
filled, team B outlined, cones are triangles. Don't introduce a mark that can only
be told apart by colour; it breaks the print output and colourblind readers at the
same time. Everything draws with `currentColor` so print needs no second path.
Edit the seed diagrams via `scripts/add-seed-diagrams.mjs`, not by hand in the JSON.

**Drill markdown is sanitised.** It's written by anonymous strangers and rendered in
everyone's browser. Always go through `renderMarkdown()` in `src/lib/markdown.js` —
never `dangerouslySetInnerHTML` with raw input.

**`base: '/'` is correct.** This is served from the root of its own subdomain, not
a project path like `what-can-i-do`. Don't add a `--base` flag to the workflow.

**Rules deploy separately from the site.** Pushing to `main` publishes the frontend
only. `firebase deploy --only firestore:rules` is a manual step and the easy one to
forget.

## Content policy

Drills must be written in our own words, never copied from a published source;
link out as "further reading" instead. Applies to seed data, the add-drill form,
and the AI assistant's system prompt. [`docs/content-policy.md`](docs/content-policy.md).

Keep this as a *rule the project follows*, not as copy in the interface. The UI
previously carried disclaimers about it ("inspired by FA and FIFA principles,
never copied from them") and they read as defensive — nobody asked. The
contributor-facing line on the add-drill form is the only place it belongs.

## Design — "grey matchday"

Light theme built from an overcast UK training night. All tokens live in
`src/styles/theme.css`; `tailwind.config.js` only maps names. **Never hard-code a
colour in a component.**

`--paper` cool off-white · `--pitch` deep green (primary) · `--pitch-mid` ·
`--ink` body · `--mist` secondary · `--hivis` accent · `--whistle` warnings.

Four rules that are load-bearing:

1. **Green is ink and line, never a filled hero banner.** The reflex move for a
   football product is a big green header; inverting that is most of why this
   doesn't look like every other sports app.
2. **THE HIVIS RULE.** `--hivis` is ~1.7:1 on paper. It must never carry text on
   the background and never be a text colour on a light surface — only a fill
   behind `--ink`, or a bar ≥3px. It marks **"now" and nothing else**; using it
   as a generic selected state destroys the one piece of look-here signalling.
3. **No six-hue phase rainbow.** Two greens and one yellow. Phases are told apart
   by rail position, label, and `PhaseMark` weight — not by colour.
4. **No mono micro-labels, no card shadows, no entrance animations.** All three
   were the AI-UI tells in the previous build. Section labels are `.label-sm`
   (small bold uppercase Chivo). Separation comes from the paper/white value step.

Type is two families: **Chivo** (display + all figures — tabular, so no mono face
is needed) and **Atkinson Hyperlegible** (body — chosen for bright-daylight
glanceability, not style).

**The touchline rail** (`TouchlineRail.jsx` + `.rail-*` in theme.css) is the
signature element: a continuous vertical line with 5-minute tick marks, times
sitting on it. The continuity is the whole point — if you change the row padding,
keep the `-my-3` on `.rail-track` or the line fragments per block. It survives
into print deliberately, which is what makes it an artefact rather than a flourish.

**"Now" is a pitchside control, not a planning one.** It marks the block a coach is
standing in front of, so it has to work where that happens: it persists (a phone
locks every couple of minutes on a touchline) and it exists on the read-only
`/session/:shareId` view, not just in the planner. The affordance is the start time
on the rail itself — tapping it toggles the marker — so the feature costs no extra
chrome and the target sits where the eye already is. In the shared view it is held
per-`shareId` under `clean-sheet:now:v1`, deliberately *not* on the draft session:
whoever opens a share link usually has a half-built plan of their own and following
someone else's session must not reach into it.

Controls are **≥44px** — this gets used one-handed on a phone while holding a
clipboard. Focus is a **two-tone ring** (pitch outline + chalk shadow) so it stays
visible on paper, on white cards, and on dark green buttons alike.

The drill library is **rows, not cards** — a team sheet, not a dashboard.

**Below `lg`, right-rail panels move into a bottom sheet** (`components/ui/Sheet.jsx`,
a native `<dialog>` like `DrillDetail`) opened from a bar pinned to the bottom of the
viewport. Stacking them under the main column instead is what the grid does by
default, and it buried the planner's drill picker a screen and a half below the fold
— the primary action on the primary device, reachable only by scrolling past the
save button.

## Not in v1

The AI assistant. `worker/` is scaffolded and documented but not deployed, and
nothing calls it until `VITE_AI_WORKER_URL` is set. It uses `claude-opus-5` with
schema-constrained output — read [`worker/README.md`](worker/README.md) before
touching it, especially the cost section.
