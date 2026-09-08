import { useCallback, useEffect, useState } from 'react'
import {
  collection,
  addDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db, COLLECTIONS } from '../firebase.js'
import { sanitiseSessionForSave } from '../lib/schema.js'

/**
 * Save a session and get back its share link.
 *
 * Sessions are looked up by `shareId`, not by document id. That keeps the URL
 * short and readable, and means we could regenerate a share link later (to revoke
 * one) without touching the document itself.
 */
export function useSaveSession() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const save = useCallback(async session => {
    setSaving(true)
    setError(null)
    try {
      // sanitiseSessionForSave also drops the device-local fields (savedId,
      // nowId) that firestore.rules would reject.
      const payload = sanitiseSessionForSave(session)
      // A session that has already been saved keeps its document — otherwise every
      // save would litter the collection with orphans nobody can delete (rules
      // forbid deletes entirely).
      if (session.savedId) {
        await updateDoc(doc(db, COLLECTIONS.sessions, session.savedId), {
          ...payload,
          updatedAt: serverTimestamp(),
        })
        return { id: session.savedId, shareId: payload.shareId }
      }

      const created = await addDoc(collection(db, COLLECTIONS.sessions), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      return { id: created.id, shareId: payload.shareId }
    } catch (caught) {
      console.error('[Clean Sheet] Could not save the session:', caught)
      setError(caught.code === 'permission-denied' ? 'rejected' : 'offline')
      throw caught
    } finally {
      setSaving(false)
    }
  }, [])

  return { save, saving, error }
}


/** Load a session by its share id — powers the read-only /session/:shareId view. */
export function useSharedSession(shareIdParam) {
  const [session, setSession] = useState(null)
  const [state, setState] = useState('loading') // loading | ready | missing | error

  useEffect(() => {
    let cancelled = false
    if (!shareIdParam) {
      setState('missing')
      return undefined
    }

    ;(async () => {
      try {
        const snapshot = await getDocs(
          query(
            collection(db, COLLECTIONS.sessions),
            where('shareId', '==', shareIdParam),
            limit(1),
          ),
        )
        if (cancelled) return
        if (snapshot.empty) {
          setState('missing')
          return
        }
        const document = snapshot.docs[0]
        setSession({ id: document.id, ...document.data() })
        setState('ready')
      } catch (caught) {
        if (cancelled) return
        console.error('[Clean Sheet] Could not load that session:', caught)
        setState('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [shareIdParam])

  return { session, state }
}
