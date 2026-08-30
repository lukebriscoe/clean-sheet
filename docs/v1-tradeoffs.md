# v1 trade-offs

The deliberate compromises in the first version of Clean Sheet, why each one was
made, and what it would take to reverse it. If you are reviewing this project and
something looks wrong, check here first — it is probably on purpose.

---

## 1. There is no login. Anyone can write to the database.

**What that means in practice.** Any visitor can add a drill to the shared library,
edit a drill that has no owner, and save a session. No email, no account, no
verification.

**Why.** The users are volunteer coaches, usually on a phone, often five minutes
before training. A signup wall between a coach and a warm-up idea is the single
most reliable way to make sure nobody ever uses this. The value of the library
depends on coaches contributing to it, and every step between "I have a good drill"
and "it's in the library" loses people.

**What stops it being a disaster.** With no auth, `firestore.rules` is the entire
defence, so it does three things:

1. **Validates every field.** Types, allowed values, string length caps, array size
   caps, and `hasOnly()` on the key set — so the collection cannot be used as free
   object storage or filled with arbitrary junk.
2. **Refuses deletes outright.** `allow delete: if false` on both collections.
   Nothing an anonymous visitor does is destructive or irreversible. Bad content is
   hidden by setting `status: "hidden"`, which is reversible.
3. **Locks documents to their owner the moment one exists.** Updates are allowed
   only while `createdBy.uid == null`.

**What we accept.** Someone could add a nonsense drill, or edit a good one badly.
That is recoverable: nothing is deletable, everything is in one collection, and the
seed drills are version-controlled in `data/seed-drills.json` and can be re-imported
at any time.

**How to close it.** Three changes, no data migration:

```diff
  match /drills/{drillId} {
    allow read: if true;
-   allow create: if validDrill() && incoming().createdBy.uid == null
+   allow create: if request.auth != null && validDrill()
+                 && incoming().createdBy.uid == request.auth.uid
                  && incoming().source != 'seed';
-   allow update: if validDrill() && isUnowned(resource.data);
+   allow update: if validDrill() && (isUnowned(resource.data)
+                 || resource.data.createdBy.uid == request.auth.uid);
  }
```

Plus a `useAuth` hook on the frontend and setting `createdBy.uid` on write. Existing
documents keep working because they already carry `createdBy: { uid: null }` — they
simply stay editable-by-anyone until someone claims them, which is the correct
behaviour for content the community contributed anonymously.

---

## 2. The drill library is fetched whole and filtered in the browser.

**Why.** Firestore bills per document read and cannot combine several
`array-contains` clauses with range filters in one query anyway. A few hundred
drills is a couple of hundred KB. Fetching once and filtering in memory makes every
filter instant, works on a bad connection, and costs one read per page load rather
than one per filter change.

**When to revisit.** Somewhere north of about a thousand drills. At that point add
the composite indexes to `firestore.indexes.json` and move the common facets
server-side, keeping the text search client-side.

---

## 3. Sessions embed a frozen copy of each drill.

A saved session does not join to the drill library at read time. It carries its own
`drillSnapshot` of every block, taken when the coach added it.

**Why.** Two reasons, and the second is the important one:

1. A session is always read whole, so this is one document read instead of N+1.
2. **A printed plan must not change under the coach's feet.** If someone edits the
   shared drill next Tuesday, the session you printed on Saturday must still say
   what you printed. There is a test for this
   (`src/state/session-context.test.js`) and a manual verification step in the
   README, because it is the kind of behaviour that quietly regresses.

`drillId` is still stored, so a session can link back to the live drill.

---

## 4. Share links are unguessable, not private.

A saved session lives at `#/session/:shareId`, where `shareId` is 12 characters
from a 32-character alphabet — about 60 bits. Anyone with the link can read the
session; there is no access check.

**Why.** The whole point is handing a link to four other volunteer coaches, none of
whom have accounts.

**What we accept.** A session is not private. The About page says so in plain
English. Do not put anything sensitive in a session plan — and note that a plan
naming individual children ("work with Jack on his weaker foot") is exactly the
kind of thing that shouldn't go in one until auth exists.

---

## 5. Reordering uses buttons, not drag-and-drop.

**Why.** This gets used one-handed on a phone at the side of a pitch. Touch
drag-and-drop is fiddly, hard to undo, and inaccessible to keyboard and screen
reader users. Up/down buttons work everywhere with no library.

---

## 6. The AI assistant is not in v1.

The `worker/` directory is scaffolded and documented but **not deployed**, and
nothing in the app calls it. It turns on when `VITE_AI_WORKER_URL` is set.

**Why.** The library and planner are useful on their own and cost nothing to run.
An internet-facing endpoint holding an Anthropic API key costs real money on every
request and would have been spending it from day one, before we knew whether any
coach was using the tool at all.

**What the worker already accounts for**, so it isn't bolted on later: an origin
allowlist, a KV-backed per-IP rate limit that fails closed if the KV namespace is
missing, a fixed `max_tokens` and `effort` the caller cannot raise, and
schema-constrained output. See [`../worker/README.md`](../worker/README.md).

---

## 7. No tests on components, only on logic.

Vitest covers `lib/timings.js`, `lib/filters.js`, and the session reducer — the
places where a bug would silently produce a wrong session plan. There are no
component render tests, matching the convention in `what-can-i-do`.

**Why.** The component layer changes shape often at this stage and the logic layer
is where the real risk lives. If this grows, `@testing-library/react` plus a jsdom
environment is the natural next step.
