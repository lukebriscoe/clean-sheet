# Drill video gaps

64 of 69 drills have motion derived from their diagram.

Everything below is CONTENT work on the diagrams — no code change fixes it,
because the pipeline only animates movement someone actually drew. Inventing a
ball or an arrow that is not in the diagram would put a video on the site that
contradicts the drill page next to it.

## No video (5 drills)

### No diagram at all (2) — add one via `npm run diagrams`
- `free-play-match` — Free Play Match
- `juggling-challenge-cool-down` — Juggling Challenge Cool-Down

### A diagram, but nothing moves in it (1) — add pass/run/dribble arrows
- `cool-down-circle` — Cool-Down Circle

### Arrows that match nothing (2) — every arrow needs a ball or player at its tail
- `goalkeeper-handling-circuit` — Goalkeeper Handling Circuit *(3 arrows (3 passes), 0 balls)*
- `balls-on-cones` — Balls on Cones *(2 arrows (2 passes), 4 balls)*

## Has a video, but loses a beat (6 drills)

A pass animates the nearest ball to its tail. Where two teams pass at once but
only one ball is drawn, the second pass has nothing to move. Adding a ball at
the tail of the unmatched arrow is usually the whole fix.

| drill | beats lost | diagram has |
| --- | --- | --- |
| `third-man-runs-in-a-diamond` — Third-Man Runs in a Diamond | 1 | 3 arrows (2 passes), 1 ball |
| `two-touch-passing-squares` — Two-Touch Passing Squares | 1 | 3 arrows (3 passes), 1 ball |
| `through-around-or-over` — Through, Around or Over | 1 | 2 arrows (2 passes), 1 ball |
| `corner-gates-possession` — Corner Gates Possession | 1 | 2 arrows (2 passes), 1 ball |
| `name-your-route` — Name Your Route | 1 | 2 arrows (2 passes), 1 ball |
| `two-ways-across` — Two Ways Across | 1 | 2 arrows (2 passes), 1 ball |

---

After editing a diagram, `npm run motion:check` fails on the changed
fingerprint. Re-run `npm run motion:derive` to pick up the new arrows, then
`npm run motion:narrate -- --only <slug>` for the new beat.
## If a video feels thin

The number of beats is the number of arrows. `traffic-lights` is the clearest
example: the drill is about a coach calling green, amber and red, but the diagram
draws two dribble arrows, so the video has two beats and undersells it.

The fix is to draw more arrows in the diagram, not to hand-author motion
separately. That keeps one source of truth, and it improves the drill page at the
same time — which is the whole reason motion is derived rather than authored.
