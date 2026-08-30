import { useState } from 'react'
import { AGE_GROUPS, THEMES, PHASES, EQUIPMENT, INTENSITIES, LIMITS } from '../../lib/taxonomy.js'
import { emptyDrill, validateDrill } from '../../lib/schema.js'
import { Chip, Field } from '../ui/Bits.jsx'

/**
 * Add a drill to the shared library.
 *
 * No login (v1 trade-off — see docs/v1-tradeoffs.md), so this form is the front
 * door for anyone on the internet. It validates on submit rather than on every
 * keystroke: a volunteer typing this up at 10pm does not need red text following
 * them down the page.
 */
export default function DrillForm({ onSubmit, onCancel, submitting }) {
  const [values, setValues] = useState(emptyDrill)
  const [errors, setErrors] = useState({})
  const [failed, setFailed] = useState(false)

  const set = (field, value) => setValues(current => ({ ...current, [field]: value }))

  const toggle = (field, key) =>
    setValues(current => ({
      ...current,
      [field]: current[field].includes(key)
        ? current[field].filter(item => item !== key)
        : [...current[field], key],
    }))

  const setListItem = (field, index, value) =>
    setValues(current => {
      const list = [...current[field]]
      list[index] = value
      // Always leave one empty box at the end so there's no "add another" button
      // to hunt for — you just keep typing.
      if (index === list.length - 1 && value && list.length < LIMITS.listLength) list.push('')
      return { ...current, [field]: list }
    })

  const handleSubmit = async event => {
    event.preventDefault()
    const result = validateDrill(values)
    setErrors(result.errors)
    if (!result.ok) {
      setFailed(true)
      // Take them to the first thing that needs fixing rather than making them hunt.
      document.querySelector('[data-invalid="true"]')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
      return
    }
    setFailed(false)
    await onSubmit(result.values)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="surface space-y-4 p-5">
        <div data-invalid={Boolean(errors.name)}>
          <Field label="Drill name" error={errors.name} required>
            <input
              className="field"
              value={values.name}
              maxLength={LIMITS.name}
              onChange={event => set('name', event.target.value)}
              placeholder="e.g. Passing Gates"
            />
          </Field>
        </div>

        <div data-invalid={Boolean(errors.summary)}>
          <Field
            label="One-line summary"
            hint={`${values.summary.length}/${LIMITS.summary}`}
            error={errors.summary}
            required
          >
            <input
              className="field"
              value={values.summary}
              maxLength={LIMITS.summary}
              onChange={event => set('summary', event.target.value)}
              placeholder="What a coach sees on the card"
            />
          </Field>
        </div>

        <div data-invalid={Boolean(errors.description)}>
          <Field
            label="What happens"
            hint="Markdown is fine — **bold**, lists"
            error={errors.description}
            required
          >
            <textarea
              className="field min-h-[9rem] resize-y"
              value={values.description}
              maxLength={LIMITS.description}
              onChange={event => set('description', event.target.value)}
              placeholder="Describe the activity in your own words."
            />
          </Field>
        </div>

        <Field label="Setting it up" hint="Pitch size, cones, starting positions" error={errors.setup}>
          <textarea
            className="field min-h-[5rem] resize-y"
            value={values.setup}
            maxLength={LIMITS.setup}
            onChange={event => set('setup', event.target.value)}
            placeholder="e.g. A 20x20 yard grid, one ball per player."
          />
        </Field>
      </div>

      <div className="surface space-y-5 p-5">
        <div data-invalid={Boolean(errors.coachingPoints)}>
          <ListField
            label="Coaching points"
            hint="The most useful part of any drill"
            required
            error={errors.coachingPoints}
            items={values.coachingPoints}
            onChange={(index, value) => setListItem('coachingPoints', index, value)}
            placeholder="e.g. Head up before you receive"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <ListField
            label="Make it harder"
            items={values.progressions}
            onChange={(index, value) => setListItem('progressions', index, value)}
            placeholder="e.g. Two-touch limit"
          />
          <ListField
            label="Make it easier"
            items={values.regressions}
            onChange={(index, value) => setListItem('regressions', index, value)}
            placeholder="e.g. Make the area bigger"
          />
        </div>
      </div>

      <div className="surface space-y-5 p-5">
        <div data-invalid={Boolean(errors.themes)}>
          <Field label="Themes" error={errors.themes} required>
            <div className="flex flex-wrap gap-1.5">
              {THEMES.map(theme => (
                <Chip
                  key={theme.key}
                  active={values.themes.includes(theme.key)}
                  onClick={() => toggle('themes', theme.key)}
                >
                  {theme.label}
                </Chip>
              ))}
            </div>
          </Field>
        </div>

        <div data-invalid={Boolean(errors.ageGroups)}>
          <Field label="Age groups it suits" error={errors.ageGroups} required>
            <div className="flex flex-wrap gap-1.5">
              {AGE_GROUPS.map(age => (
                <Chip
                  key={age.key}
                  active={values.ageGroups.includes(age.key)}
                  onClick={() => toggle('ageGroups', age.key)}
                >
                  {age.label}
                </Chip>
              ))}
            </div>
          </Field>
        </div>

        <Field label="Equipment needed">
          <div className="flex flex-wrap gap-1.5">
            {EQUIPMENT.filter(item => item.key !== 'none').map(item => (
              <Chip
                key={item.key}
                active={values.equipment.includes(item.key)}
                onClick={() => toggle('equipment', item.key)}
              >
                {item.label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Where it fits in a session">
          <select
            className="field"
            value={values.sessionPhase}
            onChange={event => set('sessionPhase', event.target.value)}
          >
            {PHASES.map(phase => (
              <option key={phase.key} value={phase.key}>
                {phase.label} — {phase.hint}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Min players">
            <input
              type="number" min="1" max="40" className="field tnum"
              value={values.minPlayers}
              onChange={event => set('minPlayers', event.target.value)}
            />
          </Field>
          <div data-invalid={Boolean(errors.maxPlayers)}>
            <Field label="Max players" error={errors.maxPlayers}>
              <input
                type="number" min="1" max="40" className="field tnum"
                value={values.maxPlayers}
                onChange={event => set('maxPlayers', event.target.value)}
              />
            </Field>
          </div>
          <Field label="Minutes">
            <input
              type="number" min="1" max="120" step="5" className="field tnum"
              value={values.durationMins}
              onChange={event => set('durationMins', event.target.value)}
            />
          </Field>
          <Field label="Intensity">
            <select
              className="field"
              value={values.intensity}
              onChange={event => set('intensity', event.target.value)}
            >
              {INTENSITIES.map(item => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div className="surface space-y-4 p-5">
        <Field label="Your name" hint="Optional — shown on the drill">
          <input
            className="field"
            value={values.createdByName}
            maxLength={LIMITS.displayName}
            onChange={event => set('createdByName', event.target.value)}
            placeholder="Anonymous coach"
          />
        </Field>

        <Field
          label="Image URL"
          hint="Optional — link to a diagram you host elsewhere"
        >
          <input
            type="url"
            className="field"
            value={values.imageUrl ?? ''}
            onChange={event => set('imageUrl', event.target.value || null)}
            placeholder="https://…"
          />
        </Field>

        <p className="text-sm text-mist">
          Please write the drill in your own words rather than pasting it from a coaching site or
          book.
        </p>
      </div>

      {failed && (
        <p role="alert" className="text-sm text-whistle">
          A few things need fixing before this can be added — they're marked above.
        </p>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="btn-ghost">
          Cancel
        </button>
        <button type="submit" disabled={submitting} className="btn-primary ml-auto">
          {submitting ? 'Adding…' : 'Add to the library'}
        </button>
      </div>
    </form>
  )
}

/** A growing list of short text inputs — coaching points, progressions, regressions. */
function ListField({ label, hint, items, onChange, placeholder, error, required }) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <span aria-hidden className="tnum text-xs text-mist">
              {index + 1}
            </span>
            <input
              className="field"
              value={item}
              maxLength={LIMITS.listItem}
              onChange={event => onChange(index, event.target.value)}
              placeholder={index === 0 ? placeholder : 'Add another…'}
              aria-label={`${label} ${index + 1}`}
            />
          </div>
        ))}
      </div>
    </Field>
  )
}
