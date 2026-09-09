import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { labelFor, LIMITS, sentenceList } from '../../lib/taxonomy.js'
import { formatClock, formatDuration, formatOffset } from '../../lib/timings.js'
import { isHttpUrl } from '../../lib/schema.js'
import { Markdown, PhaseMark } from '../ui/Bits.jsx'
import PitchDiagram from '../ui/PitchDiagram.jsx'
import DrillVideo from '../ui/DrillVideo.jsx'

/**
 * One block of a shared plan, opened out in full.
 *
 * The plan itself is a glance layer — you read it standing on grass. This is the
 * other reading: the coach who has been sent someone else's session and is
 * working out how to run it. It shows everything the block carries, including
 * the two things the plan never has room for (the kit for this drill, and the
 * further reading), with the diagram at a size you can actually study.
 *
 * Everything comes from `drillSnapshot`, never from the live library entry. The
 * snapshot is what the coach saved and printed; showing anything else would mean
 * a shared plan quietly changed after it was sent. The library link at the foot
 * is the escape hatch for "I want to use this myself", and is labelled as such.
 *
 * Same native <dialog> as DrillDetail, for the same reasons: focus trapping,
 * Escape, the Android back button and the backdrop come from the browser.
 */
export default function BlockDetail({ block, index, total, startTime, onClose, onStep }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return undefined
    if (block && !dialog.open) dialog.showModal()
    if (!block && dialog.open) dialog.close()

    const handleClose = () => onClose()
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [block, onClose])

  // Stepping between blocks keeps the scroll position of the block you just
  // left, which puts you halfway down the next drill. Reset it on every change.
  const scrollRef = useRef(null)
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0)
  }, [block?.id])

  const snapshot = block?.drillSnapshot ?? {}
  const name = snapshot.name || labelFor('phase', block?.phase)
  const kit = (snapshot.equipment ?? []).filter(item => item !== 'none')
  // Session documents are written by an anonymous client and firestore.rules only
  // checks that `blocks` is a list — nothing validates what is inside a snapshot.
  // So these URLs are untrusted input on the way to an href: filter to http(s)
  // here rather than trusting that they went through validateDrill.
  const references = (Array.isArray(snapshot.references) ? snapshot.references : [])
    .filter(reference => isHttpUrl(reference?.url))
    .slice(0, LIMITS.references)

  return (
    <dialog
      ref={dialogRef}
      // no-print because a modal sits in the top layer, and printing with one
      // open would otherwise put a single drill on the page instead of the plan.
      className="no-print m-auto w-[min(46rem,94vw)] rounded-md border border-line bg-chalk p-0 text-ink backdrop:bg-ink/40"
      onClick={event => {
        // Clicking the backdrop (the dialog element itself, not its contents)
        // closes it — expected behaviour that <dialog> does not give you free.
        if (event.target === dialogRef.current) dialogRef.current.close()
      }}
    >
      {block && (
        <div ref={scrollRef} className="max-h-[85dvh] overflow-y-auto">
          <header className="sticky top-0 z-10 border-b border-line bg-chalk/95 px-5 py-4 backdrop-blur sm:px-6">
            <div className="mb-1.5 flex items-center gap-2">
              <PhaseMark phase={block.phase} />
              <span className="label">{labelFor('phase', block.phase)}</span>
              <span className="label tnum">
                {index + 1} of {total}
              </span>
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                aria-label="Close"
                className="btn-quiet ml-auto text-lg leading-none"
              >
                ×
              </button>
            </div>
            <h2 className="font-display text-2xl font-bold leading-tight">{name}</h2>
            {snapshot.summary && <p className="mt-1 text-sm text-mist">{snapshot.summary}</p>}
          </header>

          <div className="space-y-6 px-5 py-5 sm:px-6">
            <dl className="grid grid-cols-3 gap-2 sm:gap-3">
              <Stat label="Duration" value={formatDuration(block.durationMins)} />
              <Stat
                label={startTime ? 'Starts' : 'From'}
                value={formatClock(startTime, block.startMin) ?? formatOffset(block.startMin)}
              />
              <Stat
                label={startTime ? 'Finishes' : 'To'}
                value={formatClock(startTime, block.endMin) ?? formatOffset(block.endMin)}
              />
            </dl>

            {/* Tonight's note is the one thing here that is not the drill — it is
                what this coach decided for this session, so it leads. */}
            {block.notes && (
              <section className="rounded-md border-l-4 border-hivis bg-paper px-4 py-3">
                <h3 className="h-section mb-1">Note for tonight</h3>
                <p className="text-sm font-semibold text-ink">{block.notes}</p>
              </section>
            )}

            {snapshot.coachingPoints?.length > 0 && (
              <Section title="Coaching points">
                <PointList items={snapshot.coachingPoints} marker="→" />
              </Section>
            )}

            {snapshot.diagram && (
              <Section title="How it looks">
                <PitchDiagram diagram={snapshot.diagram} drillName={name} />
              </Section>
            )}

            {/* snapshot.videoId is anonymous input, same as references above —
                DrillVideo runs it through isVideoId() before it reaches a src. */}
            {snapshot.videoId && (
              <Section title="Watch it run">
                <DrillVideo videoId={snapshot.videoId} drillName={name} />
              </Section>
            )}

            {snapshot.setup && (
              <Section title="Setting it up">
                <Markdown source={snapshot.setup} />
              </Section>
            )}

            {snapshot.description && (
              <Section title="What happens">
                <Markdown source={snapshot.description} />
              </Section>
            )}

            {(snapshot.progressions?.length > 0 || snapshot.regressions?.length > 0) && (
              <div className="grid gap-6 sm:grid-cols-2">
                {snapshot.progressions?.length > 0 && (
                  <Section title="Make it harder">
                    <PointList items={snapshot.progressions} marker="↑" />
                  </Section>
                )}
                {snapshot.regressions?.length > 0 && (
                  <Section title="Make it easier">
                    <PointList items={snapshot.regressions} marker="↓" />
                  </Section>
                )}
              </div>
            )}

            {kit.length > 0 && (
              <Section title="What you need">
                <p className="text-sm text-mist">
                  {sentenceList(kit.map(item => labelFor('equipment', item)))}
                </p>
              </Section>
            )}

            {references.length > 0 && (
              <Section title="Further reading">
                {/* We link out rather than reproduce. See docs/content-policy.md. */}
                <ul className="space-y-1.5 text-sm">
                  {references.map(reference => (
                    <li key={reference.url}>
                      <a
                        href={reference.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-pitch-mid underline underline-offset-2"
                      >
                        {reference.label || reference.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {block.drillId && (
              <p className="border-t border-line pt-4 text-xs text-mist">
                This is the copy saved with the plan.{' '}
                <Link
                  to={`/library/${block.drillId}`}
                  className="text-pitch-mid underline underline-offset-2"
                >
                  Open the drill in the library
                </Link>{' '}
                to add it to a session of your own.
              </p>
            )}
          </div>

          {/* Stepping through the plan beats closing and reopening six times —
              reading someone else's session end to end is the whole reason this
              view exists. */}
          <footer className="sticky bottom-0 flex items-center gap-2 border-t border-line bg-chalk/95 px-5 py-3 backdrop-blur sm:px-6">
            <button
              type="button"
              onClick={() => onStep(-1)}
              disabled={index === 0}
              className="btn-ghost"
            >
              <span aria-hidden>←</span> Previous
            </button>
            <button
              type="button"
              onClick={() => onStep(1)}
              disabled={index >= total - 1}
              className="btn-ghost ml-auto"
            >
              Next <span aria-hidden>→</span>
            </button>
          </footer>
        </div>
      )}
    </dialog>
  )
}

function Section({ title, children }) {
  return (
    <section>
      <h3 className="h-section mb-2">{title}</h3>
      {children}
    </section>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded border border-line bg-paper px-3 py-2">
      <dt className="label">{label}</dt>
      <dd className="mt-0.5 tnum text-sm text-pitch">{value}</dd>
    </div>
  )
}

function PointList({ items = [], marker }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2.5 text-sm leading-relaxed text-mist">
          <span aria-hidden className="mt-px shrink-0 tnum text-pitch-mid">
            {marker}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}
