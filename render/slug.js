// Seed drills carry a `slug`, but the batch authoring scripts have not always
// written one. Deriving it the same way src/lib/ids.js does keeps the renderer,
// the motion data and the seeded documents all agreeing on a drill's name.

export function slugFor(drill) {
  if (drill?.slug) return drill.slug
  return String(drill?.name ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
