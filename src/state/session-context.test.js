import { describe, it, expect } from 'vitest'
import { sessionReducer, insertByPhase } from './session-context.jsx'
import { emptySession, sanitiseSessionForSave } from '../lib/schema.js'

const drill = (overrides = {}) => ({
  id: 'drl_1',
  name: 'Rondo 4v1',
  summary: 'Keep the ball',
  setup: 'A 10x10 square',
  description: 'Four out, one in.',
  coachingPoints: ['Open your body'],
  progressions: ['Two touch'],
  regressions: ['Bigger square'],
  equipment: ['balls', 'bibs'],
  sessionPhase: 'technical',
  durationMins: 15,
  ...overrides,
})

const withBlocks = blocks => ({ ...emptySession(), blocks })

describe('adding drills', () => {
  it('creates a block carrying a frozen snapshot of the drill', () => {
    const next = sessionReducer(emptySession(), { type: 'add-drill', drill: drill() })
    expect(next.blocks).toHaveLength(1)
    expect(next.blocks[0]).toMatchObject({
      drillId: 'drl_1',
      phase: 'technical',
      durationMins: 15,
      notes: '',
    })
    expect(next.blocks[0].drillSnapshot).toMatchObject({
      name: 'Rondo 4v1',
      coachingPoints: ['Open your body'],
      equipment: ['balls', 'bibs'],
    })
  })

  it('gives every block a distinct id, even for the same drill twice', () => {
    const once = sessionReducer(emptySession(), { type: 'add-drill', drill: drill() })
    const twice = sessionReducer(once, { type: 'add-drill', drill: drill() })
    expect(twice.blocks[0].id).not.toBe(twice.blocks[1].id)
  })

  it('slots a warm-up above an existing match rather than appending it', () => {
    const withMatch = sessionReducer(emptySession(), {
      type: 'add-drill',
      drill: drill({ id: 'drl_match', sessionPhase: 'scrimmage' }),
    })
    const withWarmup = sessionReducer(withMatch, {
      type: 'add-drill',
      drill: drill({ id: 'drl_warm', sessionPhase: 'warmup' }),
    })
    expect(withWarmup.blocks.map(block => block.phase)).toEqual(['warmup', 'scrimmage'])
  })
})

describe('insertByPhase', () => {
  it('keeps the canonical session order as blocks arrive out of order', () => {
    const phases = ['scrimmage', 'warmup', 'ssg', 'cooldown', 'technical']
    const blocks = phases.reduce(
      (acc, phase) => insertByPhase(acc, { id: phase, phase }),
      [],
    )
    expect(blocks.map(block => block.phase)).toEqual([
      'warmup',
      'technical',
      'ssg',
      'scrimmage',
      'cooldown',
    ])
  })

  it('places a new block after existing blocks of the same phase', () => {
    const blocks = insertByPhase(
      [{ id: 'a', phase: 'technical' }, { id: 'b', phase: 'ssg' }],
      { id: 'c', phase: 'technical' },
    )
    expect(blocks.map(block => block.id)).toEqual(['a', 'c', 'b'])
  })
})

describe('editing blocks', () => {
  const base = withBlocks([
    { id: 'a', phase: 'warmup', durationMins: 10, notes: '', drillSnapshot: { name: 'One' } },
    { id: 'b', phase: 'ssg', durationMins: 20, notes: '', drillSnapshot: { name: 'Two' } },
  ])

  it('updates only the targeted block', () => {
    const next = sessionReducer(base, {
      type: 'update-block',
      id: 'b',
      changes: { durationMins: 25 },
    })
    expect(next.blocks[1].durationMins).toBe(25)
    expect(next.blocks[0].durationMins).toBe(10)
  })

  it('merges into the snapshot without dropping its other fields', () => {
    const next = sessionReducer(base, {
      type: 'update-snapshot',
      id: 'a',
      changes: { description: 'Edited' },
    })
    expect(next.blocks[0].drillSnapshot).toEqual({ name: 'One', description: 'Edited' })
  })

  it('removes a block by id', () => {
    const next = sessionReducer(base, { type: 'remove-block', id: 'a' })
    expect(next.blocks.map(block => block.id)).toEqual(['b'])
  })
})

// The "now" marker lives on the session so it survives the phone locking
// mid-training, but it is a per-device aid and must never reach Firestore —
// firestore.rules uses hasOnly() and would reject the whole write.
describe('the now marker', () => {
  const base = withBlocks([
    { id: 'a', phase: 'warmup', durationMins: 10, drillSnapshot: { name: 'One' } },
    { id: 'b', phase: 'technical', durationMins: 20, drillSnapshot: { name: 'Two' } },
  ])

  it('starts unset', () => {
    expect(emptySession().nowId).toBeNull()
  })

  it('marks and clears a block', () => {
    const marked = sessionReducer(base, { type: 'set-now', id: 'b' })
    expect(marked.nowId).toBe('b')
    expect(sessionReducer(marked, { type: 'set-now', id: null }).nowId).toBeNull()
  })

  it('clears itself when the marked block is removed', () => {
    const marked = sessionReducer(base, { type: 'set-now', id: 'b' })
    expect(sessionReducer(marked, { type: 'remove-block', id: 'b' }).nowId).toBeNull()
  })

  it('survives removal of a different block', () => {
    const marked = sessionReducer(base, { type: 'set-now', id: 'b' })
    expect(sessionReducer(marked, { type: 'remove-block', id: 'a' }).nowId).toBe('b')
  })

  it('comes back with the block when a removal is undone', () => {
    const marked = sessionReducer(base, { type: 'set-now', id: 'b' })
    const removed = sessionReducer(marked, { type: 'remove-block', id: 'b' })
    const undone = sessionReducer(removed, {
      type: 'restore-block',
      block: marked.blocks[1],
      index: 1,
      wasNow: true,
    })
    expect(undone.blocks.map(block => block.id)).toEqual(['a', 'b'])
    expect(undone.nowId).toBe('b')
  })

  it('is not moved by undoing an unmarked block', () => {
    const marked = sessionReducer(base, { type: 'set-now', id: 'b' })
    const removed = sessionReducer(marked, { type: 'remove-block', id: 'a' })
    const undone = sessionReducer(removed, {
      type: 'restore-block',
      block: marked.blocks[0],
      index: 0,
      wasNow: false,
    })
    expect(undone.nowId).toBe('b')
  })

  it('is cleared by a reset', () => {
    const marked = sessionReducer(base, { type: 'set-now', id: 'b' })
    expect(sessionReducer(marked, { type: 'reset' }).nowId).toBeNull()
  })

  it('never reaches the saved document', () => {
    const marked = sessionReducer(base, { type: 'set-now', id: 'b' })
    const payload = sanitiseSessionForSave({ ...marked, savedId: 'doc_1' })
    expect(payload).not.toHaveProperty('nowId')
    expect(payload).not.toHaveProperty('savedId')
    // The share link still has to survive the strip — it's how the session is
    // looked up again.
    expect(payload.shareId).toBe(marked.shareId)
  })
})

describe('restoring a removed block', () => {
  const base = withBlocks([
    { id: 'a', phase: 'warmup' },
    { id: 'b', phase: 'technical' },
    { id: 'c', phase: 'ssg' },
  ])

  it('puts a block back at the index it came from', () => {
    const removed = base.blocks[1]
    const after = sessionReducer(base, { type: 'remove-block', id: 'b' })
    expect(after.blocks.map(x => x.id)).toEqual(['a', 'c'])

    const restored = sessionReducer(after, { type: 'restore-block', block: removed, index: 1 })
    expect(restored.blocks.map(x => x.id)).toEqual(['a', 'b', 'c'])
  })

  it('restores the first and last positions correctly', () => {
    const first = sessionReducer(
      sessionReducer(base, { type: 'remove-block', id: 'a' }),
      { type: 'restore-block', block: base.blocks[0], index: 0 },
    )
    expect(first.blocks.map(x => x.id)).toEqual(['a', 'b', 'c'])

    const last = sessionReducer(
      sessionReducer(base, { type: 'remove-block', id: 'c' }),
      { type: 'restore-block', block: base.blocks[2], index: 2 },
    )
    expect(last.blocks.map(x => x.id)).toEqual(['a', 'b', 'c'])
  })

  it('clamps an out-of-range index rather than dropping the block', () => {
    const restored = sessionReducer(base, { type: 'restore-block', block: { id: 'z' }, index: 99 })
    expect(restored.blocks.map(x => x.id)).toEqual(['a', 'b', 'c', 'z'])

    const negative = sessionReducer(base, { type: 'restore-block', block: { id: 'z' }, index: -5 })
    expect(negative.blocks.map(x => x.id)).toEqual(['z', 'a', 'b', 'c'])
  })

  it('appends when no index is given', () => {
    const restored = sessionReducer(base, { type: 'restore-block', block: { id: 'z' } })
    expect(restored.blocks.map(x => x.id)).toEqual(['a', 'b', 'c', 'z'])
  })
})

describe('reordering', () => {
  const base = withBlocks([{ id: 'a' }, { id: 'b' }, { id: 'c' }])

  it('moves a block later and earlier', () => {
    expect(
      sessionReducer(base, { type: 'move-block', id: 'a', delta: 1 }).blocks.map(b => b.id),
    ).toEqual(['b', 'a', 'c'])
    expect(
      sessionReducer(base, { type: 'move-block', id: 'c', delta: -1 }).blocks.map(b => b.id),
    ).toEqual(['a', 'c', 'b'])
  })

  it('refuses to move past either end rather than wrapping around', () => {
    expect(sessionReducer(base, { type: 'move-block', id: 'a', delta: -1 })).toBe(base)
    expect(sessionReducer(base, { type: 'move-block', id: 'c', delta: 1 })).toBe(base)
  })

  it('ignores an unknown block id', () => {
    expect(sessionReducer(base, { type: 'move-block', id: 'nope', delta: 1 })).toBe(base)
  })
})

describe('session lifecycle', () => {
  it('sets a top-level field', () => {
    const next = sessionReducer(emptySession(), {
      type: 'set-field',
      field: 'title',
      value: 'U10 pressing',
    })
    expect(next.title).toBe('U10 pressing')
  })

  it('reset gives a clean sheet with a fresh share id', () => {
    const dirty = withBlocks([{ id: 'a' }])
    const clean = sessionReducer(dirty, { type: 'reset' })
    expect(clean.blocks).toEqual([])
    expect(clean.shareId).not.toBe(dirty.shareId)
  })

  it('load fills in defaults for anything the stored session is missing', () => {
    const loaded = sessionReducer(emptySession(), {
      type: 'load',
      session: { title: 'Loaded', blocks: [] },
    })
    expect(loaded.title).toBe('Loaded')
    expect(loaded.durationMins).toBe(90)
    expect(loaded.schemaVersion).toBe(1)
  })

  it('returns the same state for an unknown action', () => {
    const state = emptySession()
    expect(sessionReducer(state, { type: 'nonsense' })).toBe(state)
  })
})
