#!/usr/bin/env node
// Appends a batch of drills to data/seed-drills.json.
//
//   node scripts/add-drills-batch2.mjs
//
// Every entry here is written from scratch. Where an activity was suggested by
// something published elsewhere, only the underlying practice is taken — never
// the wording, the coaching points, the naming, or the session grouping, which
// are the parts that belong to whoever wrote them. See docs/content-policy.md.
//
// Idempotent: skips any drill whose name already exists.

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const SEED = resolve(dirname(fileURLToPath(import.meta.url)), '../data/seed-drills.json')

const A = (x, y, l) => ({ t: 'player', team: 'a', x, y, ...(l ? { label: l } : {}) })
const B = (x, y, l) => ({ t: 'player', team: 'b', x, y, ...(l ? { label: l } : {}) })
const N = (x, y, l) => ({ t: 'player', team: 'n', x, y, ...(l ? { label: l } : {}) })
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

const DRILLS = [
  {
    name: 'Tag and Rescue',
    summary: 'A tag game where a caught player freezes until a team-mate leaps over to free them.',
    description:
      "Everyone moves around the grid. Two or three taggers try to touch the others on the shoulder or back. Anyone tagged crouches down and stays there until a team-mate runs over and leap-frogs them, which puts them straight back in.\n\nTwo of the runners carry a ball in their hands, and whoever is holding one cannot be tagged. That turns it from a running game into a **looking** game — the ball is protection, so players have to spot who is about to get caught and throw it to them.\n\nRun it in bursts of two or three minutes and swap the taggers each time.",
    setup:
      'A 20x20 yard grid. Two balls, carried in the hands to start with. Pick two or three taggers for a group of ten.',
    coachingPoints: [
      'Look for the player in trouble, not just the space in front of you',
      'Shout before you throw so they know it is coming',
      'Taggers: pick one target and commit rather than drifting between two',
      'Free a team-mate as soon as you see them down — nobody stays out long',
    ],
    progressions: [
      'Pass the ball with your feet instead of throwing it',
      'Add a third tagger',
      'Shrink the grid so there is less space to run into',
    ],
    regressions: ['Make the grid bigger', 'Add a third protecting ball'],
    themes: ['physical', 'funandconfidence', 'movement'],
    ageGroups: ['u8', 'u9', 'u10', 'u11', 'u12'],
    sessionPhase: 'warmup',
    minPlayers: 8,
    maxPlayers: 16,
    durationMins: 10,
    intensity: 'high',
    equipment: ['balls', 'cones', 'bibs'],
    diagram: {
      area: area(20, 20),
      caption: 'Two balls in play; holding one makes you safe.',
      shapes: [
        A(20, 22), ball(26, 26), A(58, 18), A(80, 34), A(30, 58),
        A(66, 62), ball(72, 66), A(46, 84), A(84, 78),
        B(42, 34), B(60, 74),
        pass([26, 26], [56, 20]),
        run([42, 38], [52, 76]),
      ],
    },
  },

  {
    name: 'Two-Goal 1v1',
    summary: 'Receive under pressure, turn out, and pick which of two goals to attack.',
    description:
      "A long, narrow area with a goal and a keeper at each end. Two queues work at the same time from opposite sides.\n\nA player passes in to a receiver standing by the middle cone, then immediately closes them down. The receiver has to take a positive first touch away from the pressure and then decide which goal to go at. If the defender wins it, they attack the other goal.\n\nThe defender becomes the next attacker, the attacker rejoins the queue, and it runs continuously.",
    setup:
      'About 30 x 15 yards, a goal and keeper at each end, a cone in the middle to receive beside. Split the group into two queues on opposite touchlines.',
    coachingPoints: [
      'First touch decides the whole thing — take it away from the presser, not under your feet',
      'Know which goal is emptier before the ball reaches you',
      'Passer: pass it firmly, then press properly — a soft press teaches nothing',
      'Defender: if you win it, go immediately; the other goal is unguarded for about two seconds',
    ],
    progressions: [
      'The attacker must beat the defender twice — turn back and score in the other goal',
      'Presser starts a yard closer, so there is less time on the first touch',
    ],
    regressions: [
      'Widen the area so the receiver has more room to turn',
      'Presser starts passive and only becomes live after the first touch',
    ],
    themes: ['receiving', 'dribbling', 'transition', 'shooting'],
    ageGroups: ['u10', 'u11', 'u12', 'u13', 'u14plus'],
    sessionPhase: 'technical',
    minPlayers: 6,
    maxPlayers: 14,
    durationMins: 18,
    intensity: 'high',
    equipment: ['balls', 'cones', 'bibs', 'goals'],
    diagram: {
      area: area(30, 15),
      caption: 'Receive by the middle cone, then attack either goal.',
      shapes: [
        goal(6, 50, 'left'), goal(94, 50, 'right'),
        N(20, 50, 'GK'), N(80, 50, 'GK'),
        cone(50, 50),
        A(50, 38), ball(50, 30),
        B(50, 16),
        A(30, 84), A(70, 84),
        pass([50, 24], [50, 34]),
        run([50, 22], [50, 32]),
        dribble([44, 42], [22, 50]),
      ],
    },
  },

  {
    name: 'Target Player Game',
    summary: 'Small-sided game where finding the target player in the end zone doubles the goal.',
    description:
      "A game with a goal and keeper at each end and a marked end zone in front of each goal. One player from each team starts as the target inside the opposition end zone; everyone else plays a three-a-side in the middle.\n\nA goal scored straight from the middle is worth one. A goal that goes through the target player is worth two — either the target turns and finishes, or the player who fed them runs in, gets it back and finishes first time.\n\nThe doubled score does the coaching for you. Nobody has to be told to look forward.",
    setup:
      'Roughly 40 x 25 yards, goals and keepers at each end, an end zone about 5 yards deep at each end. Bibs for one team.',
    coachingPoints: [
      'Can you play forward? Look there first, sideways second',
      'Target: come off the back defender so the pass has somewhere to arrive',
      'Feed the target and keep running — the return is where the goal comes from',
      'Weight it so they can turn, not so they have to control it twice',
    ],
    progressions: [
      'Allow one defender into the end zone to mark the target',
      'Passes into the target must be first time',
    ],
    regressions: [
      'Make the middle area bigger',
      'Two targets per team so there is always one free',
    ],
    themes: ['passing', 'movement', 'possession', 'shooting'],
    ageGroups: ['u10', 'u11', 'u12', 'u13', 'u14plus'],
    sessionPhase: 'ssg',
    minPlayers: 8,
    maxPlayers: 14,
    durationMins: 20,
    intensity: 'high',
    equipment: ['balls', 'cones', 'bibs', 'goals'],
    diagram: {
      area: area(40, 25),
      caption: 'Score through the target in the end zone and it counts double.',
      shapes: [
        goal(50, 4), goal(50, 96, 'down'),
        N(50, 24, 'GK'), N(50, 76, 'GK'),
        zone(0, 14, 100, 10, 'END ZONE'), zone(0, 76, 100, 10, 'END ZONE'),
        A(30, 46), A(58, 42), A(44, 62), A(34, 18, 'T'),
        B(42, 52), B(66, 58), B(28, 66), B(66, 82, 'T'),
        ball(34, 48),
        pass([34, 48], [34, 24]),
        run([56, 44], [46, 28]),
      ],
    },
  },

  {
    name: 'Crossing the Grid',
    summary: 'Ball each, travel across the grid using a different move every time.',
    description:
      "Split a square down the middle so there are two halves. Every player has a ball. They travel across one half in one direction, working a move as they go, then come back across the other half in the opposite direction.\n\nBecause everyone is moving through the same space at once, it is busy — players have to keep their heads up and use both feet without being told to.\n\nYou can start it with no balls at all, just moving across in as many different ways as they can find, then add the ball once they are warm.",
    setup: 'A 20x20 yard square split into two halves. One ball per player.',
    coachingPoints: [
      'Both feet, every crossing',
      'Look up between touches — the traffic is the point',
      'Change the move each time rather than repeating your favourite',
      'Small touches in the crowd, longer ones when it opens up',
    ],
    progressions: [
      'Put a defender in each half to evade',
      'Call a specific move for each crossing',
      'Race: how many clean crossings in ninety seconds',
    ],
    regressions: [
      'No ball at all — just movement patterns across the grid',
      'Bigger halves so there is less traffic',
    ],
    themes: ['dribbling', 'physical', 'movement'],
    ageGroups: ['u8', 'u9', 'u10', 'u11', 'u12', 'u13'],
    sessionPhase: 'warmup',
    minPlayers: 6,
    maxPlayers: 20,
    durationMins: 10,
    intensity: 'medium',
    equipment: ['balls', 'cones'],
    diagram: {
      area: area(20, 20),
      caption: 'Across one half, back through the other.',
      shapes: [
        zone(0, 0, 48, 100), zone(52, 0, 48, 100),
        A(14, 20), ball(20, 24), A(16, 58), ball(22, 62), A(12, 84),
        A(70, 30), ball(76, 34), A(78, 66), ball(84, 70), A(66, 88),
        dribble([20, 24], [40, 26]),
        dribble([76, 70], [58, 66]),
      ],
    },
  },

  {
    name: 'Outside-In Possession',
    summary: 'Four players on the edge with a ball each, four inside working to receive.',
    description:
      "Four players stand around the outside of a square, each with a ball. Four more work inside without one.\n\nAn inside player moves to show for a ball, receives from whichever outside player they have made an angle with, and plays it back out to a **different** outside player. Then they move and do it again.\n\nEverybody is busy at once — there is no queue, and no waiting for one ball to come round. Insist on the ball going back out to a different player, otherwise they stop scanning and just bounce it back where it came from.",
    setup:
      'A 20x20 yard square. Four players on the edges with a ball each, four inside. Swap over every two minutes.',
    coachingPoints: [
      'Check away before you come to show — nobody receives standing still',
      'Look over your shoulder before it arrives so you already know where it is going',
      'Open your body so both sides of the square are available',
      'Play it out to someone different from the one who fed you',
    ],
    progressions: [
      'Add a defender inside to press whoever is receiving',
      'Two touches maximum inside',
      'Inside players must turn and play out the far side',
    ],
    regressions: [
      'Outside players throw and the inside player heads or volleys back',
      'Shrink to three outside and two inside so the picture is simpler',
    ],
    themes: ['receiving', 'passing', 'possession'],
    ageGroups: ['u10', 'u11', 'u12', 'u13', 'u14plus'],
    sessionPhase: 'technical',
    minPlayers: 8,
    maxPlayers: 16,
    durationMins: 15,
    intensity: 'medium',
    equipment: ['balls', 'cones'],
    diagram: {
      area: area(20, 20),
      caption: 'Receive from one side, play out to a different one.',
      shapes: [
        cone(4, 4), cone(96, 4), cone(4, 96), cone(96, 96),
        A(50, 4), A(96, 50), A(50, 96), A(4, 50),
        ball(50, 12), ball(88, 50), ball(50, 88), ball(12, 50),
        B(34, 34), B(66, 38), B(38, 68), B(70, 66),
        pass([50, 12], [34, 30]),
        pass([38, 38], [88, 48]),
        run([66, 38], [56, 56]),
      ],
    },
  },

  {
    name: 'Forward Only',
    summary: 'A normal small-sided game with one rule: you cannot pass backwards.',
    description:
      "Play a straight small-sided game with goals and keepers, with one condition — every pass must go forwards or square. No backwards passes at all.\n\nIt sounds restrictive and it is, deliberately. Players who normally solve everything by turning and passing back have to find another answer, which usually means moving *before* the ball arrives so there is a forward option to hit.\n\nExpect it to be scrappy for a few minutes. Let that happen. The bit worth waiting for is when they start running past the ball instead of standing still asking for it.",
    setup: 'A 40 x 30 pitch, goal and keeper at each end, bibs for one team.',
    coachingPoints: [
      'Get ahead of the ball early — if nobody is forward there is no pass',
      'Carry it forward yourself when the pass is not on',
      'Angles, not straight lines: give them something to hit past the defender',
      'Receiving player, open up so forward is the first thing you can see',
    ],
    progressions: [
      'The first touch must also go forwards',
      'Backwards passing allowed in your own half only',
    ],
    regressions: [
      'Square passes count as forwards',
      'Free play in your own half, forward-only in the attacking half',
    ],
    themes: ['passing', 'movement', 'transition'],
    ageGroups: ['u10', 'u11', 'u12', 'u13', 'u14plus'],
    sessionPhase: 'ssg',
    minPlayers: 8,
    maxPlayers: 14,
    durationMins: 18,
    intensity: 'high',
    equipment: ['balls', 'cones', 'bibs', 'goals'],
    diagram: {
      area: area(40, 30),
      caption: 'Every pass forwards or square — never back.',
      shapes: [
        goal(50, 4), goal(50, 96, 'down'),
        N(50, 22, 'GK'), N(50, 78, 'GK'),
        A(28, 62), A(56, 54), A(44, 36), A(74, 44),
        B(36, 46), B(64, 34), B(26, 30), B(58, 70),
        ball(32, 62),
        pass([32, 62], [52, 40]),
        run([74, 44], [70, 24]),
      ],
    },
  },

  {
    name: 'Through, Around or Over',
    summary: 'Switch the ball end to end by playing through, around, or over a blocked middle.',
    description:
      "Target players stand in a gate at each end of a rectangle. Four players work inside, with two mannequins or poles standing in as a midfield they cannot pass through easily.\n\nThe job is to get the ball from one target to the other. There are only three ways to do it: **through** the gap between the obstacles, **around** the outside, or **over** the top. Whoever plays the successful pass into the target swaps in and becomes the new target.\n\nNaming the three routes out loud is what makes this stick. Players start announcing which one they are going for, which means they are choosing rather than hoping.",
    setup:
      'A rectangle sized to the group — long enough that "over" is a real option. Two poles or mannequins across the middle, a gate at each end with a target player inside.',
    coachingPoints: [
      'Look at the obstacle before you look at the target — the route decides the pass',
      'Through needs weight and accuracy; over needs height and a soft landing',
      'Move the ball sideways first to change the angle, then go',
      'Target: show on the side that opens the next pass',
    ],
    progressions: [
      'Count how many successful switches in ninety seconds and beat it',
      'Add a live defender who can block the through-ball',
      'Each route scores differently: through 3, around 1, over 2',
    ],
    regressions: [
      'Take the mannequins out and just switch end to end',
      'Shorten the rectangle so the passes are shorter',
    ],
    themes: ['passing', 'possession', 'movement'],
    ageGroups: ['u11', 'u12', 'u13', 'u14plus'],
    sessionPhase: 'technical',
    minPlayers: 6,
    maxPlayers: 14,
    durationMins: 18,
    intensity: 'medium',
    equipment: ['balls', 'cones', 'poles'],
    diagram: {
      area: area(30, 20),
      caption: 'Three routes end to end: through, around, over.',
      shapes: [
        gate(50, 6), gate(50, 94),
        A(50, 18, 'T'), A(50, 82, 'T'),
        cone(38, 50), cone(62, 50),
        A(20, 40), A(80, 40), A(22, 62), A(78, 62),
        ball(58, 84),
        pass([54, 80], [50, 26]),
        pass([46, 80], [20, 46]),
        text(14, 26, 'around'), text(66, 26, 'through'),
      ],
    },
  },

  {
    name: 'Corner Gates Possession',
    summary: 'Four v four, scoring by finding a target player standing in a corner gate.',
    description:
      "A square with a gate marked in two opposite corners, each holding a target player. Inside is a four-a-side.\n\nThe team in possession scores by playing into either of their target players. Whoever plays that pass swaps places with the target, and possession turns over to the other team straight away.\n\nTwo corners rather than one end means there is always a switch available, so the team defending cannot just squeeze one side. It also means the answer is usually to move the ball across before going forward.",
    setup:
      'A 25x25 yard square. A cone gate in two opposite corners with a target player inside each. Bibs for one team.',
    coachingPoints: [
      'If one corner is crowded, the other one is free — switch it',
      'Target: move within your gate to open a line',
      'Play the pass you can see now, not the one you want in two seconds',
      'Defending team: protect the corners first, chase the ball second',
    ],
    progressions: [
      'Score different points depending on how the target was found',
      'Two touches maximum',
      'Add a floating player who always plays for whoever has the ball',
    ],
    regressions: [
      'Bigger square',
      'Widen the gates so the target is easier to find',
    ],
    themes: ['possession', 'passing', 'movement'],
    ageGroups: ['u11', 'u12', 'u13', 'u14plus'],
    sessionPhase: 'ssg',
    minPlayers: 8,
    maxPlayers: 14,
    durationMins: 18,
    intensity: 'high',
    equipment: ['balls', 'cones', 'bibs'],
    diagram: {
      area: area(25, 25),
      caption: 'Two corner gates — if one is shut, switch to the other.',
      shapes: [
        gate(8, 8, 45), gate(92, 92, 45),
        A(20, 18, 'T'), A(80, 82, 'T'),
        A(34, 44), A(58, 32), A(46, 70),
        B(44, 40), B(66, 56), B(28, 62),
        ball(38, 46),
        pass([38, 46], [24, 24]),
        pass([54, 34], [76, 78]),
      ],
    },
  },

  {
    name: 'Name Your Route',
    summary: 'A game where you have to say how you got through: around, over, or straight through.',
    description:
      "A normal game with goals at each end, and a box marked out across the middle of the pitch. The attacking team has to get past that box one of three ways: **through** it, **around** the outside of it, or **over** the top.\n\nWhen a team scores, they have to shout which route they used for the goal to count. Anyone who cannot say gets nothing.\n\nThat sounds like a gimmick and it partly is, but it makes them notice the decision they just made. After a few goals you hear players calling the route *before* they play the pass, which is the whole point.",
    setup:
      'A 40 x 30 pitch with goals at each end. Mark a box across the middle third with cones or poles. Even teams, bibs for one side.',
    coachingPoints: [
      'Decide the route before you receive, not after',
      'Around is safest, through is quickest, over is the one nobody expects',
      'If they block one route, the other two open up — look again',
      'Say it out loud; if you cannot name it, you did not choose it',
    ],
    progressions: [
      'Different points per route so the harder ones are worth more',
      'First team to score using all three routes wins',
    ],
    regressions: [
      'Two floating players to create an overload',
      'Remove the shouting and just play through, around and over freely',
    ],
    themes: ['possession', 'passing', 'transition', 'movement'],
    ageGroups: ['u11', 'u12', 'u13', 'u14plus'],
    sessionPhase: 'phase-of-play',
    minPlayers: 10,
    maxPlayers: 16,
    durationMins: 20,
    intensity: 'high',
    equipment: ['balls', 'cones', 'bibs', 'goals', 'poles'],
    diagram: {
      area: area(40, 30),
      caption: 'Past the middle box one of three ways — and name it.',
      shapes: [
        goal(50, 4), goal(50, 96, 'down'),
        zone(14, 40, 72, 20, 'THE BOX'),
        A(30, 74), A(58, 68), A(46, 86), A(76, 76),
        B(34, 30), B(62, 26), B(50, 50), B(22, 46),
        ball(34, 74),
        pass([34, 74], [30, 34]),
        pass([60, 68], [64, 30]),
        text(88, 50, 'around'),
      ],
    },
  },
]

const seed = JSON.parse(await readFile(SEED, 'utf8'))
const existing = new Set(seed.drills.map(d => d.name))
const added = []
for (const drill of DRILLS) {
  if (existing.has(drill.name)) continue
  seed.drills.push(drill)
  added.push(drill.name)
}
await writeFile(SEED, `${JSON.stringify(seed, null, 2)}\n`, 'utf8')
console.log(`✓ Added ${added.length} drills (library now ${seed.drills.length}):`)
for (const n of added) console.log(`  · ${n}`)
