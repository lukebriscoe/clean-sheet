import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useSharedSession } from '../hooks/useSavedSession.js'
import { withRunningOrder, formatOffset, formatClock, formatDuration, totalMinutes } from '../lib/timings.js'
import { labelFor } from '../lib/taxonomy.js'
import { Markdown, PhaseMark, Spinner, EmptyState } from '../components/ui/Bits.jsx'
import PitchDiagram from '../components/ui/PitchDiagram.jsx'
import TouchlineRail, { RailFinish } from '../components/planner/TouchlineRail.jsx'

/**
 * The read-only session — the thing a coach actually takes to training.
 *
 * Three jobs, one component: readable on a phone in the rain, printable onto A4,
 * and shareable by link with the other coaches. The print rules live in
 * styles/print.css; everything tagged .no-print is screen-only chrome.
 */
export default function SessionView() {
  const { shareId } = useParams()
  const { session, state } = useSharedSession(shareId)
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {/* ---- screen-only toolbar ---- */}
      <div className="no-print mb-6 flex flex-wrap items-center gap-2">
        <Link to="/library" className="btn-quiet">
          ← Drill library
        </Link>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={copyLink} className="btn-ghost text-sm">
            {copied ? '✓ Link copied' : 'Copy link'}
          </button>
          <button type="button" onClick={() => window.print()} className="btn-primary text-sm">
            Print / save as PDF
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
        {ordered.map((block, index) => {
          const snapshot = block.drillSnapshot ?? {}
          return (
            <li key={block.id} className="print-block flex gap-2 py-4">
              <TouchlineRail
                startMin={block.startMin}
                startTime={session.startTime}
                isFirst={index === 0}
                isLast={false}
              />

              <div className="min-w-0 flex-1 space-y-3 pt-0.5">
                <div>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="label-sm">{labelFor('phase', block.phase)}</span>
                    <span className="tnum ml-auto text-sm font-semibold text-mist">
                      {block.durationMins} min
                    </span>
                  </div>
                  <h2 className="font-display text-xl font-bold leading-snug text-pitch">
                    {snapshot.name || labelFor('phase', block.phase)}
                  </h2>
                </div>
                {snapshot.summary && <p className="max-w-prose text-mist">{snapshot.summary}</p>}

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

                {snapshot.coachingPoints?.length > 0 && (
                  <section>
                    <h3 className="label-sm mb-1.5">Coaching points</h3>
                    <ul className="space-y-1.5">
                      {snapshot.coachingPoints.map((point, index) => (
                        <li key={index} className="flex gap-2.5 text-sm leading-relaxed text-mist">
                          <span aria-hidden className="tnum text-pitch-mid">
                            →
                          </span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {(snapshot.progressions?.length > 0 || snapshot.regressions?.length > 0) && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {snapshot.progressions?.length > 0 && (
                      <MiniList title="Make it harder" items={snapshot.progressions} marker="↑" />
                    )}
                    {snapshot.regressions?.length > 0 && (
                      <MiniList title="Make it easier" items={snapshot.regressions} marker="↓" />
                    )}
                  </div>
                )}

                {block.notes && (
                  <section className="rounded-md border-l-4 border-hivis bg-paper px-3 py-2.5">
                    <h3 className="label-sm mb-1">Note for tonight</h3>
                    <p className="text-sm font-semibold text-ink">{block.notes}</p>
                  </section>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      <RailFinish totalMin={planned} startTime={session.startTime} />

      <footer className="mt-8 border-t border-line pt-5 text-sm text-mist">
        <p>
          Planned by {session.createdBy?.displayName ?? 'a coach'} with Clean Sheet.
          {' '}
          <span className="no-print">
            <Link to="/plan" className="text-pitch-mid underline underline-offset-2">
              Build your own →
            </Link>
          </span>
        </p>
      </footer>
    </div>
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
