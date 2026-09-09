#!/usr/bin/env node
// One-off authoring script: attaches hand-drawn diagrams to the seed drills.
//
// Kept as a script rather than hand-editing data/seed-drills.json because the
// diagrams are easier to read and adjust as compact literals than as JSON nested
// four levels deep. Re-running is safe — it overwrites the `diagram` field on any
// drill named below and leaves the rest of the entry alone.
//
//   node scripts/add-seed-diagrams.mjs
//
// Coordinates are 0–100 on both axes, y increasing downwards. The renderer scales
// positions to the area's aspect ratio, so author as if the box were square.

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const SEED_FILE = resolve(HERE, '../data/seed-drills.json')

// -- tiny builders, so the diagrams below read like what they draw --------------
const A = (x, y, label) => ({ t: 'player', team: 'a', x, y, ...(label ? { label } : {}) })
const B = (x, y, label) => ({ t: 'player', team: 'b', x, y, ...(label ? { label } : {}) })
const N = (x, y, label) => ({ t: 'player', team: 'n', x, y, ...(label ? { label } : {}) })
const cone = (x, y) => ({ t: 'cone', x, y })
const ball = (x, y) => ({ t: 'ball', x, y })
const goal = (x, y, facing = 'up') => ({ t: 'goal', x, y, facing })
const gate = (x, y, angle = 0) => ({ t: 'gate', x, y, angle })
const zone = (x, y, w, h, label) => ({ t: 'zone', x, y, w, h, ...(label ? { label } : {}) })
const pass = (from, to) => ({ t: 'pass', from, to })
const run = (from, to) => ({ t: 'run', from, to })
const dribble = (from, to) => ({ t: 'dribble', from, to })
const text = (x, y, t) => ({ t: 'label', x, y, text: t })

const area = (w, h, unit = 'yd') => ({ w, h, unit })

const DIAGRAMS = {
  'Traffic Lights': {
    area: area(20, 20),
    caption: 'Everyone has a ball; the coach calls a colour.',
    shapes: [
      A(20, 22), ball(25, 26), A(62, 18), ball(67, 22),
      A(35, 55), ball(40, 59), A(78, 48), ball(83, 52),
      A(18, 80), ball(23, 84), A(58, 76), ball(63, 80),
      dribble([25, 26], [45, 38]),
      dribble([67, 22], [80, 34]),
    ],
  },

  'Passing Gates': {
    area: area(25, 25),
    caption: 'Pairs score a point for every clean pass through any gate.',
    shapes: [
      gate(30, 20), gate(70, 30, 90), gate(22, 60, 45),
      gate(60, 72), gate(85, 55, 90),
      A(18, 22), A(46, 20), ball(23, 24),
      A(48, 62), A(80, 70), ball(53, 64),
      pass([23, 24], [42, 20]),
      pass([53, 64], [57, 72]),
    ],
  },

  'Bulldog': {
    area: area(20, 25),
    caption: 'Runners dribble across; bulldogs try to win the balls.',
    shapes: [
      zone(0, 0, 100, 14, 'START'), zone(0, 86, 100, 14, 'SAFE'),
      A(15, 7), ball(15, 12), A(38, 7), ball(38, 12),
      A(62, 7), ball(62, 12), A(85, 7), ball(85, 12),
      B(35, 48), B(70, 52),
      dribble([15, 14], [12, 84]),
      dribble([62, 14], [72, 84]),
    ],
  },

  'Pass and Follow Triangle': {
    area: area(12, 12),
    caption: 'Pass, then follow your pass to the next cone.',
    shapes: [
      cone(50, 12), cone(15, 82), cone(85, 82),
      A(50, 22), A(18, 74), A(82, 74), ball(50, 28),
      pass([50, 26], [22, 70]),
      run([56, 24], [80, 68]),
      pass([20, 80], [78, 80]),
    ],
  },

  'Ball Mastery Grid': {
    area: area(15, 15),
    caption: 'One small square each; move to a new one between moves.',
    shapes: [
      zone(8, 12, 24, 26), zone(40, 12, 24, 26), zone(72, 12, 24, 26),
      zone(8, 55, 24, 26), zone(40, 55, 24, 26), zone(72, 55, 24, 26),
      A(20, 25), ball(24, 29), A(52, 25), ball(56, 29), A(84, 25), ball(88, 29),
      A(20, 68), ball(24, 72), A(52, 68), ball(56, 72),
      run([52, 68], [84, 68]),
    ],
  },

  'Rondo 4v1': {
    area: area(10, 10),
    caption: 'Four on the edges, one defender inside.',
    shapes: [
      cone(6, 6), cone(94, 6), cone(6, 94), cone(94, 94),
      A(50, 8), A(92, 50), A(50, 92), A(8, 50),
      B(50, 50),
      ball(50, 14),
      pass([50, 14], [86, 48]),
      pass([90, 56], [54, 88]),
    ],
  },

  'Third-Man Runs in a Diamond': {
    area: area(14, 14),
    caption: 'Base to side, set, then in behind to the third man.',
    shapes: [
      A(50, 88, '1'), A(14, 50, '2'), A(86, 50), A(50, 12, '3'),
      ball(50, 82),
      pass([48, 82], [18, 56]),
      pass([16, 44], [46, 20]),
      run([62, 30], [54, 14]),
      text(74, 78, '3rd man'),
    ],
  },

  'Two-Touch Passing Squares': {
    area: area(12, 12),
    caption: 'One touch to control, one to pass, round the square.',
    shapes: [
      cone(8, 8), cone(92, 8), cone(92, 92), cone(8, 92),
      A(12, 12), A(88, 12), A(88, 88), A(12, 88),
      ball(20, 12),
      pass([20, 12], [80, 12]),
      pass([90, 20], [90, 80]),
      pass([80, 90], [22, 90]),
    ],
  },

  'First Touch Turn Gates': {
    area: area(18, 16),
    caption: 'Receive with your back to the gates, turn, and go through one.',
    shapes: [
      gate(20, 10), gate(50, 10), gate(80, 10),
      A(50, 48), B(50, 62, 'S'),
      ball(50, 70),
      pass([50, 68], [50, 54]),
      dribble([46, 44], [22, 16]),
      text(50, 88, 'server'),
    ],
  },

  '1v1 Gate Duels': {
    area: area(15, 12),
    caption: 'Three gates to attack — the defender cannot cover them all.',
    shapes: [
      gate(18, 8), gate(50, 8), gate(82, 8),
      B(50, 40),
      A(50, 80), ball(50, 88),
      dribble([46, 78], [20, 14]),
      run([54, 40], [30, 22]),
    ],
  },

  'Beat the Defender Channels': {
    area: area(24, 20),
    caption: 'Narrow channels — nowhere to run around the problem.',
    shapes: [
      zone(4, 6, 26, 88), zone(37, 6, 26, 88), zone(70, 6, 26, 88),
      A(17, 78), ball(17, 86), B(17, 40),
      A(50, 78), ball(50, 86), B(50, 40),
      A(83, 78), ball(83, 86), B(83, 40),
      dribble([17, 74], [17, 12]),
    ],
  },

  'Shooting Ladder': {
    area: area(30, 24),
    caption: 'Three stations — the technique changes with the distance.',
    shapes: [
      goal(50, 6), N(50, 24, 'GK'),
      cone(36, 42), A(50, 42), ball(50, 50),
      cone(36, 64), A(50, 64), ball(50, 72),
      cone(36, 88), A(50, 88),
      pass([50, 46], [50, 16]),
      text(78, 42, '6 yd'), text(78, 64, '14 yd'), text(78, 88, '20 yd'),
    ],
  },

  'Cross and Finish Waves': {
    area: area(40, 30),
    caption: 'Near-post and far-post runs, timed to the delivery.',
    shapes: [
      goal(50, 6), N(50, 24, 'GK'),
      A(10, 40), ball(10, 46),
      A(46, 78), A(64, 84),
      dribble([10, 46], [14, 22]),
      pass([16, 20], [40, 22]),
      run([46, 74], [38, 26]),
      run([64, 80], [66, 30]),
    ],
  },

  'Press the Cone': {
    area: area(14, 12),
    caption: 'Fast for two-thirds, slow and side-on for the last third.',
    shapes: [
      cone(50, 22), ball(56, 24),
      B(50, 84),
      run([50, 78], [50, 46]),
      run([50, 44], [50, 32]),
      text(80, 60, 'fast'), text(80, 38, 'slow'),
    ],
  },

  'Goalkeeper Handling Circuit': {
    area: area(12, 10),
    caption: 'Low, mid-height, then diving — rotate through.',
    shapes: [
      goal(50, 10), N(50, 30, 'GK'),
      A(18, 82), A(50, 88), A(82, 82),
      pass([20, 76], [42, 36]),
      pass([50, 82], [50, 40]),
      pass([80, 76], [60, 34]),
    ],
  },

  'Y-Drill Combination': {
    area: area(24, 22),
    caption: 'Pass in, set back, spin off into the space behind.',
    shapes: [
      goal(50, 6), N(50, 16, 'GK'),
      A(50, 42, '2'), A(20, 62, '3'), A(50, 86, '1'),
      ball(50, 80),
      pass([50, 78], [50, 48]),
      pass([46, 44], [26, 58]),
      pass([22, 56], [46, 34]),
      run([56, 80], [56, 40]),
    ],
  },

  '4v4 Four-Goal Game': {
    area: area(30, 25),
    caption: 'Two goals each to attack — the pitch keeps stretching.',
    shapes: [
      goal(28, 5), goal(72, 5), goal(28, 95, 'down'), goal(72, 95, 'down'),
      A(30, 30), A(66, 26), A(24, 58), A(70, 62),
      B(46, 40), B(38, 72), B(76, 44), B(58, 80),
      ball(34, 32),
      pass([34, 32], [66, 30]),
      run([70, 62], [74, 24]),
    ],
  },

  '3v3 End Zone Game': {
    area: area(25, 20),
    caption: 'Control the ball in the end zone to score.',
    shapes: [
      zone(0, 0, 100, 12, 'END ZONE'), zone(0, 88, 100, 12, 'END ZONE'),
      A(28, 34), A(60, 26), A(46, 62),
      B(40, 44), B(70, 52), B(24, 70),
      ball(32, 36),
      pass([32, 36], [56, 30]),
      run([46, 62], [66, 14]),
    ],
  },

  '2v2 Continuous Duels': {
    area: area(35, 30),
    caption: 'Ball goes dead, next pair comes straight on.',
    shapes: [
      goal(50, 5), N(50, 21, 'GK'),
      A(38, 44), A(60, 40), ball(38, 50),
      B(44, 26), B(64, 24),
      A(10, 90), A(20, 90), A(80, 90), A(90, 90),
      dribble([38, 50], [42, 22]),
      run([60, 40], [66, 20]),
      text(50, 92, 'next pairs'),
    ],
  },

  'Overload 4v2 to Goal': {
    area: area(35, 28),
    caption: 'Two spare players — the coaching is finding them.',
    shapes: [
      goal(50, 5), N(50, 22, 'GK'),
      A(20, 52), A(44, 44), A(66, 48), A(84, 58),
      B(38, 28), B(62, 30),
      ball(24, 54),
      pass([26, 52], [60, 48]),
      pass([70, 44], [84, 36]),
      zone(0, 88, 100, 12, "DEFENDERS' TARGET"),
    ],
  },

  '5v5 Two-Touch Game': {
    area: area(40, 30),
    caption: 'Two touches maximum — decide before it arrives.',
    shapes: [
      goal(50, 4), goal(50, 96, 'down'),
      N(50, 21, 'GK'), N(50, 79, 'GK'),
      A(30, 34), A(62, 30), A(46, 52), A(76, 56),
      B(38, 46), B(66, 44), B(28, 66), B(58, 70),
      ball(34, 36),
      pass([34, 36], [58, 32]),
      pass([66, 28], [50, 16]),
    ],
  },

  'Score in Any Goal': {
    area: area(30, 30),
    caption: 'Four goals inside the area — look for the empty one.',
    shapes: [
      goal(26, 24), goal(74, 30), goal(30, 74), goal(76, 70),
      A(46, 46), A(18, 56), A(66, 52),
      B(38, 34), B(60, 66), B(84, 44),
      ball(48, 50),
      dribble([48, 50], [34, 70]),
    ],
  },

  'Playing Out From the Back 6v4': {
    area: area(40, 25),
    caption: 'Beat the press and get the ball over the line under control.',
    shapes: [
      goal(50, 4), N(50, 20, 'GK'), ball(59, 24),
      A(14, 42), A(34, 34), A(68, 34), A(88, 42), A(50, 64),
      B(30, 58), B(70, 58), B(50, 46), B(40, 26),
      pass([56, 26], [20, 40]),
      pass([18, 48], [46, 60]),
      zone(0, 88, 100, 12, 'TARGET LINE'),
    ],
  },

  'Defending the Middle Third': {
    area: area(40, 28),
    caption: 'Press the ball, everyone else shifts across together.',
    shapes: [
      goal(50, 4), N(50, 22, 'GK'),
      B(24, 40), B(42, 38), B(60, 38), B(78, 40),
      B(38, 58), B(62, 58),
      A(20, 74), A(44, 78), A(68, 76), A(88, 72),
      ball(22, 78),
      run([38, 58], [26, 70]),
      run([62, 58], [52, 60]),
      run([78, 40], [66, 44]),
    ],
  },

  'Attacking Wide Areas 7v5': {
    area: area(40, 32),
    caption: 'A goal from a wide delivery counts double.',
    shapes: [
      goal(50, 5), N(50, 22, 'GK'),
      zone(0, 20, 14, 76), zone(86, 20, 14, 76),
      A(7, 44), ball(7, 52), A(93, 50),
      A(38, 40), A(56, 36), A(70, 46), A(46, 66),
      B(40, 24), B(58, 26), B(30, 46), B(70, 30), B(50, 54),
      dribble([7, 52], [9, 24]),
      pass([12, 22], [44, 26]),
      run([46, 62], [50, 30]),
    ],
  },

  'Conditioned Match: Three Passes': {
    area: area(45, 30),
    caption: 'Three consecutive passes before a goal counts.',
    shapes: [
      goal(50, 4), goal(50, 96, 'down'),
      N(50, 23, 'GK'), N(50, 77, 'GK'),
      A(26, 40), A(50, 36), A(74, 42), A(38, 60), A(64, 62),
      B(34, 28), B(58, 26), B(46, 48), B(24, 66), B(72, 52),
      ball(31, 48),
      pass([32, 46], [50, 40]),
      pass([54, 34], [72, 44]),
      pass([74, 38], [52, 16]),
    ],
  },

  'Cool-Down Circle': {
    area: area(12, 12),
    caption: 'Everyone speaks — go round the circle rather than taking hands up.',
    shapes: [
      A(50, 12), A(78, 22), A(90, 50), A(78, 78),
      A(50, 88), A(22, 78), A(10, 50), A(22, 22),
      N(50, 50, 'C'),
    ],
  },
}

const seed = JSON.parse(await readFile(SEED_FILE, 'utf8'))
let attached = 0
const unmatched = new Set(Object.keys(DIAGRAMS))

for (const drill of seed.drills) {
  const diagram = DIAGRAMS[drill.name]
  if (!diagram) continue
  drill.diagram = diagram
  unmatched.delete(drill.name)
  attached += 1
}

if (unmatched.size) {
  console.error(`No drill matches these diagram keys: ${[...unmatched].join(', ')}`)
  process.exit(1)
}

await writeFile(SEED_FILE, `${JSON.stringify(seed, null, 2)}\n`, 'utf8')
console.log(
  `✓ Attached ${attached} diagrams to ${seed.drills.length} drills ` +
    `(${seed.drills.length - attached} intentionally have none).`,
)
