# Deploying Clean Sheet

Three pieces, all on free tiers: **GitHub Pages** (the site), **Firebase**
(the database), **Cloudflare Workers** (the AI proxy — phase 2, not yet).

Do these in order. Steps 1 and 2 are one-off.

---

## 1. Firebase project

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
   Analytics is optional and not used here.
2. **Build → Firestore Database → Create database.** Start in **production mode**
   (locked). Our rules replace the default. Pick a region near your users —
   `europe-west2` (London) for a UK club. **The region cannot be changed later.**
3. **Project settings → General → Your apps → Web app** (`</>`). Register the app
   and copy the `firebaseConfig` values.
4. Locally: `cp .env.example .env` and paste them in. These are not secrets — they
   ship in the client bundle of every Firebase web app. Firestore is protected by
   the rules, not by hiding this config.
5. In the repo: **Settings → Secrets and variables → Actions**, add each
   `VITE_FIREBASE_*` value as a repository secret. The deploy workflow reads them.

### Deploy the security rules

**This is separate from the site deploy and is the step people forget.** Pushing to
`main` publishes the frontend; it does *not* touch Firestore rules. Without this
step your database is either wide open or entirely closed, depending on the mode
you picked above.

```bash
npm install -g firebase-tools
firebase login
firebase use --add          # pick the project, alias it "default"
firebase deploy --only firestore:rules,firestore:indexes
```

Re-run that command whenever `firestore.rules` changes. Verify in the console under
**Firestore → Rules** that the published rules match the file.

### Seed the drill library

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
export FIREBASE_PROJECT_ID=your-project-id
npm run seed:prod
```

The script asks for confirmation before writing to the live database. It is
idempotent — each drill gets a document id derived from its slug, so re-running
updates the existing entries rather than duplicating them.

> Download the service account key from **Project settings → Service accounts →
> Generate new private key**. It is a real credential: `.gitignore` already covers
> `service-account*.json` and `*-firebase-adminsdk-*.json`, but keep it out of the
> repo directory entirely if you can, and delete it when you're done.

---

## 2. GitHub Pages and the custom domain

1. Push the repo to GitHub (public is fine — nothing secret is committed).
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. `public/CNAME` currently contains `coaching.lukebriscoe.com`. Change it if you
   are using a different domain — it is one line, and it is the only place the
   domain is hard-coded.
4. Add a DNS record at your registrar:

   | Type | Name | Value |
   | --- | --- | --- |
   | `CNAME` | `coaching` | `lukebriscoe.github.io.` |

   Point it at `<your-github-username>.github.io.` — the *user* site, not the repo.
   Note the trailing dot if your registrar wants a fully-qualified name.
5. Push to `main`. The workflow runs tests, builds, and publishes.
6. Back in **Settings → Pages**, the custom domain should verify. Tick **Enforce
   HTTPS** once the certificate is issued (usually minutes, occasionally an hour).

### Why no `--base` flag

`what-can-i-do` builds with `--base=/what-can-i-do/` because it is served from a
path on the apex domain. Clean Sheet is served from the root of its own subdomain,
so `base: '/'` in `vite.config.js` is correct and the workflow passes no override.

If you ever move it to a path instead, don't edit `vite.config.js` — pass the base
at build time: `npm run build -- --base=/clean-sheet/`.

---

## 3. Cloudflare Worker — phase 2, not yet

The AI assistant ships later. `worker/` holds the code and its own README with the
deploy steps. Nothing in the app calls it until `VITE_AI_WORKER_URL` is set, so
there is no half-wired state to worry about.

Read [`../worker/README.md`](../worker/README.md) before deploying — particularly
the cost section. It is an unauthenticated internet-facing endpoint attached to a
billing account, and the rate limiter is what stands between you and a surprise
invoice.

---

## Local development

```bash
npm install
npm run dev:start   # Firestore emulator + Vite, together
npm run dev:seed    # load the seed drills into the emulator
```

In dev the app **always** talks to the emulator (`src/firebase.js` switches on
`import.meta.env.DEV`), so you cannot accidentally write test data into the live
shared library while building a feature. The emulator UI is at
`http://127.0.0.1:4001`.

Emulator data persists between runs in `./emulator-data` (git-ignored). Delete that
directory for a clean slate.

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| "The drill library is not connected yet" | `.env` missing or empty. In CI, the `VITE_FIREBASE_*` repository secrets aren't set. |
| Library loads empty in production | Rules not deployed, or the seed script hasn't been run against the live project. Check **Firestore → Rules** and the data tab. |
| Adding a drill fails silently in production | Rules rejecting the write. The Firestore console's **Rules playground** will tell you which condition failed. |
| Custom domain shows a 404 | DNS not propagated, or `public/CNAME` doesn't match the domain in **Settings → Pages**. Both must agree. |
| Deep link 404s on refresh | Shouldn't happen — we use `HashRouter` precisely to avoid it. If it does, someone has swapped in `BrowserRouter` without adding a `404.html` fallback. |
