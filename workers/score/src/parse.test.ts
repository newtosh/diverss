import { describe, expect, it } from 'vitest'
import { inferDateFromPermalink, parseFeed } from './parse'
import { scoreParsedFeed } from './score'

describe('inferDateFromPermalink', () => {
  it('parses /YYYY/MM/DD/ paths', () => {
    const d = inferDateFromPermalink(
      'https://toucharcade.com/2025/04/18/a-two-parter-the-toucharcade-show-613/',
    )
    expect(d?.toISOString().slice(0, 10)).toBe('2025-04-18')
  })

  it('rejects invalid calendar days', () => {
    expect(inferDateFromPermalink('https://ex.com/2025/02/31/x/')).toBeNull()
  })
})

describe('undated / permalink scoring', () => {
  it('marks feeds with no dates as stale', () => {
    const feed = parseFeed(`<?xml version="1.0"?>
      <rss version="2.0"><channel><title>U</title>
        <item><title>a</title><description>x</description></item>
      </channel></rss>`)
    const r = scoreParsedFeed('https://ex.com/rss', feed, new Date('2026-08-24T12:00:00Z'))
    expect(r.health).toBe('stale')
    expect(r.velocityUnknown).toBe(true)
    expect(r.detail).toMatch(/No publish dates/i)
  })

  it('infers stale from old permalink dates', () => {
    const feed = parseFeed(`<?xml version="1.0"?>
      <rss version="2.0"><channel><title>TA</title>
        <item>
          <title>Show</title>
          <link>https://toucharcade.com/2025/04/18/show-613/</link>
          <description>x</description>
        </item>
      </channel></rss>`)
    const r = scoreParsedFeed(
      'https://toucharcade.com/rss',
      feed,
      new Date('2026-08-24T12:00:00Z'),
    )
    expect(r.health).toBe('stale')
    expect(r.lastDatedAt?.slice(0, 10)).toBe('2025-04-18')
    expect(r.velocityUnknown).toBe(false)
  })
})
