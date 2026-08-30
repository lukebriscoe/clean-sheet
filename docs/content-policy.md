# Content policy

Clean Sheet leans on **The FA's England Football Learning** site and the **FIFA
Training Centre** as its reference points for youth coaching philosophy. It does
not reproduce their material. This document is the rule, and it applies to seed
drills, community submissions, and anything the AI assistant generates.

## The rule

**Write it in your own words. Link to theirs.**

| Allowed | Not allowed |
| --- | --- |
| Describing a drill you have run, in your own words | Copying or lightly rewording a drill description from a published source |
| Following FA/FIFA coaching *principles* — player-centred, small-sided, high touches, warm-up → practice → game | Reproducing their explanatory text about those principles |
| Linking out to an FA or FIFA page as "further reading" | Embedding or re-hosting their images, diagrams, or video |
| Naming a drill with a term that is in common coaching use ("rondo", "third-man run") | Using a name or programme title that is distinctively theirs as if it were ours |

Coaching *ideas* are not ownable — a 4v1 rondo belongs to football, not to any
governing body. The *expression* of those ideas is. That distinction is the whole
policy: take the idea, write your own expression, credit the source.

## How it's enforced

**Seed drills** (`data/seed-drills.json`) were written from scratch for this
project. The file carries a note saying so. Every entry is reviewable in a pull
request precisely so this can be checked before it ships.

**Community submissions** get a plain-English notice in the add-drill form:

> Please write it in your own words. Don't paste text from The FA's England
> Football Learning site, the FIFA Training Centre, or any coaching book. If your
> drill is based on one of theirs, describe it yourself and link to the original as
> further reading.

We cannot technically prevent someone pasting copyrighted text into an open form.
What we can do is ask clearly, make the right thing easy (there is a references
field), and remove anything reported. Since `firestore.rules` forbids deletes,
removal means setting `status: "hidden"` — which takes the content out of the
library and every search result immediately.

**AI-generated drills** carry `source: "ai"` so they stay identifiable, and the
worker's system prompt states the rule directly. See
[`../worker/worker.js`](../worker/worker.js).

## References — why they point at landing pages

Entries in a drill's `references` array link to section landing pages
(`learn.englandfootball.com`, `fifatrainingcentre.com`) rather than deep article
URLs. Deep links to those sites rot quickly, and a coach following a "see also"
link mid-session and hitting a 404 is worse than a slightly less precise link. The
`label` carries the specificity instead — it says what to look for once you're
there.

## If someone objects

If The FA, FIFA, or any other rights holder raises a concern about a specific
entry, hide it immediately (`status: "hidden"`), then work out whether it can be
rewritten from scratch or should stay gone. Don't argue the toss over a drill
description — the library's value is in its breadth, not in any single entry.
