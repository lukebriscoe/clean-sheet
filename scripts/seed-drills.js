#!/usr/bin/env node
// Import data/seed-drills.json into Firestore.
//
//   npm run dev:seed     -> the local emulator (safe, no credentials needed)
//   npm run seed:prod    -> the real project (needs credentials, asks first)
//
// Idempotent: each drill gets a deterministic document id derived from its slug,
// so re-running updates the existing entries instead of creating duplicates. That
// means you can edit the JSON, re-run, and the library just catches up.

import { readFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const HERE = dirname(fileURLToPath(import.meta.url))
const SEED_FILE = resolve(HERE, '../data/seed-drills.json')
const isProd = process.argv.includes('--prod')

// Mirrors slugify() in src/lib/ids.js. Duplicated rather than imported because
// this script runs in Node without Vite's module resolution — if you change one,
// change the other (there is a test covering the app-side version).
function slugify(text) {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function connect() {
  if (!isProd) {
    // The emulator ignores credentials entirely, but the SDK still wants a projectId.
    process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8088'
    initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'clean-sheet-local' })
    console.log(`→ emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`)
    return
  }

  delete process.env.FIRESTORE_EMULATOR_HOST // never let a stray env var point prod at localhost
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim()

  const die = message => {
    console.error(`\n${message}\n`)
    process.exit(1)
  }

  if (!keyPath && !projectId) {
    die(
      'Seeding the live project needs credentials.\n\n' +
        'Download a key from the Firebase console:\n' +
        '  Project settings → Service accounts → Generate new private key\n\n' +
        'then:\n' +
        '  export GOOGLE_APPLICATION_CREDENTIALS=/path/to/that-file.json\n' +
        '  export FIREBASE_PROJECT_ID=your-project-id',
    )
  }

  // A GOOGLE_APPLICATION_CREDENTIALS that is set but points nowhere is the most
  // likely mistake here — `export VAR=$(ls …)` quietly yields an empty string
  // when the glob matches nothing. Left unchecked it falls through to Google's
  // application-default lookup and fails with "Could not load the default
  // credentials", which says nothing about the actual problem.
  if (keyPath && !existsSync(keyPath)) {
    die(
      `No service-account key at:\n  ${keyPath}\n\n` +
        'Check the file downloaded, and that the path is right. To pick the newest\n' +
        'key in your Downloads folder automatically:\n' +
        '  export GOOGLE_APPLICATION_CREDENTIALS=$(ls -1t ~/Downloads/*firebase-adminsdk*.json | head -1)',
    )
  }

  if (!keyPath) {
    die(
      'GOOGLE_APPLICATION_CREDENTIALS is empty.\n\n' +
        'If you set it with `export VAR=$(ls …)` and the file was not there, the\n' +
        'variable ends up as an empty string. Download the key first, then re-run.',
    )
  }

  // existsSync is not enough on macOS: stat succeeds inside ~/Downloads,
  // ~/Documents and ~/Desktop while reads are refused by TCC, so the file looks
  // present and then fails with a bare EPERM from deep inside firebase-admin.
  try {
    readFileSync(keyPath)
  } catch (caught) {
    if (caught.code === 'EPERM' || caught.code === 'EACCES') {
      die(
        `Not allowed to read:\n  ${keyPath}\n\n` +
          'macOS restricts access to Downloads, Documents and Desktop. Move the key\n' +
          'somewhere else and point at it there — e.g. into this project, where the\n' +
          'filename is already git-ignored:\n\n' +
          `  mv "${keyPath}" ./service-account.json\n` +
          '  export GOOGLE_APPLICATION_CREDENTIALS=./service-account.json',
      )
    }
    die(`Could not read the service-account key at:\n  ${keyPath}\n\n${caught.message}`)
  }

  initializeApp({ credential: cert(keyPath), projectId })
  console.log(`→ LIVE project ${projectId ?? '(from credentials)'}`)
}

async function confirmProd(count) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(
    `About to write ${count} drills to the LIVE database. Type "yes" to continue: `,
  )
  rl.close()
  if (answer.trim().toLowerCase() !== 'yes') {
    console.log('Cancelled — nothing written.')
    process.exit(0)
  }
}

async function main() {
  const { drills, retired = [] } = JSON.parse(await readFile(SEED_FILE, 'utf8'))
  if (!Array.isArray(drills) || !drills.length) {
    console.error(`No drills found in ${SEED_FILE}`)
    process.exit(1)
  }

  // Catch duplicate names before writing — two drills sharing a slug would
  // silently overwrite each other, and the loss would be hard to spot.
  const slugs = drills.map(drill => slugify(drill.name))
  const duplicates = slugs.filter((slug, index) => slugs.indexOf(slug) !== index)
  if (duplicates.length) {
    console.error(`Duplicate drill names in the seed file: ${[...new Set(duplicates)].join(', ')}`)
    process.exit(1)
  }

  connect()
  if (isProd) await confirmProd(drills.length)

  const db = getFirestore()
  const refs = slugs.map(slug => db.collection('drills').doc(`seed_${slug}`))

  // Which of these already exist? createdAt must survive a re-seed, otherwise
  // every run would reshuffle a library that is sorted by creation date.
  const existing = await db.getAll(...refs)
  const alreadyThere = new Set(
    existing.filter(snapshot => snapshot.exists).map(snapshot => snapshot.id),
  )

  const batch = db.batch()
  drills.forEach((drill, index) => {
    const ref = refs[index]
    const payload = {
      schemaVersion: 1,
      ...drill,
      slug: slugs[index],
      setup: drill.setup ?? '',
      progressions: drill.progressions ?? [],
      regressions: drill.regressions ?? [],
      imageUrl: drill.imageUrl ?? null,
      references: drill.references ?? [],
      createdBy: { uid: null, displayName: 'Clean Sheet' },
      clubId: null,
      source: 'seed',
      status: 'published',
      updatedAt: FieldValue.serverTimestamp(),
    }
    if (!alreadyThere.has(ref.id)) payload.createdAt = FieldValue.serverTimestamp()

    // The `about` block in the JSON is documentation for humans, not drill data.
    delete payload.about
    batch.set(ref, payload, { merge: true })
  })

  await batch.commit()
  const added = drills.length - alreadyThere.size
  console.log(`✓ Seeded ${drills.length} drills (${added} new, ${alreadyThere.size} updated).`)

  // Retire documents whose drill has been RENAMED.
  //
  // A document id is seed_<slug-of-name>, so renaming a drill writes a new
  // document and leaves the old one behind — the library would then show the
  // same drill twice, under both names. Seeding alone cannot notice this,
  // because the old slug simply is not in the file any more.
  //
  // Hidden rather than deleted: `status: 'hidden'` is how this project retires
  // content (filters.js drops it from the library), deletes are forbidden by
  // firestore.rules, and any saved session that referenced the old drill keeps
  // working off its frozen drillSnapshot regardless.
  if (retired.length) {
    const retiredRefs = retired.map(entry =>
      db.collection('drills').doc(`seed_${slugify(entry.slug ?? entry)}`),
    )
    const found = (await db.getAll(...retiredRefs)).filter(snapshot => snapshot.exists)

    if (found.length) {
      const hide = db.batch()
      for (const snapshot of found) {
        hide.set(
          snapshot.ref,
          { status: 'hidden', updatedAt: FieldValue.serverTimestamp() },
          { merge: true },
        )
      }
      await hide.commit()
      console.log(
        `✓ Retired ${found.length} renamed drill${found.length === 1 ? '' : 's'}: ` +
          found.map(s => s.id).join(', '),
      )
    } else {
      console.log(`· ${retired.length} retired slug(s) listed, none present — nothing to hide.`)
    }
  }

  process.exit(0)
}

main().catch(error => {
  console.error('Seeding failed:', error.message)
  process.exit(1)
})
