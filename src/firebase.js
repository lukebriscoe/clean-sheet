import { initializeApp } from 'firebase/app'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'

// The Firebase *web* config is not a secret — it ships in every client bundle and
// Firestore is protected by security rules, not by hiding these values. We read it
// from env vars anyway so that another club can fork this repo and point it at
// their own project without editing source. See .env.example.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const hasRealConfig = Boolean(firebaseConfig.projectId && firebaseConfig.apiKey)

// In dev we always talk to the emulator (below), which needs no real project — so
// the app is fully usable with an empty .env. Only production genuinely requires
// config, and a missing config there is the most likely first-deploy failure, with
// an inscrutable error from Firebase. Say what's wrong once, in plain English.
export const isConfigured = hasRealConfig || import.meta.env.DEV
if (!hasRealConfig && !import.meta.env.DEV) {
  console.warn(
    '[Clean Sheet] Firebase is not configured. Set the VITE_FIREBASE_* environment ' +
      'variables — see .env.example and docs/deploy.md.',
  )
}

// The emulator ignores the credentials but still needs a project id to build
// document paths, so fall back to the one the seed script writes to. Keyed off
// hasRealConfig, not isConfigured — in dev the latter is true by design.
const app = initializeApp(
  hasRealConfig ? firebaseConfig : { projectId: 'clean-sheet-local', apiKey: 'local' },
)

export const db = getFirestore(app)

// In dev we always talk to the emulator, so nobody can pollute the live shared
// library while building a feature. Mirrors the calorie-track setup.
if (import.meta.env.DEV) {
  // Port 8088, not the conventional 8080 — see the note in firebase.json.
  connectFirestoreEmulator(db, '127.0.0.1', 8088)
}

export const COLLECTIONS = {
  drills: 'drills',
  sessions: 'sessions',
}
