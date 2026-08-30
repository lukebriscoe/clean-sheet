// Slugs and ids. Kept dependency-free — crypto.randomUUID is available in every
// browser we care about and in Node 19+, which the seed script runs on.

/** "Third-Man Runs!" -> "third-man-runs". Used for readable drill URLs. */
export function slugify(text) {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents left behind by NFKD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/**
 * A slug guaranteed not to collide with one already in use. Two coaches naming a
 * drill "Rondo" should both succeed, with the second becoming "rondo-2".
 */
export function uniqueSlug(text, existingSlugs = []) {
  const base = slugify(text) || 'drill'
  const taken = new Set(existingSlugs)
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

function randomId(length) {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789' // no look-alikes: l/1, o/0
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('')
}

/** Short id for a session block. Only needs to be unique within one session. */
export function blockId() {
  return `blk_${randomId(8)}`
}

/**
 * The unguessable part of a share URL. Sessions are readable by anyone with the
 * link, so this is the only thing standing between a coach's plan and the world —
 * 12 chars of a 32-char alphabet is ~60 bits, which is plenty. It is NOT a
 * security boundary for anything sensitive, and the docs say so.
 */
export function shareId() {
  return randomId(12)
}
