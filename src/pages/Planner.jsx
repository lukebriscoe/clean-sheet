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
import { EmptyState, ErrorNote, Field } from '../components/ui/Bits.jsx'

export default function Planner() {
  const {
    session, setField, addDrill, addFreeform, updateBlock, updateSnapshot,
    removeBlock, moveBlock, reset,
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
  // Which block the coach is on. Local only — it's a pitchside aid, not part of
  // the plan, so it never goes to Firestore.
  const [nowId, setNowId] = useState(null)

  const ordered = useMemo(() => withRunningOrder(session.blocks), [session.blocks])
  const status = durationStatus(session.blocks, session.durationMins)
  const planned = totalMinutes(session.blocks)

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
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">
          {session.title || 'A clean sheet'}
        </h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
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
                {labelFor('ageGroup', session.ageGroup)} · {session.playerCount} players ·{' '}
                {formatDuration(session.durationMins)}
                {session.startTime && ` · KO ${session.startTime}`}
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
                <input
                  type="number" min="1" max="60" className="field"
                  value={session.playerCount}
                  onChange={event => setField('playerCount', Number(event.target.value) || 1)}
                />
              </Field>
              <Field label="Total mins">
                <input
                  type="number" min="5" max="240" step="5" className="field"
                  value={session.durationMins}
                  onChange={event => setField('durationMins', Number(event.target.value) || 5)}
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
            <h2 className="label-sm mb-2">Running order</h2>

            {session.blocks.length === 0 ? (
              <EmptyState title="Nothing planned yet">
                Add a warm-up from the panel to get started, or browse the drill library. Your plan
                saves itself on this device as you go.
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
                      onRemove={removeBlock}
                      onSetNow={setNowId}
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
                  onClick={() => { reset(); setNowId(null); setConfirmingReset(false) }}
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
              {saving ? 'Saving…' : 'Save & get a share link'}
            </button>
          </div>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          {error ? (
            <ErrorNote kind={error} />
          ) : (
            <BlockPicker
              drills={drills}
              loading={loading}
              session={session}
              onAddDrill={addDrill}
              onAddFreeform={addFreeform}
            />
          )}
        </aside>
      </div>
    </div>
  )
}
