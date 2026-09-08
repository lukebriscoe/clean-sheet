// The shared vocabulary of the whole app: filters, the add-drill form, the seed
// data and the Firestore rules all agree on these values. Add a theme here and it
// appears everywhere — but remember to mirror any new *key* into firestore.rules,
// which validates against its own copy (rules can't import JS).

export const AGE_GROUPS = [
  { key: 'u6', label: 'U6' },
  { key: 'u7', label: 'U7' },
  { key: 'u8', label: 'U8' },
  { key: 'u9', label: 'U9' },
  { key: 'u10', label: 'U10' },
  { key: 'u11', label: 'U11' },
  { key: 'u12', label: 'U12' },
  { key: 'u13', label: 'U13' },
  { key: 'u14plus', label: 'U14+' },
]

export const THEMES = [
  { key: 'passing', label: 'Passing' },
  { key: 'receiving', label: 'Receiving & first touch' },
  { key: 'dribbling', label: 'Dribbling & 1v1' },
  { key: 'shooting', label: 'Shooting & finishing' },
  { key: 'defending', label: 'Defending' },
  { key: 'possession', label: 'Possession' },
  { key: 'transition', label: 'Transition' },
  { key: 'movement', label: 'Movement & support' },
  { key: 'goalkeeping', label: 'Goalkeeping' },
  { key: 'physical', label: 'Physical literacy' },
  { key: 'funandconfidence', label: 'Fun & confidence' },
]

// The shape of a typical session, in the order coaches usually run it. The planner
// uses this order to suggest where a new block belongs.
export const PHASES = [
  { key: 'warmup', label: 'Warm-up', hint: 'Arrival activity, ball every player, gradual build' },
  { key: 'technical', label: 'Technical practice', hint: 'Unopposed or lightly opposed skill work' },
  { key: 'ssg', label: 'Small-sided game', hint: 'Game-realistic, everyone involved, high touches' },
  { key: 'phase-of-play', label: 'Phase of play', hint: 'A slice of the real game, directional' },
  { key: 'scrimmage', label: 'Match / scrimmage', hint: 'Let them play — coach lightly' },
  { key: 'cooldown', label: 'Cool-down & review', hint: 'Calm the bodies, ask the questions' },
]

export const EQUIPMENT = [
  { key: 'balls', label: 'Balls' },
  { key: 'cones', label: 'Cones / markers' },
  { key: 'bibs', label: 'Bibs' },
  { key: 'goals', label: 'Goals' },
  { key: 'minigoals', label: 'Mini goals' },
  { key: 'poles', label: 'Poles / mannequins' },
  { key: 'ladders', label: 'Agility ladder' },
  { key: 'none', label: 'No equipment' },
]

export const INTENSITIES = [
  { key: 'low', label: 'Low' },
  { key: 'medium', label: 'Medium' },
  { key: 'high', label: 'High' },
]

export const SOURCES = [
  { key: 'fa', label: 'England Football Learning (The FA)' },
  { key: 'fifa', label: 'FIFA Training Centre' },
  { key: 'other', label: 'Other' },
]

// Look-up helpers. Unknown keys pass through rather than blowing up, because
// community-submitted drills are the one place an unexpected value could appear.
const toMap = list => Object.fromEntries(list.map(item => [item.key, item.label]))

const LABELS = {
  ageGroup: toMap(AGE_GROUPS),
  theme: toMap(THEMES),
  phase: toMap(PHASES),
  equipment: toMap(EQUIPMENT),
  intensity: toMap(INTENSITIES),
  source: toMap(SOURCES),
}

export function labelFor(kind, key) {
  return LABELS[kind]?.[key] ?? key
}

export function phaseOrder(key) {
  const index = PHASES.findIndex(phase => phase.key === key)
  return index === -1 ? PHASES.length : index
}

// Field length caps. Enforced here for a friendly inline message AND again in
// firestore.rules, which is the boundary that actually matters — with open write
// access the client is only a suggestion.
export const LIMITS = {
  name: 120,
  summary: 200,
  description: 4000,
  setup: 3000,
  listItem: 300,
  listLength: 12,
  notes: 1000,
  title: 120,
  objectives: 2000,
  displayName: 60,
  blocks: 30,
  references: 6,
}

/**
 * "cones, bibs and balls" — a list as a person would say it.
 *
 * Equipment and kit lists were joined with ' · ' in four places. A middle-dot
 * run is a delimiter, not language: it reads as data on a page that is otherwise
 * written in sentences, and a screen reader says nothing at all for it.
 */
export function sentenceList(items = []) {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}
