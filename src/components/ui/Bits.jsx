import { renderMarkdown } from '../../lib/markdown.js'

// Small shared pieces. Kept in one file rather than eight — they are a handful of
// lines each and always used together.

export function Chip({ active = false, onClick, children, count, title }) {
  const Element = onClick ? 'button' : 'span'
  return (
    <Element
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title}
      aria-pressed={onClick ? active : undefined}
      className={active ? 'chip-on' : 'chip-off'}
    >
      {children}
      {count != null && <span className="tnum text-xs opacity-60">{count}</span>}
    </Element>
  )
}

export function Field({ label, hint, error, children, required }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="label-sm">
          {label}
          {required && <span className="ml-1 text-whistle">*</span>}
        </span>
        {hint && <span className="text-xs text-mist">{hint}</span>}
      </span>
      {children}
      {error && (
        <span role="alert" className="mt-1.5 block text-sm font-semibold text-whistle">
          {error}
        </span>
      )}
    </label>
  )
}

/** Sanitised markdown. The sanitising happens in lib/markdown.js — see the note there. */
export function Markdown({ source, className = '' }) {
  if (!source) return null
  return (
    <div
      className={`prose-drill ${className}`}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }}
    />
  )
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="surface flex flex-col items-start gap-3 px-6 py-10">
      <h3 className="font-display text-xl">{title}</h3>
      <p className="max-w-prose text-mist">{children}</p>
      {action}
    </div>
  )
}

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="flex items-center gap-3 py-16 text-mist">
      <span
        aria-hidden
        className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-pitch"
      />
      <span className="text-sm">{label}…</span>
    </div>
  )
}

/**
 * Shown when Firestore is unreachable or unconfigured. Coaches are not going to
 * read a stack trace, so each case gets a plain-English sentence and, where
 * possible, something they can actually do.
 */
export function ErrorNote({ kind, onRetry }) {
  const messages = {
    'not-configured': {
      title: 'The drill library is not connected yet',
      body: 'This copy of Clean Sheet has no Firebase project configured. If you are running it locally, copy .env.example to .env and add your project details.',
    },
    'permission-denied': {
      title: "That didn't save",
      body: 'The database rejected it. Usually that means a field is too long or something is missing — try shortening the description.',
    },
    rejected: {
      title: "That didn't save",
      body: 'The database rejected the session. Try shortening the title or notes, then save again.',
    },
    offline: {
      title: 'Cannot reach the drill library',
      body: 'You may be offline. Anything already on screen still works, and your session is saved on this device.',
    },
  }
  const message = messages[kind] ?? messages.offline

  return (
    <div role="alert" className="rounded-md border-l-4 border-whistle bg-chalk px-5 py-4">
      <h3 className="font-display text-lg text-whistle">{message.title}</h3>
      <p className="mt-1 max-w-prose text-sm text-ink">{message.body}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-ghost mt-3">
          Try again
        </button>
      )}
    </div>
  )
}

/**
 * Phase marker. Deliberately NOT a six-hue rainbow — the palette carries two
 * greens and one high-vis, so phases are distinguished by the mark's weight and
 * by its label, not by colour. A rainbow of arbitrary hues is the tell of a
 * palette nobody chose.
 */
export function PhaseMark({ phase, className = '' }) {
  const weight = {
    warmup: 'h-1.5',
    technical: 'h-4',
    ssg: 'h-6',
    'phase-of-play': 'h-6',
    scrimmage: 'h-8',
    cooldown: 'h-1.5',
  }
  const tone = phase === 'scrimmage' || phase === 'ssg' ? 'bg-pitch' : 'bg-pitch-mid'
  return (
    <span
      aria-hidden
      className={`inline-block w-1 shrink-0 rounded-full ${weight[phase] ?? 'h-4'} ${tone} ${className}`}
    />
  )
}
