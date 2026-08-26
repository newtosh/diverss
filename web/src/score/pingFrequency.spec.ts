import { describe, expect, it } from 'vitest'
import { bandFor, pingBandClass, pingFrequencyFor, radarIcon } from './pingFrequency'
import type { ScoreResult } from './client'

function ok(partial: Partial<ScoreResult> = {}): ScoreResult {
  return {
    schemaVersion: 2,
    xmlUrl: 'https://example.com/feed',
    health: 'ok',
    reason: 'ok',
    velocityUnknown: false,
    posts1d: 0,
    posts7d: 2,
    posts30d: 9,
    scoredAt: '2026-08-24T00:00:00Z',
    ...partial,
  }
}

describe('pingFrequencyFor', () => {
  it('returns null for unhealthy or unknown cadence', () => {
    expect(
      pingFrequencyFor(
        { ...ok(), health: 'unhealthy', reason: 'timeout', velocityUnknown: true },
        '7d',
      ),
    ).toBeNull()
    expect(pingFrequencyFor(ok({ velocityUnknown: true }), '7d')).toBeNull()
  })

  it('changes with timeframe without needing new score fields', () => {
    const s = ok({ posts1d: 0, posts7d: 7, posts30d: 7, avgWords: 400 })
    const d7 = pingFrequencyFor(s, '7d')!
    const d1 = pingFrequencyFor(s, '1d')!
    expect(d7.score).toBeGreaterThan(d1.score)
  })
})

describe('bandFor', () => {
  it('uses success/info/warning/danger cutovers', () => {
    expect(bandFor(0)).toBe('success')
    expect(bandFor(24)).toBe('success')
    expect(bandFor(25)).toBe('info')
    expect(bandFor(49)).toBe('info')
    expect(bandFor(50)).toBe('warning')
    expect(bandFor(74)).toBe('warning')
    expect(bandFor(75)).toBe('danger')
    expect(bandFor(100)).toBe('danger')
  })
})

describe('radar presentation', () => {
  it('maps bands to semantic colors', () => {
    expect(pingBandClass('success')).toContain('emerald')
    expect(pingBandClass('info')).toContain('sky')
    expect(pingBandClass('warning')).toContain('amber')
    expect(pingBandClass('danger')).toContain('red')
    expect(radarIcon('danger')).toBe('tabler:alert-circle')
  })
})
