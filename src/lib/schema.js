import { AGE_GROUPS, THEMES, PHASES, EQUIPMENT, INTENSITIES, LIMITS } from './taxonomy.js'
import { slugify, blockId, shareId } from './ids.js'
import { normaliseDiagram } from './diagram.js'

// One definition of what a valid drill/session looks like, used by the add-drill
// form, the seed importer, and the AI assistant when it lands. firestore.rules
// enforces the same constraints server-side — this module is for good error
// messages, the rules are for actual safety.

export const SCHEMA_VERSION = 1

const keysOf = list => list.map(item => item.key)
const VALID = {
  ageGroups: keysOf(AGE_GROUPS),
  themes: keysOf(THEMES),
  phases: keysOf(PHASES),
  equipment: keysOf(EQUIPMENT),
  intensities: keysOf(INTENSITIES),
}

/** A blank drill, matching what the form binds to. */
export function emptyDrill() {
  return {
    name: '',
    summary: '',
    description: '',
    setup: '',
    coachingPoints: [''],
    progressions: [''],
    regressions: [''],
    themes: [],
    ageGroups: [],
    sessionPhase: 'technical',
    minPlayers: 6,
    maxPlayers: 12,
    durationMins: 15,
    intensity: 'medium',
    equipment: ['balls', 'cones'],
    imageUrl: null,
    diagram: null,
    references: [],
    createdByName: '',
  }
}

const cleanList = (list, cap = LIMITS.listLength) =>
  (Array.isArray(list) ? list : [])
    .map(item => String(item ?? '').trim())
    .filter(Boolean)
    .slice(0, cap)

const clampInt = (value, min, max, fallback) => {
  const num = Math.round(Number(value))
  if (!Number.isFinite(num)) return fallback
  return Math.min(max, Math.max(min, num))
}

/**
 * Validate a drill from the form. Returns { errors, values } where `errors` is a
 * field-keyed map — empty means good. We validate what a coach could plausibly get
 * wrong and silently normalise the rest; a volunteer filling in a form at 10pm
 * should not be told off for trailing whitespace.
 */
export function validateDrill(input) {
  const errors = {}

  const name = String(input.name ?? '').trim()
  if (!name) errors.name = 'Give the drill a name.'
  else if (name.length > LIMITS.name) errors.name = `Keep the name under ${LIMITS.name} characters.`

  const summary = String(input.summary ?? '').trim()
  if (!summary) errors.summary = 'Add a one-line summary — this is what coaches see on the card.'
  else if (summary.length > LIMITS.summary)
    errors.summary = `Keep the summary under ${LIMITS.summary} characters.`

  const description = String(input.description ?? '').trim()
  if (!description) errors.description = 'Describe what happens in the drill.'
  else if (description.length > LIMITS.description)
    errors.description = `That's longer than ${LIMITS.description} characters — try trimming it.`

  const setup = String(input.setup ?? '').trim()
  if (setup.length > LIMITS.setup)
    errors.setup = `Keep the set-up under ${LIMITS.setup} characters.`

  const themes = (input.themes ?? []).filter(theme => VALID.themes.includes(theme))
  if (!themes.length) errors.themes = 'Pick at least one theme so coaches can find this.'

  const ageGroups = (input.ageGroups ?? []).filter(age => VALID.ageGroups.includes(age))
  if (!ageGroups.length) errors.ageGroups = 'Pick at least one age group.'

  const minPlayers = clampInt(input.minPlayers, 1, 40, 1)
  const maxPlayers = clampInt(input.maxPlayers, 1, 40, 40)
  if (maxPlayers < minPlayers) {
    errors.maxPlayers = 'The maximum number of players must be at least the minimum.'
  }

  const coachingPoints = cleanList(input.coachingPoints)
  if (!coachingPoints.length) {
    errors.coachingPoints = 'Add at least one coaching point — it is the most useful part.'
  }

  const references = (Array.isArray(input.references) ? input.references : [])
    .map(ref => ({
      label: String(ref?.label ?? '').trim().slice(0, LIMITS.name),
      url: String(ref?.url ?? '').trim(),
      source: VALID_SOURCE(ref?.source),
    }))
    .filter(ref => ref.label && isHttpUrl(ref.url))
    .slice(0, LIMITS.references)

  const values = {
    schemaVersion: SCHEMA_VERSION,
    name,
    slug: slugify(name),
    summary,
    description,
    setup,
    coachingPoints,
    progressions: cleanList(input.progressions),
    regressions: cleanList(input.regressions),
    themes,
    ageGroups,
    sessionPhase: VALID.phases.includes(input.sessionPhase) ? input.sessionPhase : 'technical',
    minPlayers,
    maxPlayers: Math.max(minPlayers, maxPlayers),
    durationMins: clampInt(input.durationMins, 1, 120, 15),
    intensity: VALID.intensities.includes(input.intensity) ? input.intensity : 'medium',
    equipment: (input.equipment ?? []).filter(item => VALID.equipment.includes(item)),
    imageUrl: isHttpUrl(input.imageUrl) ? input.imageUrl.trim() : null,
    // Malformed shapes are dropped rather than rejected — a bad diagram should
    // cost you the diagram, not the whole submission.
    diagram: normaliseDiagram(input.diagram),
    references,
    createdBy: {
      uid: null, // v1 has no auth; the field exists so adding it later is a rules change
      displayName: String(input.createdByName ?? '').trim().slice(0, LIMITS.displayName) || 'Anonymous coach',
    },
    clubId: null,
    source: input.source === 'ai' ? 'ai' : 'community',
    status: 'published',
  }

  if (!values.equipment.length) values.equipment = ['none']

  return { errors, values, ok: Object.keys(errors).length === 0 }
}

function VALID_SOURCE(source) {
  return ['fa', 'fifa', 'other'].includes(source) ? source : 'other'
}

/** Only http(s) — blocks javascript: and data: URIs reaching an href. */
export function isHttpUrl(value) {
  if (!value || typeof value !== 'string') return false
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** A fresh, empty session — what "start with a clean sheet" actually produces. */
export function emptySession(overrides = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    title: '',
    ageGroup: 'u10',
    theme: '',
    dateFor: null,
    startTime: '',
    durationMins: 90,
    playerCount: 12,
    objectives: '',
    blocks: [],
    shareId: shareId(),
    visibility: 'public',
    createdBy: { uid: null, displayName: '' },
    clubId: null,
    ...overrides,
  }
}

/**
 * Turn a library drill into a session block.
 *
 * The snapshot is the important bit: a saved session keeps its own frozen copy of
 * the drill, so editing the shared library later can never change a plan a coach
 * has already printed and taken to training. `drillId` is kept so we can still
 * link back to the live entry.
 */
export function blockFromDrill(drill, overrides = {}) {
  return {
    id: blockId(),
    drillId: drill.id ?? null,
    phase: drill.sessionPhase ?? 'technical',
    durationMins: clampInt(drill.durationMins, 1, 120, 15),
    notes: '',
    drillSnapshot: {
      name: drill.name ?? 'Untitled drill',
      summary: drill.summary ?? '',
      setup: drill.setup ?? '',
      description: drill.description ?? '',
      coachingPoints: cleanList(drill.coachingPoints),
      progressions: cleanList(drill.progressions),
      regressions: cleanList(drill.regressions),
      equipment: Array.isArray(drill.equipment) ? drill.equipment : [],
      references: Array.isArray(drill.references) ? drill.references : [],
      // Snapshotted like everything else, so a printed plan keeps its diagram
      // even if the library drill is redrawn later.
      diagram: normaliseDiagram(drill.diagram),
    },
    ...overrides,
  }
}

/** A block with no library drill behind it — "we always finish with a match". */
export function freeformBlock(phase = 'scrimmage') {
  return {
    id: blockId(),
    drillId: null,
    phase,
    durationMins: 15,
    notes: '',
    drillSnapshot: {
      name: '',
      summary: '',
      setup: '',
      description: '',
      coachingPoints: [],
      progressions: [],
      regressions: [],
      equipment: [],
      references: [],
      diagram: null,
    },
  }
}

/** Final tidy before a session hits Firestore. */
export function sanitiseSessionForSave(session) {
  return {
    ...session,
    schemaVersion: SCHEMA_VERSION,
    title: String(session.title ?? '').trim().slice(0, LIMITS.title) || 'Untitled session',
    objectives: String(session.objectives ?? '').trim().slice(0, LIMITS.objectives),
    durationMins: clampInt(session.durationMins, 5, 240, 90),
    playerCount: clampInt(session.playerCount, 1, 60, 12),
    blocks: (session.blocks ?? []).slice(0, LIMITS.blocks).map(block => ({
      ...block,
      durationMins: clampInt(block.durationMins, 1, 240, 15),
      notes: String(block.notes ?? '').trim().slice(0, LIMITS.notes),
    })),
    createdBy: {
      uid: null,
      displayName:
        String(session.createdBy?.displayName ?? '').trim().slice(0, LIMITS.displayName) ||
        'Anonymous coach',
    },
  }
}
