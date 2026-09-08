import { useLayoutEffect, useRef } from 'react'
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import Library from './pages/Library.jsx'
import Planner from './pages/Planner.jsx'
import SessionView from './pages/SessionView.jsx'
import { useSession } from './state/session-context.jsx'
import { totalMinutes, formatDuration } from './lib/timings.js'

function Brand() {
  return (
    <NavLink to="/" className="flex min-h-[2.75rem] items-center gap-2.5" aria-label="Clean Sheet — home">
      {/* A pitch reduced to the two marks that define it: the halfway line and
          the centre circle. The spot is the one piece of high-vis in the mark. */}
      <svg viewBox="0 0 26 30" className="h-7 w-6 shrink-0" aria-hidden>
        <rect
          x="1.4" y="1.4" width="23.2" height="27.2" rx="1.5"
          fill="none" stroke="currentColor" strokeWidth="2" className="text-pitch"
        />
        <line x1="1.4" y1="15" x2="24.6" y2="15" stroke="currentColor" strokeWidth="2" className="text-pitch" />
        <circle cx="13" cy="15" r="4.6" fill="none" stroke="currentColor" strokeWidth="2" className="text-pitch" />
        <circle cx="13" cy="15" r="1.6" className="fill-hivis" />
      </svg>
      <span className="font-display text-lg font-black tracking-tight text-pitch">Clean Sheet</span>
    </NavLink>
  )
}

function Tab({ to, children, badge }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'relative flex min-h-[2.75rem] items-center rounded-md px-3 text-sm font-semibold transition-colors duration-[120ms]',
          isActive ? 'text-pitch' : 'text-mist hover:text-pitch',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          {children}
          {badge != null && badge > 0 && (
            <span className="tnum ml-1.5 rounded bg-pitch px-1.5 py-0.5 text-[0.7rem] text-chalk">
              {badge}
            </span>
          )}
          {/* The active tab is underscored with a pitch marking. */}
          {isActive && <span aria-hidden className="absolute inset-x-2 bottom-0 h-[3px] bg-pitch" />}
        </>
      )}
    </NavLink>
  )
}

/**
 * Publish the header's real height as --header-h.
 *
 * The header gains a "session in progress" row the moment a coach has blocks in
 * their plan, so its height is not a constant. Anything sticking below it (the
 * library's filter bar) has to follow, or it tucks underneath and the search
 * field gets clipped — which only happened once you had a session on the go,
 * i.e. for every returning coach.
 */
function useHeaderHeight(ref, deps) {
  useLayoutEffect(() => {
    const header = ref.current
    const root = document.documentElement
    if (!header) {
      root.style.removeProperty('--header-h')
      return undefined
    }
    const measure = () => root.style.setProperty('--header-h', `${header.offsetHeight}px`)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(header)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

export default function App() {
  const { session } = useSession()
  const location = useLocation()
  const headerRef = useRef(null)

  // The read-only share view is its own thing: no nav, no planner chrome, so it
  // prints cleanly and reads well on a phone in the rain.
  const isSharedView = location.pathname.startsWith('/session/')
  const planned = totalMinutes(session.blocks)

  useHeaderHeight(headerRef, [isSharedView, planned > 0, location.pathname])

  return (
    <div className="min-h-dvh">
      {!isSharedView && (
        <header
          ref={headerRef}
          className="no-print sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur"
        >
          <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-2 sm:px-6">
            <Brand />
            <nav className="ml-auto flex items-center gap-0.5" aria-label="Main">
              <Tab to="/library">Drills</Tab>
              <Tab to="/plan" badge={session.blocks.length}>
                Plan
              </Tab>
            </nav>
          </div>
          {planned > 0 && !location.pathname.startsWith('/plan') && (
            <div className="border-t border-line bg-chalk">
              <div className="mx-auto max-w-5xl px-4 py-1.5 sm:px-6">
                <span className="label-sm">
                  Session in progress · {session.blocks.length}{' '}
                  {session.blocks.length === 1 ? 'block' : 'blocks'} · {formatDuration(planned)}
                </span>
              </div>
            </div>
          )}
        </header>
      )}

      <main className={isSharedView ? '' : 'mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8'}>
        <Routes>
          <Route path="/" element={<Navigate to="/library" replace />} />
          <Route path="/library" element={<Library />} />
          <Route path="/library/:slug" element={<Library />} />
          <Route path="/plan" element={<Planner />} />
          <Route path="/session/:shareId" element={<SessionView />} />
          <Route path="*" element={<Navigate to="/library" replace />} />
        </Routes>
      </main>
    </div>
  )
}
