import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useSharedSession } from '../hooks/useSavedSession.js'
import { useSession } from '../state/session-context.jsx'
import { withRunningOrder, formatOffset, formatClock, formatDuration, totalMinutes } from '../lib/timings.js'
import { labelFor } from '../lib/taxonomy.js'
import { Markdown, Spinner, EmptyState } from '../components/ui/Bits.jsx'
import PitchDiagram from '../components/ui/PitchDiagram.jsx'
import TouchlineRail, { RailFinish } from '../components/planner/TouchlineRail.jsx'
import BlockDetail from '../components/planner/BlockDetail.jsx'

/**
 * The read-only session — the thing a coach actually takes to training.
 *
 * Three jobs, one component: readable on a phone in the rain, printable onto A4,
 * and shareable by link with the other coaches. The print rules live in
 * styles/print.css; everything tagged .no-print is screen-only chrome.
 */
/**
 * Which block the coach is on, remembered per shared session.
 *
 * Kept in its own localStorage key rather than on the draft session: whoever
 * opens a share link usually has a half-built plan of their own, and following
 * someone else's session must not reach into it. It persists because a phone
 * locks itself every couple of minutes on a touchline and losing your place is
 * the exact moment the marker was supposed to help.
 */
const NOW_KEY = 'clean-sheet:now:v1'

function useNowMarker(shareId) {
  const [nowId, setNowId] = useState(null)

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(NOW_KEY) ?? 'null')
      setNowId(stored?.shareId === shareId ? stored.blockId : null)
    } catch {
      setNowId(null)
    }
  }, [shareId])

  const toggle = blockId => {
    const next = nowId === blockId ? null : blockId
    setNowId(next)
    try {
      localStorage.setItem(NOW_KEY, JSON.stringify({ shareId, blockId: next }))
    } catch {
      // Private browsing. The marker still works for this view.
    }
  }

  return [nowId, toggle]
}

export default function SessionView() {
  const { shareId } = useParams()
  const { session, state } = useSharedSession(shareId)
  const { session: draft } = useSession()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [allDetail, setAllDetail] = useState(false)
  const [nowId, toggleNow] = useNowMarker(shareId)
  // Which block is open in the detail dialog. Held as an index into the running
  // order rather than as the block itself, so Previous/Next can step through the
  // plan without closing and reopening.
  const [openIndex, setOpenIndex] = useState(null)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      // Clipboard is blocked outside a secure context or without permission.
      // The URL bar still has the link, so this is not worth an error dialog.
      setCopied(false)
    }
  }

  if (state === 'loading') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Spinner label="Loading the session" />
      </div>
    )
  }

  if (state !== 'ready' || !session) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          title={state === 'missing' ? "That session doesn't exist" : "Couldn't load that session"}
          action={
            <button type="button" onClick={() => navigate('/library')} className="btn-primary">
              Go to the drill library
            </button>
          }
        >
          {state === 'missing'
            ? 'The link may have a typo, or the session was never saved. Check the link you were sent.'
            : 'Something went wrong reaching the database. Check your connection and try again.'}
        </EmptyState>
      </div>
    )
  }

  const ordered = withRunningOrder(session.blocks ?? [])
  const planned = totalMinutes(session.blocks)
  const finishClock = formatClock(session.startTime, planned)
  // Is this the coach's own session, still open in the planner as a draft?
  const isMine = Boolean(draft.savedId && draft.savedId === session.id)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {/* ---- screen-only toolbar ---- */}
      <div className="no-print mb-6 flex flex-wrap items-center gap-2">
        <Link to="/library" className="btn-quiet">
          ← Drill library
        </Link>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setAllDetail(open => !open)}
            aria-pressed={allDetail}
            className="btn-quiet whitespace-nowrap text-sm"
          >
            {allDetail ? 'Hide detail' : 'All detail'}
          </button>
          <button type="button" onClick={copyLink} className="btn-ghost whitespace-nowrap text-sm">
            {copied ? '✓ Copied' : 'Copy link'}
          </button>
          <button type="button" onClick={() => window.print()} className="btn-primary whitespace-nowrap text-sm">
            Print<span className="hidden sm:inline"> / save as PDF</span>
          </button>
        </div>
      </div>

      {copied && (
        <p role="status" className="no-print mb-4 text-sm text-mist">
          Anyone with this link can open the session.
        </p>
      )}

      {/* ---- header ---- */}
      <header className="mb-6 border-b border-line pb-5">
        <p className="label-sm mb-1.5">
          {labelFor('ageGroup', session.ageGroup)} session
          {session.theme && ` · ${labelFor('theme', session.theme)}`}
        </p>
        <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">
          {session.title}
        </h1>

        {session.objectives && (
          <p className="mt-2 text-mist">
            <span className="label-sm mr-2">Focus</span>
            {session.objectives}
          </p>
        )}

        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 tnum text-sm text-mist">
          <Meta label="Duration" value={formatDuration(planned)} />
          <Meta label="Players" value={String(session.playerCount)} />
          {session.startTime && (
            <Meta
              label="Time"
              value={finishClock ? `${session.startTime}–${finishClock}` : session.startTime}
            />
          )}
          {session.dateFor && <Meta label="Date" value={session.dateFor} />}
        </dl>
      </header>

      {/* ---- kit list: the thing you need BEFORE you leave the house ---- */}
      <KitList blocks={session.blocks} />

      {/* ---- running order ---- */}
      <ol className="mt-5">
        {ordered.map((block, index) => (
          <PlanBlock
            key={block.id}
            block={block}
            isFirst={index === 0}
            startTime={session.startTime}
            forceOpen={allDetail}
            isNow={nowId === block.id}
            onToggleNow={() => toggleNow(block.id)}
            onOpen={() => setOpenIndex(index)}
          />
        ))}
      </ol>
      <RailFinish totalMin={planned} startTime={session.startTime} />

      <BlockDetail
        block={openIndex === null ? null : ordered[openIndex]}
        index={openIndex ?? 0}
        total={ordered.length}
        startTime={session.startTime}
        onClose={() => setOpenIndex(null)}
        onStep={step =>
          setOpenIndex(current =>
            Math.min(ordered.length - 1, Math.max(0, (current ?? 0) + step)),
          )
        }
      />

      <footer className="mt-8 border-t border-line pt-5 text-sm text-mist">
        <p>
          Planned by {session.createdBy?.displayName ?? 'a coach'} with Clean Sheet.
          {' '}
          {/* If this is the coach's own session, the useful link is back into it.
              Otherwise "build your own" has to say that it starts from a blank
              sheet — a recipient who taps it lands in whatever half-built draft
              they already had, which is baffling if the label promised a copy. */}
          <span className="no-print">
            {isMine ? (
              <Link to="/plan" className="text-pitch-mid underline underline-offset-2">
                ← Edit this plan
              </Link>
            ) : (
              <Link to="/plan" className="text-pitch-mid underline underline-offset-2">
                Start your own clean sheet →
              </Link>
            )}
          </span>
        </p>
      </footer>
    </div>
  )
}

/**
 * One block of the running order.
 *
 * The plan is meant to be glanceable — you read it standing on grass holding a
 * ball. So the block shows only what you need mid-session: when, how long, which
 * drill, and the points you are actually going to coach. Set-up, the diagram,
 * the full description and the harder/easier variations are the things you read
 * once before training, and they made a six-block session several screens long,
 * so they open in a dialog (BlockDetail) instead — a coach reading a plan they
 * were sent is doing a different job from a coach following one, and a dialog
 * lets them read a drill properly without the running order shifting underneath.
 * "All detail" in the toolbar is the other reading: everything inline, in order.
 *
 * Print is the exception and always shows everything: paper has no tap, and the
 * printed plan is the one you take out when you have forgotten how it starts.
 * Hence `hidden print:block` rather than unmounting the panel.
 */
function PlanBlock({ block, isFirst, startTime, forceOpen, isNow, onToggleNow, onOpen }) {
  const snapshot = block.drillSnapshot ?? {}
  const name = snapshot.name || labelFor('phase', block.phase)

  // What the dialog would have to say beyond the glance layer. Kit and further
  // reading count: neither fits on the plan, and both are reasons to open it.
  const hasDetail = Boolean(
    snapshot.diagram ||
      snapshot.setup ||
      snapshot.description ||
      snapshot.progressions?.length ||
      snapshot.regressions?.length ||
      snapshot.equipment?.length ||
      snapshot.references?.length,
  )

  return (
    <li className="print-block flex gap-2 py-4">
      <TouchlineRail
        startMin={block.startMin}
        startTime={startTime}
        isFirst={isFirst}
        isLast={false}
        isNow={isNow}
        blockName={snapshot.name}
        onToggleNow={onToggleNow}
      />

      <div className="min-w-0 flex-1 space-y-3 pt-0.5">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="label-sm">{labelFor('phase', block.phase)}</span>
            {isNow && (
              <span className="no-print rounded-sm bg-hivis px-1.5 py-0.5 font-display text-[0.65rem] font-bold uppercase tracking-[0.08em] text-ink">
                Now
              </span>
            )}
            <span className="tnum ml-auto text-sm font-semibold text-mist">
              {block.durationMins} min
            </span>
          </div>
          <h2 className="font-display text-xl font-bold leading-snug text-pitch">
            {hasDetail ? (
              <button
                type="button"
                onClick={onOpen}
                aria-label={`${name} — set-up, diagram and detail`}
                // print-keep, because `button { display: none }` in print.css is
                // a blanket rule: without the opt-out the printed plan loses
                // every drill name and becomes a list of phases.
                className="print-keep group flex w-full items-start gap-1.5 text-left"
              >
                <span className="underline-offset-4 group-hover:underline">{name}</span>
                <span aria-hidden className="no-print mt-1 shrink-0 text-base text-mist">
                  →
                </span>
              </button>
            ) : (
              name
            )}
          </h2>
        </div>

        {snapshot.summary && <p className="max-w-prose text-mist">{snapshot.summary}</p>}

        {/* Coaching points stay on the glance layer — they are the thing you say
            out loud, and the reason you are looking at the plan at all. */}
        {snapshot.coachingPoints?.length > 0 && (
          <section>
            <h3 className="label-sm mb-1.5">Coaching points</h3>
            <ul className="space-y-1.5">
              {snapshot.coachingPoints.map((point, index) => (
                <li key={index} className="flex gap-2.5 text-sm leading-relaxed text-mist">
                  <span aria-hidden className="tnum text-pitch-mid">
                    &rarr;
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Tonight's note is specific to this session and can change what you do,
            so it never hides. */}
        {block.notes && (
          <section className="rounded-md border-l-4 border-hivis bg-paper px-3 py-2.5">
            <h3 className="label-sm mb-1">Note for tonight</h3>
            <p className="text-sm font-semibold text-ink">{block.notes}</p>
          </section>
        )}

        {hasDetail && (
          <>
            {/* The heading is the real target, but it does not look like one on
                a phone. This says out loud what is behind it — and names the
                diagram when there is one, which is the thing worth opening for. */}
            {!forceOpen && (
              <button
                type="button"
                onClick={onOpen}
                className="no-print btn-quiet w-full justify-between text-sm sm:w-auto sm:justify-start sm:gap-2"
              >
                {snapshot.diagram ? 'Diagram, set-up & detail' : 'Set-up & detail'}
                <span aria-hidden>→</span>
              </button>
            )}

            <div className={`space-y-3 ${forceOpen ? '' : 'hidden print:block'}`}>
              {snapshot.diagram && (
                <PitchDiagram diagram={snapshot.diagram} drillName={snapshot.name} />
              )}

              {snapshot.setup && (
                <section>
                  <h3 className="label-sm mb-1.5">Set-up</h3>
                  <Markdown source={snapshot.setup} />
                </section>
              )}

              {snapshot.description && (
                <section>
                  <h3 className="label-sm mb-1.5">What happens</h3>
                  <Markdown source={snapshot.description} />
                </section>
              )}

              {(snapshot.progressions?.length > 0 || snapshot.regressions?.length > 0) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {snapshot.progressions?.length > 0 && (
                    <MiniList title="Make it harder" items={snapshot.progressions} marker="&uarr;" />
                  )}
                  {snapshot.regressions?.length > 0 && (
                    <MiniList title="Make it easier" items={snapshot.regressions} marker="&darr;" />
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </li>
  )
}

function Meta({ label, value }) {
  return (
    <div>
      <dt className="label-sm">{label}</dt>
      <dd className="mt-0.5 text-pitch">{value}</dd>
    </div>
  )
}

function MiniList({ title, items, marker }) {
  return (
    <section>
      <h3 className="label-sm mb-1.5">{title}</h3>
      <ul className="space-y-1">
        {items.map((item, index) => (
          <li key={index} className="flex gap-2 text-sm text-mist">
            <span aria-hidden className="tnum text-mist">
              {marker}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Everything you need to bring, collected from every block.
 *
 * Deliberately at the top and on the printed page: the single most annoying
 * failure in grassroots coaching is arriving without the bibs.
 */
function KitList({ blocks = [] }) {
  const kit = [
    ...new Set(
      blocks.flatMap(block => block.drillSnapshot?.equipment ?? []).filter(item => item !== 'none'),
    ),
  ]
  if (!kit.length) return null

  return (
    <div className="surface print-block px-4 py-3">
      <h2 className="label-sm mb-1.5">What to bring</h2>
      <p className="text-pitch">{kit.map(item => labelFor('equipment', item)).join(' · ')}</p>
    </div>
  )
}
