import { useCallback, useEffect, useState } from 'react'
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import { db, COLLECTIONS, isConfigured } from '../firebase.js'

// The whole library is fetched once per page load and filtered in the browser
// (see src/lib/filters.js for why). One-shot getDocs rather than onSnapshot: the
// drill library changes a few times a week, not a few times a second, and a live
// listener would burn free-tier reads keeping a connection open all session.

let cache = null // survives navigation between Library and Planner within one visit

export function useDrills() {
  const [drills, setDrills] = useState(cache ?? [])
  const [loading, setLoading] = useState(!cache)
  const [error, setError] = useState(null)

  const load = useCallback(async ({ force = false } = {}) => {
    if (cache && !force) {
      setDrills(cache)
      setLoading(false)
      return cache
    }
    if (!isConfigured) {
      setError('not-configured')
      setLoading(false)
      return []
    }

    setLoading(true)
    setError(null)
    try {
      const snapshot = await getDocs(
        query(collection(db, COLLECTIONS.drills), orderBy('createdAt', 'desc')),
      )
      const rows = snapshot.docs.map(document => ({ id: document.id, ...document.data() }))
      cache = rows
      setDrills(rows)
      return rows
    } catch (caught) {
      console.error('[Clean Sheet] Could not load the drill library:', caught)
      setError(caught.code === 'permission-denied' ? 'permission-denied' : 'offline')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /** Add a community drill. Returns the new id. */
  const addDrill = useCallback(async values => {
    const created = await addDoc(collection(db, COLLECTIONS.drills), {
      ...values,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    cache = null // next read picks up the new drill
    await load({ force: true })
    return created.id
  }, [load])

  /** Edit an existing drill. v1 allows this for any drill with no owner yet. */
  const updateDrill = useCallback(async (id, values) => {
    await updateDoc(doc(db, COLLECTIONS.drills, id), { ...values, updatedAt: serverTimestamp() })
    cache = null
    await load({ force: true })
  }, [load])

  return { drills, loading, error, reload: () => load({ force: true }), addDrill, updateDrill }
}

/** Fetch one drill directly — used when a deep link lands before the library loads. */
export async function fetchDrill(id) {
  const snapshot = await getDoc(doc(db, COLLECTIONS.drills, id))
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null
}

/** Clear the in-memory cache. Exported for tests and the dev reload button. */
export function clearDrillCache() {
  cache = null
}
