import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDrills } from '../hooks/useDrills.js'
import { useSession } from '../state/session-context.jsx'
import { EMPTY_FILTERS, applyFilters, hasActiveFilters } from '../lib/filters.js'
import DrillRow from '../components/library/DrillRow.jsx'
import DrillFilters, { QuickFilters } from '../components/library/DrillFilters.jsx'
import DrillDetail from '../components/library/DrillDetail.jsx'
import DrillForm from '../components/library/DrillForm.jsx'
import { EmptyState, ErrorNote, Spinner } from '../components/ui/Bits.jsx'

export default function Library() {
  const { drills, loading, error, reload, addDrill } = useDrills()
  const { session, addDrill: addToSession } = useSession()
  const navigate = useNavigate()

  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [openDrill, setOpenDrill] = useState(null)
  const [adding, setAdding] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [moreFilters, setMoreFilters] = useState(false)
  const [justAdded, setJustAdded] = useState(null)

  const visible = useMemo(() => applyFilters(drills, filters), [drills, filters])
  const inSession = useMemo(
    () => new Set(session.blocks.map(block => block.drillId).filter(Boolean)),
    [session.blocks],
  )

  const handleAddToSession = drill => {
    addToSession(drill)
    setJustAdded(drill.name)
    window.setTimeout(() => setJustAdded(null), 3200)
  }

  const handleCreate = async values => {
    setSubmitting(true)
    try {
      await addDrill(values)
      setAdding(false)
      setFilters(EMPTY_FILTERS)
    } catch {
      // useDrills logs it; the error note below covers the UI.
    } finally {
      setSubmitting(false)
    }
  }

  if (adding) {
    return (
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <h1 className="font-display text-3xl">Add a drill</h1>
          <p className="mt-1.5 max-w-prose text-mist">
            It goes straight into the shared library for every coach using Clean Sheet.
          </p>
        </header>
        <DrillForm
          onSubmit={handleCreate}
          onCancel={() => setAdding(false)}
          submitting={submitting}
        />
      </div>
    )
  }

  return (
    <div>

      {/* On a phone the heading and blurb cost 153px above a list you came here to
          scroll — and both are redundant: the nav says Drills and the search box
          says how many there are. Kept for screen readers and for desktop, where
          the space is free. */}
      <header className="mb-0 sm:mb-5">
        <h1 className="sr-only font-display leading-tight sm:not-sr-only sm:text-4xl">
          Search our drills to build your session
        </h1>
        <p className="mt-1.5 hidden max-w-prose text-mist sm:block">
          Filter by what you&rsquo;re working on, who&rsquo;s turned up, and the kit you have available. 
          Click the plus sign to add a drill to your plan.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setAdding(true)} className="btn-ghost">
          Add a drill
        </button>
        <button type="button" onClick={() => navigate('/plan')} className="btn-primary">
          Build a session
          {session.blocks.length > 0 && (
            <span className="tnum rounded bg-chalk/20 px-1.5 text-xs">
              {session.blocks.length}
            </span>
          )}
        </button>
        <span className="tnum ml-auto text-sm text-mist lg:hidden">
          {visible.length} {visible.length === 1 ? 'drill' : 'drills'}
        </span>
      </div>

      {/* Sticky quick filters — the three facets that get used every time. The
          rest live behind the disclosure so the bar stays one line on a phone. */}
      <div className="sticky top-[3.75rem] z-10 -mx-4 mb-4 border-y border-line bg-paper/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6">
        <QuickFilters
          filters={filters}
          onChange={setFilters}
          drills={drills}
          resultCount={visible.length}
          moreOpen={moreFilters}
          onToggleMore={() => setMoreFilters(open => !open)}
        />
        {moreFilters && (
          <div className="mt-3 border-t border-line pt-3">
            <DrillFilters filters={filters} onChange={setFilters} drills={drills} />
          </div>
        )}
      </div>


      {justAdded && (
        <div
          role="status"
          className="mb-4 flex flex-wrap items-center gap-2 rounded-md border-l-4 border-hivis bg-chalk px-4 py-3 text-sm"
        >
          <strong className="font-bold text-pitch">{justAdded}</strong>
          <span className="text-mist">added to your session.</span>
          <button
            type="button"
            onClick={() => navigate('/plan')}
            className="ml-auto font-semibold text-pitch underline underline-offset-2"
          >
            View plan
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4">
          <ErrorNote kind={error} onRetry={error === 'not-configured' ? undefined : reload} />
        </div>
      )}

      {loading ? (
        <Spinner label="Loading the drill library" />
      ) : visible.length === 0 ? (
        <EmptyState
          title={drills.length === 0 ? 'The library is empty' : 'Nothing matches that'}
          action={
            drills.length > 0 ? (
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="btn-ghost"
              >
                Clear filters
              </button>
            ) : (
              <button type="button" onClick={() => setAdding(true)} className="btn-primary">
                Add the first drill
              </button>
            )
          }
        >
          {drills.length === 0
            ? 'No drills have been added yet. Be the first — it takes about two minutes.'
            : 'Try loosening a filter. The kit filter is the strictest: it only shows drills you can run with exactly what you selected.'}
        </EmptyState>
      ) : (
        <ul className="surface overflow-hidden">
          {visible.map(drill => (
            <DrillRow
              key={drill.id}
              drill={drill}
              onOpen={setOpenDrill}
              onAdd={handleAddToSession}
              isAdded={inSession.has(drill.id)}
            />
          ))}
        </ul>
      )}

      {!loading && visible.length > 0 && (
        <p className="mt-3 text-sm text-mist">
          {visible.length} of {drills.length} drills
          {hasActiveFilters(filters) && (
            <>
              {' · '}
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="font-semibold text-pitch underline underline-offset-2"
              >
                clear filters
              </button>
            </>
          )}
        </p>
      )}

      <DrillDetail
        drill={openDrill}
        onClose={() => setOpenDrill(null)}
        onAdd={handleAddToSession}
        isAdded={openDrill ? inSession.has(openDrill.id) : false}
      />
    </div>
  )
}
