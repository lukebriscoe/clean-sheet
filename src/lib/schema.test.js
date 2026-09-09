import { describe, it, expect } from 'vitest'
import { isVideoId, parseVideoId, emptyDrill, validateDrill, blockFromDrill } from './schema.js'

// A real-shaped YouTube id: 11 chars of [A-Za-z0-9_-].
const ID = 'dQw4w9WgXcQ'

describe('isVideoId', () => {
  it('accepts a well-formed id', () => {
    expect(isVideoId(ID)).toBe(true)
    expect(isVideoId('_-aA09zZ_-x')).toBe(true)
  })

  it('accepts an id with surrounding whitespace', () => {
    expect(isVideoId(`  ${ID}\n`)).toBe(true)
  })

  it('rejects the wrong length', () => {
    expect(isVideoId('short')).toBe(false)
    expect(isVideoId(`${ID}X`)).toBe(false)
    expect(isVideoId('')).toBe(false)
  })

  it('rejects non-strings', () => {
    for (const value of [null, undefined, 0, 12345678901, {}, [], true]) {
      expect(isVideoId(value)).toBe(false)
    }
  })

  // A snapshot's videoId is anonymous input — firestore.rules validates drill
  // documents field by field but never looks inside a session's blocks. These
  // are the cases that matter, because the value reaches an iframe src.
  describe('hostile input', () => {
    const attacks = [
      'javascript:', // scheme injection
      '"></iframe>', // markup break-out
      '../../../etc', // traversal
      'a"onload="x', // attribute break-out
      "'+alert(1)+'", // expression injection
      'https://evil', // a URL rather than an id
      'aaaaaaaaaa a', // embedded space
      'aaaaaaaaaa\n', // embedded newline (11 chars + newline)
      'aaaa/aaaaaa', // a slash would change the embed path
      'aaaa.aaaaaa', // a dot would change the host
      'aaaa?aaaaaa', // a query would add parameters
      'aaaa#aaaaaa', // a fragment
      'aaaa&aaaaaa', // a second parameter
      'aaaa%aaaaaa', // percent-encoding
    ]

    for (const attack of attacks) {
      it(`rejects ${JSON.stringify(attack)}`, () => expect(isVideoId(attack)).toBe(false))
    }
  })
})

describe('parseVideoId', () => {
  // The realistic input is a URL copied out of YouTube Studio, in whichever
  // shape the browser happened to give.
  const links = [
    ['a bare id', ID],
    ['a share link', `https://youtu.be/${ID}`],
    ['a share link with tracking', `https://youtu.be/${ID}?si=AbCdEf`],
    ['a watch URL', `https://www.youtube.com/watch?v=${ID}`],
    ['a watch URL with a timestamp', `https://www.youtube.com/watch?v=${ID}&t=42s`],
    ['a shorts URL', `https://youtube.com/shorts/${ID}`],
    ['a mobile URL', `https://m.youtube.com/watch?v=${ID}`],
    ['an embed URL', `https://www.youtube-nocookie.com/embed/${ID}`],
    ['surrounding whitespace', `  ${ID}\n`],
  ]

  for (const [what, input] of links) {
    it(`reads ${what}`, () => expect(parseVideoId(input)).toBe(ID))
  }

  const rejected = [
    ['another video host', 'https://vimeo.com/123456789'],
    ['a scheme that is not http', 'javascript:alert(1)'],
    ['a lookalike host', 'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ'],
    ['a channel URL', 'https://www.youtube.com/@someone'],
    ['plain nonsense', 'not-an-id'],
    ['nothing at all', ''],
    ['null', null],
  ]

  for (const [what, input] of rejected) {
    it(`refuses ${what}`, () => expect(parseVideoId(input)).toBeNull())
  }
})

describe('videoId on a drill', () => {
  // A drill that passes validation on its own, so a failure below is about
  // videoId and nothing else.
  const base = {
    ...emptyDrill(),
    name: 'Traffic Lights',
    summary: 'A warm-up where colours tell players to stop, go, or turn.',
    description: 'Every player has a ball inside the grid.',
    themes: ['dribbling'],
    ageGroups: ['u8'],
    coachingPoints: ['Head up between touches'],
  }

  it('is a valid fixture to begin with', () => {
    expect(validateDrill(base).errors).toEqual({})
  })

  it('starts empty on a blank drill', () => {
    expect(emptyDrill().videoId).toBeNull()
  })

  // Videos are ours — written, choreographed and published by us for the seed
  // library. validateDrill is the community/AI submission path, so it must never
  // let a videoId through, however well-formed. Otherwise anyone could attach
  // any YouTube video to any drill on the site.
  it('is stripped from a submission even when perfectly well-formed', () => {
    expect(validateDrill({ ...base, videoId: ID }).values.videoId).toBeNull()
  })

  it('is stripped when malformed, without rejecting the submission', () => {
    const result = validateDrill({ ...base, videoId: '"><script>' })
    expect(result.values.videoId).toBeNull()
    expect(result.errors).toEqual({})
  })

  it('never produces a seed drill, so a video could never ride along', () => {
    expect(validateDrill({ ...base, source: 'seed' }).values.source).not.toBe('seed')
  })

  it('is carried into a session block snapshot', () => {
    expect(blockFromDrill({ ...base, videoId: ID }).drillSnapshot.videoId).toBe(ID)
  })

  it('does not carry a malformed id into a snapshot', () => {
    expect(blockFromDrill({ ...base, videoId: 'nope' }).drillSnapshot.videoId).toBeNull()
  })
})
