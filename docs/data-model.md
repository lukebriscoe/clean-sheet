# Data model

Two root-level Firestore collections: `drills` and `sessions`.

The shape is driven by one constraint that isn't obvious from the code: **v1 has no
authentication, but adding it later must not require moving or migrating a single
document.** Everything below follows from that, plus the need for a saved session
to stay readable pitchside on a bad connection.

---

## Why root collections

`calorie-track` nests everything under `users/{uid}/…`, which is right for private
per-user data. It would be fatal here: you cannot retro-fit ownership onto a path
that has no owner yet, so turning on auth would mean re-parenting every document.

Root collections plus a `createdBy.uid` field means enabling auth is **a rules
change and a backfill of nulls** — never a data migration. See
[`v1-tradeoffs.md`](./v1-tradeoffs.md) for the exact diff.

---

## `drills/{drillId}`

```js
{
  schemaVersion: 1,

  name: "Third-Man Runs in a Diamond",
  slug: "third-man-runs-in-a-diamond",
  summary: "One line — this is what a coach sees on the library card",
  description: "Markdown. What happens and why it works.",
  setup: "Markdown. Pitch size, cones, starting positions.",
  coachingPoints: ["Scan before you receive", "Weight the pass into the back foot"],
  progressions: ["Add a passive defender"],
  regressions: ["Remove the two-touch limit"],

  // Filter facets — flat and indexable, driving the library filters directly
  themes: ["passing", "possession"],
  ageGroups: ["u9", "u10", "u11"],
  sessionPhase: "technical",
  minPlayers: 6,
  maxPlayers: 12,
  durationMins: 20,
  intensity: "medium",
  equipment: ["cones", "balls"],

  imageUrl: null,
  diagram: { area: {...}, shapes: [...] },   // see below
  references: [{ label: "…", url: "https://…", source: "fa" }],

  createdBy: { uid: null, displayName: "Clean Sheet" },
  clubId: null,
  source: "seed",          // seed | community | ai
  status: "published",     // published | hidden
  createdAt, updatedAt,
}
```

### Field notes

**`slug`** — for readable deep links, and the seed script derives document ids from
it (`seed_third-man-runs-in-a-diamond`) so re-seeding updates rather than
duplicating.

**Facets are flat.** `themes` and `ageGroups` are arrays for `array-contains`;
everything else is a scalar. No nested objects in the filter path, because they
can't be indexed usefully and the client filter would need special-casing.

**`equipment` is inverted at query time.** Selecting kit in the UI means "show me
what I can run with *only* this", not "anything using cones" — a coach filters by
what's in the boot of their car. `matchesFilters` in `src/lib/filters.js` implements
that; it's the one filter that doesn't behave like the others, which is why it has
its own tests and a line of UI copy explaining it.

**`status`** — gives us moderation without auth and without deletes. Hiding is
reversible; deleting isn't, and the rules forbid it outright.

**`diagram`** stores the drill diagram as *data*, not an image — a shapes array
rendered to inline SVG by `src/components/ui/PitchDiagram.jsx`:

```js
diagram: {
  area: { w: 10, h: 10, unit: "yd" },
  shapes: [
    { t: "player", team: "a", x: 50, y: 8 },   // filled circle
    { t: "player", team: "b", x: 50, y: 50 },  // outlined circle
    { t: "cone",   x: 6,  y: 6 },
    { t: "ball",   x: 50, y: 14 },
    { t: "pass",   from: [50, 14], to: [86, 48] },
  ],
  caption: "Four on the edges, one defender inside.",
}
```

Why data rather than an uploaded PNG:

- **It costs nothing.** A diagram is a few hundred bytes inside a document we're
  already writing — no Cloud Storage bucket, no upload endpoint.
- **It prints properly.** Vector, so it's crisp at A4 and goes solid black under
  the print stylesheet. A photo of a whiteboard prints grey and unreadable.
- **The alt text can't drift.** `describeDiagram()` generates it from the same
  shapes that get drawn.
- **It's reviewable.** Seed diagrams are diffable in a pull request.
- **An open image upload with no auth would be an abuse magnet.** Rules can
  validate a shapes array; they cannot validate what's inside a JPEG.

Coordinates are always 0–100 on both axes. The renderer scales *positions* to the
area's aspect ratio and leaves shape sizes alone, so a 30×20 grid renders wide
without turning the players into ovals.

**Shape carries the meaning; colour is decoration.** Team A is filled, team B is
outlined, cones are triangles, the ball is a ring with a centre dot. Nothing
depends on colour, which is what makes greyscale printing and colourblind readers
work without a second code path.

`normaliseDiagram()` drops malformed shapes rather than throwing — a bad shape
from a community or AI submission costs you that shape, not the whole drill page.
The rules cap the array at 60 shapes.

**`clubId`** is unused in v1 and always `null`. It's the seam a paid, club-scoped
tier would use. Adding a field later is easy; backfilling one across a library
other clubs have contributed to is not, so it costs nothing now and saves a
migration later.

**`schemaVersion`** — a stored draft or document from an older shape can be
detected and discarded rather than crashing the planner.

---

## `sessions/{sessionId}`

```js
{
  schemaVersion: 1,

  title: "U10 — Pressing as a Unit",
  ageGroup: "u10",
  theme: "defending",
  dateFor: "2026-09-06",   // or null
  startTime: "18:30",      // or "" — drives the wall-clock running order
  durationMins: 90,        // the coach's target
  playerCount: 14,
  objectives: "What we want them to leave with",

  blocks: [ /* see below */ ],

  shareId: "k7f3q9xr",
  visibility: "public",    // public | club — seam for the paid tier
  createdBy: { uid: null, displayName: "Coach Luke" },
  clubId: null,
  createdAt, updatedAt,
}
```

### Blocks are embedded and snapshotted

```js
{
  id: "blk_a1b2c3d4",
  drillId: "drl_xyz",      // null for a freeform block
  phase: "warmup",
  durationMins: 15,
  notes: "Only 9 turned up — shrink the area",   // this coach, this session
  drillSnapshot: {
    name, summary, setup, description,
    coachingPoints, progressions, regressions,
    equipment, references,
  },
}
```

Three reasons, in order of importance:

1. **A printed plan must not change under the coach's feet.** If someone edits the
   shared drill next Tuesday, the session printed on Saturday must still say what
   was printed. The snapshot freezes it. There's a test for this and a manual
   verification step in the README, because it's the kind of thing that regresses
   silently.
2. **One document read, no N+1.** A session is always read whole, which matters on
   a wet touchline with two bars of signal.
3. `drillId` is kept anyway, so a session can still link back to the live drill.

Firestore's 1MB document limit is nowhere near binding — eight blocks is a few KB,
and the rules cap `blocks` at 30 regardless.

### Timings are derived, never stored

A block knows how long it lasts. *Where* it falls in the session is computed from
everything before it, in `src/lib/timings.js`. Storing start times would mean every
reorder or retime could leave stale values behind; deriving them makes that
impossible by construction.

### `shareId`

12 characters from a 32-character alphabet with no look-alikes — about 60 bits.
Sessions are looked up by this field, not by document id, which keeps URLs short
and means a share link could be revoked later by regenerating it without touching
the document.

It is **unguessable, not private**. See [`v1-tradeoffs.md`](./v1-tradeoffs.md).

---

## Indexes

`firestore.indexes.json` is deliberately empty. The library is fetched once per page
load and filtered in the browser (`src/lib/filters.js` explains why), so the app
only issues simple ordered queries, which Firestore's automatic single-field
indexes already cover. Composite indexes go in that file if the library ever
outgrows client-side filtering.

---

## Validation lives in two places, on purpose

`src/lib/schema.js` validates for **good error messages** — it tells a coach which
field is too long and why. `firestore.rules` validates for **actual safety** — with
open write access the client is a suggestion, and the rules are the only boundary
that matters.

They intentionally duplicate the same constraints. Rules can't import JavaScript,
so if you change a limit in `src/lib/taxonomy.js` (`LIMITS`) or add a value to a
taxonomy list, mirror it into `firestore.rules` in the same commit. That
duplication is the price of having a real server-side check.
