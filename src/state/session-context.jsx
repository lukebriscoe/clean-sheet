import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react'
import { emptySession, blockFromDrill, freeformBlock } from '../lib/schema.js'
import { phaseOrder } from '../lib/taxonomy.js'

// The session a coach is currently building. Lives in memory, mirrored to
// localStorage on every change.
//
// The autosave is not a nicety: coaches build these on a phone, get interrupted,
// and come back twenty minutes later. Losing a half-planned session to a closed
// tab would be the fastest way to make someone never use this again.

const STORAGE_KEY = 'clean-sheet:draft-session:v1'

const SessionContext = createContext(null)

function loadDraft() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return emptySession()
    const parsed = JSON.parse(stored)
    // Guard against a stored draft from an older schema — better a clean sheet
    // than a broken planner the coach can't get out of.
    if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed.blocks)) return emptySession()
    return { ...emptySession(), ...parsed }
  } catch {
    return emptySession()
  }
}

function reducer(session, action) {
  switch (action.type) {
    case 'set-field':
      return { ...session, [action.field]: action.value }

    case 'add-drill': {
      const block = blockFromDrill(action.drill)
      // Slot the block in next to others of the same phase, so a warm-up added
      // last still lands at the top rather than after the match.
      return { ...session, blocks: insertByPhase(session.blocks, block) }
    }

    case 'add-freeform':
      return { ...session, blocks: [...session.blocks, freeformBlock(action.phase)] }

    case 'update-block':
      return {
        ...session,
        blocks: session.blocks.map(block =>
          block.id === action.id ? { ...block, ...action.changes } : block,
        ),
      }

    case 'update-snapshot':
      return {
        ...session,
        blocks: session.blocks.map(block =>
          block.id === action.id
            ? { ...block, drillSnapshot: { ...block.drillSnapshot, ...action.changes } }
            : block,
        ),
      }

    // Which block the coach is on right now. Lives in the session rather than in
    // component state so it survives the phone locking mid-training — which is
    // guaranteed to happen, since that is exactly when the marker is being used.
    // It is stripped before the session is saved; see useSavedSession.js.
    case 'set-now':
      return { ...session, nowId: action.id }

    case 'remove-block':
      return {
        ...session,
        nowId: session.nowId === action.id ? null : session.nowId,
        blocks: session.blocks.filter(block => block.id !== action.id),
      }

    // Put a removed block back exactly where it was. Removing is one tap on the
    // running order, and a session someone has spent ten minutes building should
    // not be one mis-tap away from losing a block with no way back.
    case 'restore-block': {
      const blocks = [...session.blocks]
      const at = Math.min(Math.max(0, action.index ?? blocks.length), blocks.length)
      blocks.splice(at, 0, action.block)
      // Undo has to be a true inverse, including the "now" marker: removing the
      // block you are stood in front of and undoing it should leave you stood in
      // front of it, not silently unmarked.
      return {
        ...session,
        blocks,
        nowId: action.wasNow ? action.block.id : session.nowId,
      }
    }

    case 'move-block': {
      const index = session.blocks.findIndex(block => block.id === action.id)
      const target = index + action.delta
      if (index === -1 || target < 0 || target >= session.blocks.length) return session
      const blocks = [...session.blocks]
      ;[blocks[index], blocks[target]] = [blocks[target], blocks[index]]
      return { ...session, blocks }
    }

    case 'load':
      return { ...emptySession(), ...action.session }

    case 'reset':
      return emptySession()

    default:
      return session
  }
}

/** Keep blocks grouped by the usual shape of a session without forcing the order. */
function insertByPhase(blocks, block) {
  const order = phaseOrder(block.phase)
  const insertAt = blocks.findIndex(existing => phaseOrder(existing.phase) > order)
  if (insertAt === -1) return [...blocks, block]
  return [...blocks.slice(0, insertAt), block, ...blocks.slice(insertAt)]
}

export function SessionProvider({ children }) {
  const [session, dispatch] = useReducer(reducer, null, loadDraft)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    } catch {
      // Private browsing or a full quota. The session still works in memory —
      // there is nothing useful to tell the coach here, so fail quietly.
    }
  }, [session])

  const actions = useMemo(
    () => ({
      setField: (field, value) => dispatch({ type: 'set-field', field, value }),
      addDrill: drill => dispatch({ type: 'add-drill', drill }),
      addFreeform: phase => dispatch({ type: 'add-freeform', phase }),
      updateBlock: (id, changes) => dispatch({ type: 'update-block', id, changes }),
      updateSnapshot: (id, changes) => dispatch({ type: 'update-snapshot', id, changes }),
      removeBlock: id => dispatch({ type: 'remove-block', id }),
      setNow: id => dispatch({ type: 'set-now', id }),
      restoreBlock: (block, index, wasNow = false) =>
        dispatch({ type: 'restore-block', block, index, wasNow }),
      moveBlock: (id, delta) => dispatch({ type: 'move-block', id, delta }),
      load: loaded => dispatch({ type: 'load', session: loaded }),
      reset: () => dispatch({ type: 'reset' }),
    }),
    [],
  )

  const value = useMemo(() => ({ session, ...actions }), [session, actions])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) throw new Error('useSession must be used inside a <SessionProvider>')
  return context
}

/** Is a given drill already in the session? Drives the "Added" state on cards. */
export function useIsInSession(drillId) {
  const { session } = useSession()
  return useCallback(() => session.blocks.some(block => block.drillId === drillId), [
    session.blocks,
    drillId,
  ])()
}

// Exported for tests.
export { reducer as sessionReducer, insertByPhase, STORAGE_KEY }
