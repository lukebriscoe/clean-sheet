import { useEffect, useRef, useState } from 'react'
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
      {/* opacity-70, not 60: at 12px the count needs 4.5:1 and 60% of --ink on a
          white chip measures 4.36:1. 70% keeps the count clearly secondary and
          lands at 6.0:1 on the light chip, 6.9:1 on the filled one. */}
      {count != null && <span className="tnum text-xs opacity-70">{count}</span>}
    </Element>
  )
}

/**
 * A number input you can actually clear.
 *
 * The obvious `Number(e.target.value) || fallback` re-stamps the fallback on
 * every keystroke, so clearing the field to type a new value snaps it straight
 * back to 1 — you then have to select-all or backspace again for every digit.
 * On a phone that is genuinely infuriating.
 *
 * Instead the field keeps its own draft string, is allowed to sit empty while
 * you type, and only falls back to a sensible value on blur. Clamping also
 * waits for blur: clamping as you type means a field with min=5 jumps to 5 the
 * moment you type the "1" of "15".
 *
 * The commit is debounced rather than fired per keystroke. Committing on every
 * keystroke means typing "50" over a selected "15" publishes 5 on the way past,
 * so the running total, the shape strip and every start time below it visibly
 * flinch to a five-minute block before landing. Waiting for blur instead fixes
 * that but costs the live feedback — you retype the session length and nothing
 * moves until you tap away, which reads as the app having ignored you. A short
 * debounce keeps the number live without publishing the digits you typed
 * through; blur and Enter flush it immediately.
 */
const COMMIT_DELAY_MS = 250

export function NumberField({
  value,
  onCommit,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  fallback = min,
  className = 'field',
  ...rest
}) {
  const [draft, setDraft] = useState(String(value ?? ''))
  const [editing, setEditing] = useState(false)
  const pending = useRef(null)

  // Follow external changes (a reset, a loaded draft) but never fight the user
  // while they are mid-edit.
  useEffect(() => {
    if (!editing) setDraft(String(value ?? ''))
  }, [value, editing])

  const cancelPending = () => {
    if (pending.current) window.clearTimeout(pending.current)
    pending.current = null
  }

  // A pending commit must not outlive the field — a block can be removed while
  // its duration is mid-edit.
  useEffect(() => cancelPending, [])

  const clamp = n => Math.min(max, Math.max(min, n))

  // Flush: clamp, normalise and publish. Used by blur and Enter, where the user
  // has signalled they are done.
  const settle = () => {
    cancelPending()
    const parsed = Number(draft)
    const settled = draft === '' || !Number.isFinite(parsed) ? fallback : clamp(parsed)
    setDraft(String(settled))
    onCommit(settled)
  }

  return (
    <input
      type="number"
      inputMode="numeric"
      value={draft}
      min={min}
      max={max}
      className={className}
      onFocus={() => setEditing(true)}
      onChange={event => {
        const next = event.target.value
        setDraft(next) // may be '' — that is the point
        cancelPending()
        // Unclamped on purpose: clamping here is what made a min=5 field jump to
        // 5 the moment you typed the "1" of "15". Blur does the clamping.
        const parsed = Number(next)
        if (next === '' || !Number.isFinite(parsed)) return
        pending.current = window.setTimeout(() => {
          pending.current = null
          onCommit(parsed)
        }, COMMIT_DELAY_MS)
      }}
      onKeyDown={event => {
        if (event.key !== 'Enter') return
        event.preventDefault() // don't submit a surrounding form on the way past
        settle()
      }}
      onBlur={() => {
        setEditing(false)
        settle()
      }}
      {...rest}
    />
  )
}

/**
 * A labelled form field.
 *
 * Pass `group` when the contents are several controls rather than one — a row of
 * chips, a set of checkboxes. It matters more than it looks: <button> is a
 * *labelable* element, so a <label> wrapped around a group of chips silently
 * adopts the first one as its control. That gave the first chip an accessible
 * name of the entire group's text ("Themes*PassingReceiving & first touch…"),
 * and made tapping the word "Themes" toggle the Passing chip. `group` renders a
 * fieldset/legend instead, which is what DrillFilters already does.
 */
export function Field({ label, hint, error, children, required, group = false }) {
  const Wrapper = group ? 'fieldset' : 'label'
  const Caption = group ? 'legend' : 'span'

  return (
    <Wrapper className="block">
      <Caption className="mb-1.5 flex w-full items-baseline justify-between gap-2">
        <span className="label">
          {label}
          {required && <span className="ml-1 text-whistle">*</span>}
        </span>
        {hint && <span className="text-xs text-mist">{hint}</span>}
      </Caption>
      {children}
      {error && (
        <span role="alert" className="mt-1.5 block text-sm font-semibold text-whistle">
          {error}
        </span>
      )}
    </Wrapper>
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
