# Backlog

Everything worth doing next, grounded in the code as it stands rather than in
general good advice. Tick things off in place; add to it freely.

Read [`v1-tradeoffs.md`](v1-tradeoffs.md) first if a decision here looks odd —
most of the constraints below are deliberate and explained there.

There is a formatted version of this at
<https://claude.ai/code/artifact/50add4bd-f4ab-45e5-9343-4b9189bd7fb5>, but
**this file is the one to keep current**.

Where it stands today: 69 drills · 5 with a video · 64 with motion derived ·
0 accounts · 0 analytics.

---

## Start here

The three that unlock or protect the most. Not checkboxes — they are pointers to
items below, so there is only ever one place to tick.

1. **Firebase App Check** (§3) — the only real security control that doesn't need a login
2. **A diagram editor** (§4) — unblocks contributions, better drill pages, and video choreography
3. **Decide silent vs voiced** (§1) — before the next 59 uploads, because YouTube IDs are permanent

---

## 1. Finish the videos

The pipeline is proven end to end. What is left is content work and one
irreversible decision.

- [ ] **Narrate and render the remaining 59**
      `npm run motion:narrate` then `npm run render`. Roughly £1–2 of API credit and
      ~25 minutes of rendering. The manual YouTube upload is the slow part.

- [ ] **Decide on voiceover before uploading in bulk** ⚠ irreversible
      The five live videos are silent, captions only. Adding TTS later means
      re-uploading all 64 and re-linking every one. The lines are written; the muxing
      is already built in `render-videos.mjs`. Only the generation step is missing —
      Google Cloud TTS sits inside the free tier at ~26k characters for the library.

- [ ] **Fill the 11 gaps in [`video-gaps.md`](video-gaps.md)**
      2 drills have no diagram, 1 has no arrows, 2 have passes with no ball at the
      tail. 6 more draw more passes than balls so a beat is dropped. Every fix is a
      diagram edit, and each improves the drill page as well as the video.

- [ ] **Put the drill link in every video description**
      `npm run video:listings -- --link` already generates it. This is the only thing
      turning a YouTube viewer into a planner user, and it costs nothing.

- [ ] **Richer choreography where a video feels thin**
      Beats come from arrows, so a two-arrow diagram makes a two-beat video. Traffic
      Lights is the clearest case — the drill is about green/amber/red but the diagram
      draws two dribbles. Fix by drawing more arrows, never by hand-authoring motion.

- [ ] **Automate YouTube uploads — eventually**
      Two gates: an unaudited API project has uploads locked to private until it passes
      a compliance audit, and the default quota allows ~6 uploads/day. For a one-off
      library of 64, manual is genuinely faster.

---

## 2. Accounts — the keystone

No login was the right call: a signup wall between a coach and a warm-up idea is
how nobody ever uses this. But most of this backlog waits on identity. The seams
are already cut — every document carries `createdBy.uid: null` and `clubId: null`,
sessions carry `visibility`, and [`v1-tradeoffs.md §1`](v1-tradeoffs.md) has the
exact rules diff. It is a rules change, not a data migration.

- [ ] **Firebase Auth, optional rather than required**
      Anonymous use must survive — browse, plan, print, share with no account. Signing
      in should add things, not gate them.

- [ ] **Claim a drill you contributed** *(needs accounts)*
      The rules already lock a document to its owner the moment `createdBy.uid` is
      non-null. Only the flow is missing.

- [ ] **My sessions, across devices** *(needs accounts)*
      Today a saved plan lives in one browser's localStorage plus a share link. Coaches
      plan on a laptop and coach from a phone; that handoff is a copy-pasted URL.

- [ ] **Revocable share links** *(needs accounts)* ⚠ safeguarding
      `useSharedSession` already queries the `shareId` **field** rather than the
      document id — deliberately, so links can be revoked. The mechanism is designed;
      only the control is missing. The About page warns against naming children in a
      plan precisely because links cannot currently be pulled back.

- [ ] **Clubs** *(needs accounts)*
      `clubId` sits unused on every document and sessions already carry
      `visibility: 'public' | 'club'`. The natural unit for coaches sharing a library —
      and later, the natural unit to charge.

- [ ] **A coach profile on contributed drills** *(needs accounts)*
      Drills store a free-text `displayName` defaulting to "Anonymous coach".
      Attribution is the cheapest contribution incentive there is.

---

## 3. Safety and abuse

With no login, `firestore.rules` is the entire defence. It validates every field,
refuses deletes outright, and locks documents to owners once they exist. What it
cannot do is rate-limit, moderate, or tell a coach from a script.

- [ ] **Firebase App Check** ⚠ highest-value security item
      Rules validate the *shape* of a write, not the *volume* or *origin*. Anyone can
      read the client bundle and get your Firestore config — normal and fine — but with
      open writes, a loop can add ten thousand valid-looking drills and the only
      recovery is hiding them one at a time.

- [ ] **A moderation surface** ⚠ no recovery path today
      Hiding a bad drill currently means reaching for the admin SDK.
      `status: 'published' | 'hidden'` exists and `filters.js:61` honours it — there is
      just no way to use it without a service-account key.

- [ ] **Report this drill**
      One tap, writing to a separate collection, rate-limited by App Check. Pairs with
      moderation above — reporting without moderation is a queue nobody drains.

- [ ] **Budget alerts on Firebase and Anthropic** ⚠ unbounded downside
      The failure mode of a free-tier project is a surprise bill, not an outage. Open
      writes plus a public site means spend is a function of other people's behaviour.
      Set these before the AI assistant ships, not after.

- [ ] **Automated Firestore backups** ⚠ unrecoverable data
      Deletes are forbidden but vandalism isn't. Seed drills are safe in
      `data/seed-drills.json`; community drills and saved sessions have no copy
      anywhere.

- [ ] **Put the rules deploy in CI** ⚠ silent failure
      Pushing to `main` publishes the frontend only. An undeployed rules change fails
      server-side and silently — `hasOnly()` rejects the whole document, not just the
      new field. This has already caught us out once. At minimum, fail the build when
      `firestore.rules` has changed and hasn't been deployed.

- [ ] **Safeguarding review before accounts land** ⚠ legal and reputational
      Session notes are free text and coaches will write player names in them — the
      About page asks them not to, which tells you they would. Decide what may be
      stored, the retention, and what a deletion request triggers, before identity
      ships.

---

## 4. The product

Roughly by leverage — what makes the existing thing better before what adds surface.

- [ ] **A diagram editor**
      The single biggest gap. `DrillForm` only accepts an image URL; diagrams are
      authored by running a Node script, so only you can make one. That means community
      drills are text-only, and text-only drills can never have a video. Building this
      improves drill quality, unblocks contributions, *and* produces video
      choreography — one build, three payoffs.

- [ ] **Work offline**
      The whole product is used where the signal isn't. Drills are already fetched
      whole and filtered in the browser, and sessions carry frozen snapshots — the data
      model is most of the way there. A service worker and an install prompt finish it.

- [ ] **Previews when a plan is shared**
      Coaches share plans in WhatsApp, where a bare link looks like spam. `HashRouter`
      means nothing after the `#` reaches a server, so no crawler sees a title. Needs
      pre-rendering or a small edge worker. Sharing to a group chat is how this spreads.

- [ ] **Session templates**
      Warm-up, technical, small-sided game, match. The phase taxonomy already encodes
      that shape and `insertByPhase` already slots blocks into it.

- [ ] **Text search across the library**
      Filters answer "what can I run"; search answers "where's that one about…".
      Filtering is already client-side over the whole library so search can be too — no
      index, no extra reads, works offline.

- [ ] **Plan a block of weeks** *(better with accounts)*
      Six weeks on one theme, progressing. Where a coach graduates from "what shall we
      do tonight" to developing players — and the most natural thing a club would pay for.

- [ ] **Turn on the AI assistant** ⚠ real per-request cost
      `worker/` is built and switched off. It already has an origin allowlist, a
      KV-backed rate limit that fails closed, a fixed token ceiling, and
      schema-constrained output. Needs a deploy, a spend cap, and a decision on whether
      generated drills enter the shared library.

- [ ] **Print a whole session pack**
      Print is already a first-class output and quietly one of the best things here. A
      multi-week pack, a kit list for the block, a register page — the artefact a coach
      actually pins up.

---

## 5. Money

One principle worth holding: **the volunteer coach never pays.** That promise is why
it gets used and why people contribute. Everything below charges an organisation,
not an individual.

- [ ] **A club tier** *(needs accounts)*
      Private club library, club branding on printed plans, shared templates, a coach
      list. `clubId` and `visibility: 'club'` already exist — designed for, not bolted
      on. A junior club with fifteen teams paying modestly per season beats chasing
      individuals.

- [ ] **League and county partnerships** *(needs the club tier)*
      One sale reaches a hundred clubs. Leagues and county FAs already distribute
      coaching material and already have the relationship.

- [ ] **Let people support it directly**
      A quiet link on the About page. Volunteers won't take a subscription but some will
      buy you a coffee for saving them an hour a week — and it tells you something real
      about whether this matters, long before a pricing page could. Cheapest thing here.

- [ ] **Equipment affiliate links** ⚠ tone
      Every printed plan already ends with a generated kit list. An affiliate link there
      is useful rather than an advert — but it is also the first thing that could make
      the tool feel commercial, so it needs a light touch.

- [ ] **The YouTube channel as the funnel** *(already underway)*
      64 Shorts each ending on your domain is a search surface no landing page gives
      you. Costs nothing extra — just description links and consistent titles.

- [ ] **Coach education, later** *(needs an audience first)*
      A paid course or printable curriculum for new volunteers, sold to clubs who
      onboard parents every September. Highest-value thing on this page, and the videos
      are the first third of it.

---

## 6. Keeping it running

- [ ] **Privacy-respecting analytics**
      You currently cannot tell whether anyone uses any of this. No tracking at all is a
      genuine feature worth keeping — but a cookieless, self-hosted counter would tell
      you which drills get opened and whether videos send anyone to the site.

- [ ] **Know when it breaks**
      A coach hitting an error at 6pm on a Tuesday tells nobody. `npm run verify` catches
      regressions before deploy; nothing catches what happens after.

- [ ] **Component tests where the UI carries logic**
      Logic is well covered, the component layer isn't covered at all — a reasonable call
      while the UI changed weekly. As the surface grows (editor, auth, moderation) a few
      render tests get cheaper than finding it in production.

- [ ] **Add `motion:check` to CI**
      A redrawn diagram invalidates the shape indices its motion was authored against.
      The fingerprint check turns that into a loud failure — but only if something runs
      it. Needs a narrated-only mode first, since it currently fails for the 59
      un-narrated drills.

- [ ] **Keep dependencies current**
      A dormant side project is a supply-chain risk with a custom domain. Automated
      updates and a monthly audit.

---

## The thread running through this

The decision not to have accounts bought the thing that matters most — a coach goes
from link to printed session plan without typing an email address — and it is why
the library has contributions at all.

It is also what makes moderation manual, sharing permanent, offline partial, and a
club tier impossible. The seams for reversing it are already cut and cost nothing
sitting there. Worth being deliberate about when you pull them, rather than being
pushed into it by the first piece of abuse or the first parent asking what you store
about their child.
