import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../state/session-context.jsx'
import { useDrills } from '../hooks/useDrills.js'
import { useSaveSession } from '../hooks/useSavedSession.js'
import { withRunningOrder, durationStatus, formatDuration, totalMinutes } from '../lib/timings.js'
import { AGE_GROUPS, THEMES, LIMITS, labelFor } from '../lib/taxonomy.js'
import BlockRow from '../components/planner/BlockRow.jsx'
import BlockPicker from '../components/planner/BlockPicker.jsx'
import { ShapeStrip, RailFinish } from '../components/planner/TouchlineRail.jsx'
import { EmptyState, ErrorNote, Field, NumberField } from '../components/ui/Bits.jsx'
import Sheet from '../components/ui/Sheet.jsx'

export default function Planner() {
  const {
    session, setField, addDrill, addFreeform, updateBlock, updateSnapshot,
    removeBlock, restoreBlock, moveBlock, reset, setNow,
  } = useSession()
  const { drills, loading, error } = useDrills()
  const { save, saving, error: saveError } = useSaveSession()
  const navigate = useNavigate()

  const [confirmingReset, setConfirmingReset] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  // On a phone the setup fields pushed the running order 570px down the page —
  // two thirds of the viewport before you could see your own plan. They collapse
  // to a one-line summary here and stay open on desktop, where there's room.
  const [setupOpen, setSetupOpen] = useState(false)
  // The last block removed, kept so it can be put back. Remove is a single tap on
  // the running order, and losing a block off a half-built plan with no way back
  // is the kind of thing that stops someone trusting the tool.
  const [undo, setUndo] = useState(null)
  // Below lg the picker cannot live in a right-hand rail, and stacking it under
  // the running order buried it a full screen below the fold — so on a phone it
  // opens from a bar pinned to the bottom of the viewport instead.
  const [pickerOpen, setPickerOpen] = useState(false)

  const handleRemove = id => {
    const index = session.blocks.findIndex(block => block.id === id)
    if (index === -1) return
    // wasNow so undo can put the marker back with the block — see the reducer.
    setUndo({ block: session.blocks[index], index, wasNow: session.nowId === id })
    removeBlock(id)
  }

  const nowId = session.nowId

  const ordered = useMemo(() => withRunningOrder(session.blocks), [session.blocks])
  const status = durationStatus(session.blocks, session.durationMins)
  const planned = totalMinutes(session.blocks)

  // One picker, rendered either into the desktop rail or into the mobile sheet.
  // Adding from the sheet closes it, so the block you just added is the first
  // thing you see rather than something you have to dismiss a panel to find.
  const renderPicker = variant => {
    const wrap = fn => (variant === 'sheet' ? (...args) => { fn(...args); setPickerOpen(false) } : fn)
    return (
      <BlockPicker
        drills={drills}
        loading={loading}
        session={session}
        onAddDrill={wrap(addDrill)}
        onAddFreeform={wrap(addFreeform)}
        variant={variant}
      />
    )
  }

  const handleSave = async () => {
    try {
      const { id, shareId } = await save(session)
      setField('savedId', id)
      navigate(`/session/${shareId}`)
    } catch {
      // saveError renders the message.
    }
  }

  return (
    <div>
      <header className="mb-4">
        <h1 className="font-display text-[2rem] font-black leading-[1.1] tracking-tight sm:text-[2.5rem]">
          {session.title || 'A clean sheet'}
        </h1>
      </header>

      {/* pb-24 keeps the save row clear of the fixed mobile add bar. */}
      <div className="grid gap-6 pb-24 lg:grid-cols-[1fr_20rem] lg:pb-0">
        <div className="min-w-0 space-y-5">
          {/* ---- the session at a glance ---- */}
          <div className="surface p-4 sm:p-5">
            <Field label="Session title">
              <input
                className="field"
                value={session.title}
                maxLength={LIMITS.title}
                onChange={event => setField('title', event.target.value)}
                placeholder="e.g. U10 — Pressing as a unit"
              />
            </Field>

            <div className="mt-3 flex items-center gap-2 lg:hidden">
              <p className="min-w-0 flex-1 truncate text-sm text-mist">
                {labelFor('ageGroup', session.ageGroup)}, {session.playerCount} players,{' '}
                {formatDuration(session.durationMins)}
                {session.startTime && `, kick-off ${session.startTime}`}
              </p>
              <button
                type="button"
                onClick={() => setSetupOpen(open => !open)}
                aria-expanded={setupOpen}
                className="btn-quiet shrink-0 text-sm"
              >
                {setupOpen ? 'Done' : 'Edit'}
              </button>
            </div>

            <div className={`${setupOpen ? '' : 'hidden'} lg:block`}>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Age group">
                <select
                  className="field"
                  value={session.ageGroup}
                  onChange={event => setField('ageGroup', event.target.value)}
                >
                  {AGE_GROUPS.map(age => (
                    <option key={age.key} value={age.key}>{age.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Players">
                <NumberField
                  min={1} max={60} fallback={12}
                  value={session.playerCount}
                  onCommit={n => setField('playerCount', n)}
                />
              </Field>
              <Field label="Total mins">
                <NumberField
                  min={5} max={240} step="5" fallback={90}
                  value={session.durationMins}
                  onCommit={n => setField('durationMins', n)}
                />
              </Field>
              <Field label="Kick-off" hint="Optional">
                <input
                  type="time" className="field"
                  value={session.startTime}
                  onChange={event => setField('startTime', event.target.value)}
                />
              </Field>
            </div>
            </div>

            {/* The shape of the session — proportional, so a fat warm-up looks fat. */}
            <div className="mt-4 border-t border-line pt-4">
              <ShapeStrip
                blocks={session.blocks}
                targetMins={session.durationMins}
                nowId={nowId}
              />
              <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                <span className="tnum font-display font-bold text-pitch">
                  {formatDuration(planned)}
                </span>
                <span className="text-mist">of {formatDuration(status.target)} planned</span>
                {status.status === 'over' && (
                  <span className="font-semibold text-whistle">
                    {formatDuration(status.remaining)} over
                  </span>
                )}
                {status.status === 'under' && (
                  <span className="text-mist">{formatDuration(status.remaining)} left to fill</span>
                )}
                {status.status === 'on-target' && (
                  <span className="font-semibold text-pitch-mid">on target</span>
                )}
              </div>
            </div>

            <div className={`${setupOpen ? '' : 'hidden'} lg:block`}>
            <button
              type="button"
              onClick={() => setShowDetails(open => !open)}
              aria-expanded={showDetails}
              className="btn-quiet mt-2 -ml-3 text-sm"
            >
              {showDetails ? 'Hide' : 'Add'} focus &amp; theme
            </button>
            {showDetails && (
              <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_12rem]">
                <Field label="What are we working on?">
                  <input
                    className="field"
                    value={session.objectives}
                    maxLength={LIMITS.objectives}
                    onChange={event => setField('objectives', event.target.value)}
                    placeholder="e.g. Getting the first touch out of the feet"
                  />
                </Field>
                <Field label="Main theme">
                  <select
                    className="field"
                    value={session.theme}
                    onChange={event => setField('theme', event.target.value)}
                  >
                    <option value="">—</option>
                    {THEMES.map(theme => (
                      <option key={theme.key} value={theme.key}>{theme.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
            )}
            </div>
          </div>

          {/* ---- the running order, on the rail ---- */}
          <section>
            <h2 className="h-section mb-2">Running order</h2>

            {session.blocks.length === 0 ? (
              <EmptyState
                title="Nothing planned yet"
                action={
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="btn-primary lg:hidden"
                  >
                    + Add your first block
                  </button>
                }
              >
                <span className="hidden lg:inline">
                  Add a warm-up from the panel on the right to get started.
                </span>
                <span className="lg:hidden">Add a warm-up to get started.</span> Your plan saves
                itself on this device as you go.
              </EmptyState>
            ) : (
              <div className="surface overflow-hidden">
                <ul className="mown divide-y divide-line">
                  {ordered.map((block, index) => (
                    <BlockRow
                      key={block.id}
                      block={block}
                      startTime={session.startTime}
                      isFirst={index === 0}
                      isLast={index === ordered.length - 1}
                      isNow={nowId === block.id}
                      onUpdate={updateBlock}
                      onUpdateSnapshot={updateSnapshot}
                      onMove={moveBlock}
                      onRemove={handleRemove}
                      onSetNow={setNow}
                    />
                  ))}
                </ul>
                <RailFinish
                  totalMin={planned}
                  startTime={session.startTime}
                  over={status.status === 'over'}
                />
              </div>
            )}

            {undo && (
              <div
                role="status"
                className="mt-3 flex flex-wrap items-center gap-2 rounded-md border-l-4 border-hivis bg-chalk px-4 py-3 text-sm"
              >
                <span className="min-w-0 flex-1 truncate text-mist">
                  Removed{' '}
                  <strong className="font-bold text-pitch">
                    {undo.block.drillSnapshot?.name || 'that block'}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => { restoreBlock(undo.block, undo.index, undo.wasNow); setUndo(null) }}
                  className="btn-ghost shrink-0 text-sm"
                >
                  Undo
                </button>
                <button
                  type="button"
                  onClick={() => setUndo(null)}
                  aria-label="Dismiss"
                  className="btn-icon shrink-0"
                >
                  <span aria-hidden>×</span>
                </button>
              </div>
            )}

            {status.status === 'over' && (
              <p className="mt-3 rounded-md border-l-4 border-whistle bg-chalk px-4 py-3 text-sm">
                This runs <strong className="font-bold">{formatDuration(status.remaining)}</strong>{' '}
                over your {formatDuration(status.target)} target. Trim a block or raise the total.
              </p>
            )}
          </section>

          {saveError && <ErrorNote kind={saveError} />}

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            {confirmingReset ? (
              <>
                <span className="text-sm text-mist">Clear this session and start again?</span>
                <button
                  type="button"
                  onClick={() => { reset(); setConfirmingReset(false) }}
                  className="btn-ghost text-whistle"
                >
                  Yes, clear it
                </button>
                <button type="button" onClick={() => setConfirmingReset(false)} className="btn-quiet">
                  Keep it
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingReset(true)}
                disabled={session.blocks.length === 0}
                className="btn-quiet -ml-3"
              >
                Start a clean sheet
              </button>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || session.blocks.length === 0}
              className="btn-primary ml-auto"
            >
              {saving ? 'Saving…' : 'Save this plan'}
            </button>
          </div>
        </div>

        {/* Desktop only: the picker as a sticky right-hand rail, unchanged. On a
            phone it moves into the sheet below rather than stacking here, where
            it landed roughly a screen and a half beneath the fold. */}
        <aside className="hidden min-w-0 lg:sticky lg:top-24 lg:block lg:self-start">
          {error ? <ErrorNote kind={error} /> : renderPicker('panel')}
        </aside>
      </div>

      {/* ---- mobile: add without leaving the top of the plan ---- */}
      <div
        className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="btn-primary w-full"
        >
          + Add to session
        </button>
      </div>

      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="Add to the session">
        <div className="p-4">{error ? <ErrorNote kind={error} /> : renderPicker('sheet')}</div>
      </Sheet>
    </div>
  )
}
