import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDrills, fetchDrill } from '../hooks/useDrills.js'
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
  const { slug } = useParams()

  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [openDrill, setOpenDrill] = useState(null)
  const [adding, setAdding] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [moreFilters, setMoreFilters] = useState(false)
  // One transient confirmation slot, shared by "added to your session" and
  // "added to the library" — two things that need saying and one place to say it.
  const [notice, setNotice] = useState(null)

  const visible = useMemo(() => applyFilters(drills, filters), [drills, filters])
  const inSession = useMemo(
    () => new Set(session.blocks.map(block => block.drillId).filter(Boolean)),
    [session.blocks],
  )

  // The open drill lives in the URL, so a coach can send another coach a drill
  // and the back button closes the dialog. The route already existed; nothing
  // read it, so /library/:slug rendered a bare library.
  useEffect(() => {
    if (!slug) {
      setOpenDrill(null)
      return undefined
    }
    const found = drills.find(drill => drill.slug === slug || drill.id === slug)
    if (found) {
      setOpenDrill(found)
      return undefined
    }
    // Cold deep link: the library may not have loaded yet, and the id may not be
    // a slug we hold. Only give up once the list has actually arrived.
    if (loading) return undefined
    let cancelled = false
    fetchDrill(slug)
      .then(drill => {
        if (cancelled) return
        if (drill) setOpenDrill(drill)
        else navigate('/library', { replace: true })
      })
      .catch(() => {
        if (!cancelled) navigate('/library', { replace: true })
      })
    return () => {
      cancelled = true
    }
  }, [slug, drills, loading, navigate])

  const openDrillPage = drill => navigate(`/library/${drill.slug ?? drill.id}`)
  const closeDrillPage = () => {
    if (slug) navigate('/library')
    else setOpenDrill(null)
  }

  const announce = next => {
    setNotice(next)
    window.setTimeout(() => setNotice(current => (current === next ? null : current)), 5000)
  }

  const handleAddToSession = drill => {
    addToSession(drill)
    announce({
      text: drill.name,
      detail: 'added to your session.',
      actionLabel: 'View plan',
      onAction: () => navigate('/plan'),
    })
  }

  const handleCreate = async values => {
    setSubmitting(true)
    try {
      await addDrill(values)
      setAdding(false)
      // Clearing the filters matters: the contributor lands back in the list and
      // the drill they just wrote is newest-first at the top of it.
      setFilters(EMPTY_FILTERS)
      // Five minutes of typing previously ended in silence. Say it landed, and
      // offer the way to see it.
      announce({
        text: values.name,
        detail: 'added to the shared library — it is at the top of the list.',
        actionLabel: 'View it',
        onAction: () => navigate(`/library/${values.slug}`),
      })
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
        <h1 className="sr-only font-display font-black leading-[1.1] tracking-tight sm:not-sr-only sm:text-[2.5rem]">
          Find drills for tonight
        </h1>
        {/* The kit filter is inverted — it shows what you can run with only what
            you picked — and "what's in the car" is the sentence that explains it
            without a paragraph of help text. The old line also told coaches to
            "click the plus sign", which is the wrong verb for the device this is
            built for and an admission the control was not self-evident. */}
        <p className="measure-tight mt-2 hidden text-mist sm:block">
          Filter by what you&rsquo;re working on, who&rsquo;s turned up, and what&rsquo;s in the car.
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
      <div className="sticky top-[var(--header-h)] z-10 -mx-4 mb-4 border-y border-line bg-paper/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6">
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


      {/* Pinned to the viewport on a phone. Inline, it rendered above the list —
          so adding the fortieth drill put the confirmation, and the only "View
          plan" link, several hundred pixels above the fold. */}
      {notice && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-4 z-30 flex flex-wrap items-center gap-2 rounded-md border border-line border-l-4 border-l-hivis bg-chalk px-4 py-3 text-sm lg:static lg:mb-4 lg:border-l-4"
        >
          <strong className="font-bold text-pitch">{notice.text}</strong>
          <span className="min-w-0 flex-1 text-mist">{notice.detail}</span>
          <button
            type="button"
            onClick={() => { notice.onAction(); setNotice(null) }}
            className="shrink-0 font-semibold text-pitch underline underline-offset-2"
          >
            {notice.actionLabel}
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
              onOpen={openDrillPage}
              onAdd={handleAddToSession}
              isAdded={inSession.has(drill.id)}
            />
          ))}
        </ul>
      )}

      {!loading && visible.length > 0 && (
        <p className="mt-3 text-sm text-mist">
          {visible.length} of {drills.length} drills.
          {hasActiveFilters(filters) && (
            <>
              {' '}
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="font-semibold text-pitch underline underline-offset-2"
              >
                Clear filters
              </button>
            </>
          )}
        </p>
      )}

      <DrillDetail
        drill={openDrill}
        onClose={closeDrillPage}
        onAdd={handleAddToSession}
        isAdded={openDrill ? inSession.has(openDrill.id) : false}
      />
    </div>
  )
}
