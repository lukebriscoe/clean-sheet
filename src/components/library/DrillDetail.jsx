import { useEffect, useRef } from 'react'
import { labelFor, sentenceList } from '../../lib/taxonomy.js'
import { formatDuration } from '../../lib/timings.js'
import { Markdown, PhaseMark } from '../ui/Bits.jsx'
import PitchDiagram from '../ui/PitchDiagram.jsx'
import DrillVideo from '../ui/DrillVideo.jsx'

/**
 * Full drill detail, in a dialog.
 *
 * Uses a native <dialog> so focus trapping, Escape-to-close and the backdrop come
 * from the browser rather than from us — less code and better behaviour with
 * screen readers than a hand-rolled modal.
 */
export default function DrillDetail({ drill, onClose, onAdd, isAdded }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return undefined
    if (drill && !dialog.open) dialog.showModal()
    if (!drill && dialog.open) dialog.close()

    const handleClose = () => onClose()
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [drill, onClose])

  return (
    <dialog
      ref={dialogRef}
      // The backdrop is styled inline because Tailwind cannot target ::backdrop.
      className="m-auto w-[min(46rem,94vw)] rounded-md border border-line bg-chalk p-0 text-ink backdrop:bg-ink/40"
      onClick={event => {
        // Clicking the backdrop (i.e. the dialog element itself, not its contents)
        // closes it — expected behaviour that <dialog> does not give you free.
        if (event.target === dialogRef.current) dialogRef.current.close()
      }}
    >
      {drill && (
        <div className="max-h-[85dvh] overflow-y-auto">
          <header className="sticky top-0 z-10 border-b border-line bg-chalk/95 px-6 py-4 backdrop-blur">
            <div className="mb-1.5 flex items-center gap-2">
              <PhaseMark phase={drill.sessionPhase} />
              <span className="label">{labelFor('phase', drill.sessionPhase)}</span>
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                aria-label="Close"
                className="btn-quiet ml-auto text-lg leading-none"
              >
                ×
              </button>
            </div>
            <h2 className="font-display text-2xl font-bold leading-tight">{drill.name}</h2>
            <p className="mt-1 text-sm text-mist">{drill.summary}</p>
          </header>

          <div className="space-y-6 px-6 py-5">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Duration" value={formatDuration(drill.durationMins)} />
              <Stat label="Players" value={`${drill.minPlayers}–${drill.maxPlayers}`} />
              <Stat label="Intensity" value={labelFor('intensity', drill.intensity)} />
              <Stat
                label="Ages"
                value={(drill.ageGroups ?? []).map(age => labelFor('ageGroup', age)).join(', ')}
              />
            </dl>

            {/* Video first, diagram second. Watching the drill run is the
                quickest way to understand it, and the diagram then reads as the
                thing you take to the pitch — it is also what survives into
                print, where the video cannot follow. */}
            {drill.videoId && (
              <Section title="Watch it run">
                <DrillVideo videoId={drill.videoId} drillName={drill.name} />
              </Section>
            )}

            {drill.diagram && (
              <Section title="How it looks">
                <PitchDiagram diagram={drill.diagram} drillName={drill.name} />
              </Section>
            )}

            <Section title="What happens">
              <Markdown source={drill.description} />
            </Section>

            {drill.setup && (
              <Section title="Setting it up">
                <Markdown source={drill.setup} />
              </Section>
            )}

            {drill.imageUrl && (
              <Section title="Diagram">
                <img
                  src={drill.imageUrl}
                  alt={`Diagram for ${drill.name}`}
                  loading="lazy"
                  className="max-w-full rounded border border-line"
                />
              </Section>
            )}

            <Section title="Coaching points">
              <PointList items={drill.coachingPoints} marker="→" />
            </Section>

            <div className="grid gap-6 sm:grid-cols-2">
              {drill.progressions?.length > 0 && (
                <Section title="Make it harder">
                  <PointList items={drill.progressions} marker="↑" />
                </Section>
              )}
              {drill.regressions?.length > 0 && (
                <Section title="Make it easier">
                  <PointList items={drill.regressions} marker="↓" />
                </Section>
              )}
            </div>

            <Section title="Equipment">
              <p className="text-sm text-mist">
                {sentenceList((drill.equipment ?? []).map(item => labelFor('equipment', item))) ||
                  'Nothing needed'}
              </p>
            </Section>

            {drill.references?.length > 0 && (
              <Section title="Further reading">
                {/* We link out rather than reproduce. See docs/content-policy.md. */}
                <ul className="space-y-1.5 text-sm">
                  {drill.references.map(reference => (
                    <li key={reference.url}>
                      <a
                        href={reference.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-pitch-mid underline underline-offset-2"
                      >
                        {reference.label}
                      </a>
                      <span className="ml-1.5 text-xs text-mist">
                        ({labelFor('source', reference.source)})
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <p className="border-t border-line pt-4 text-xs text-mist">
              Added by {drill.createdBy?.displayName ?? 'a coach'}
              {drill.source === 'seed' && '. Part of the starter library.'}
            </p>
          </div>

          <footer className="sticky bottom-0 flex gap-2 border-t border-line bg-chalk/95 px-6 py-4 backdrop-blur">
            <button type="button" onClick={() => dialogRef.current?.close()} className="btn-ghost">
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onAdd(drill)
                dialogRef.current?.close()
              }}
              className="btn-primary ml-auto"
            >
              {isAdded ? '+ Add again' : '+ Add to session'}
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
