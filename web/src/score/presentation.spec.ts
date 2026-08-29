import { describe, expect, it } from 'vitest'
import {
  formatAbsoluteDate,
  formatFeedDate,
  healthPill,
  healthTooltip,
  isFetchBlocked,
  lastPostAgeLabel,
  matchesStaleAgeDays,
  matchesStaleAgeFilter,
  reasonLabel,
  rowWarningClass,
} from './presentation'
import type { ScoreResult } from './client'

function score(partial: Partial<ScoreResult> & Pick<ScoreResult, 'health' | 'reason'>): ScoreResult {
  return {
    schemaVersion: 1,
    xmlUrl: 'https://example.com/feed',
    velocityUnknown: true,
    scoredAt: '2026-08-24T00:00:00.000Z',
    ...partial,
  }
}

describe('rowWarningClass', () => {
  it('tints unhealthy and stale rows', () => {
    expect(rowWarningClass(score({ health: 'unhealthy', reason: 'http_status' }))).toContain(
      'border-l-gr-danger',
    )
    expect(
      rowWarningClass(score({ health: 'stale', reason: 'stale', velocityUnknown: false })),
    ).toContain('border-l-gr-gold')
    expect(
      rowWarningClass(
        score({ health: 'unhealthy', reason: 'http_status', detail: 'HTTP 403' }),
      ),
    ).toContain('border-l-gr-blocked')
  })

  it('leaves healthy and unscored untinted', () => {
    expect(rowWarningClass(undefined)).toBe('')
    expect(rowWarningClass(score({ health: 'ok', reason: 'ok', velocityUnknown: false }))).toBe('')
  })
})

describe('lastPostAgeLabel', () => {
  it('formats relative ages in plain language', () => {
    const now = Date.parse('2026-08-24T12:00:00Z')
    expect(lastPostAgeLabel('2026-08-24T10:00:00Z', now)).toBe('today')
    expect(lastPostAgeLabel('2026-08-10T12:00:00Z', now)).toBe('14 days ago')
    expect(lastPostAgeLabel('2025-08-24T12:00:00Z', now)).toBe('1 year ago')
    expect(lastPostAgeLabel('2026-04-18T12:00:00Z', now)).toBe('4 months ago')
    expect(lastPostAgeLabel('2024-08-24T12:00:00Z', now)).toBe('2 years ago')
  })
})

describe('matchesStaleAgeFilter', () => {
  const now = Date.parse('2026-08-24T12:00:00Z')

  it('keeps all when filter is all', () => {
    expect(matchesStaleAgeFilter(undefined, 'all', now)).toBe(true)
    expect(matchesStaleAgeFilter('2026-07-01T00:00:00Z', 'all', now)).toBe(true)
  })

  it('applies 3m / 6m / >1y thresholds', () => {
    expect(matchesStaleAgeFilter('2026-05-24T12:00:00Z', '3m', now)).toBe(true) // ~92d
    expect(matchesStaleAgeFilter('2026-06-24T12:00:00Z', '3m', now)).toBe(false) // ~61d
    expect(matchesStaleAgeFilter('2026-02-24T12:00:00Z', '6m', now)).toBe(true) // ~181d
    expect(matchesStaleAgeFilter('2026-04-24T12:00:00Z', '6m', now)).toBe(false)
    expect(matchesStaleAgeFilter('2025-08-23T12:00:00Z', '1y', now)).toBe(true) // 366d
    expect(matchesStaleAgeFilter('2025-08-25T12:00:00Z', '1y', now)).toBe(false) // 364d
  })

  it('excludes unknown dates from age thresholds', () => {
    expect(matchesStaleAgeFilter(undefined, '3m', now)).toBe(false)
  })
})

describe('matchesStaleAgeDays', () => {
  it('filters on precomputed day counts', () => {
    expect(matchesStaleAgeDays(212, 'all')).toBe(true)
    expect(matchesStaleAgeDays(212, '3m')).toBe(true)
    expect(matchesStaleAgeDays(212, '6m')).toBe(true)
    expect(matchesStaleAgeDays(212, '1y')).toBe(false)
    expect(matchesStaleAgeDays(400, '1y')).toBe(true)
    expect(matchesStaleAgeDays(null, '1y')).toBe(false)
    expect(matchesStaleAgeDays(undefined, '3m')).toBe(false)
  })
})

describe('formatFeedDate', () => {
  it('includes relative and absolute parts', () => {
    const now = Date.parse('2026-08-24T12:00:00Z')
    expect(formatFeedDate('2025-08-24T00:00:00Z', now)).toBe(
      '1 year ago · Aug 24, 2025',
    )
    expect(formatAbsoluteDate('2024-11-11T00:00:00Z')).toBe('Nov 11, 2024')
  })
})

describe('reasonLabel', () => {
  it('maps too_large and other codes to readable copy', () => {
    expect(reasonLabel('too_large')).toMatch(/larger than the size limit/i)
    expect(reasonLabel('unparseable')).toMatch(/not a readable/i)
    expect(reasonLabel('http_status', 'HTTP 404')).toBe('Feed URL returned HTTP 404')
    expect(reasonLabel('http_status', 'HTTP 403')).toMatch(/blocked fetching/i)
  })
})

describe('isFetchBlocked / healthPill blocked', () => {
  it('labels host blocks distinctly from dead feeds', () => {
    const blocked = score({
      health: 'unhealthy',
      reason: 'http_status',
      detail: 'HTTP 403',
    })
    expect(isFetchBlocked(blocked)).toBe(true)
    expect(healthPill(blocked).label).toBe('Blocked')
    expect(healthTooltip(blocked)).toMatch(/may still be fine/i)
    expect(
      isFetchBlocked(
        score({ health: 'unhealthy', reason: 'http_status', detail: 'HTTP 404' }),
      ),
    ).toBe(false)
  })
})

describe('healthTooltip', () => {
  it('uses readable copy for unhealthy and stale', () => {
    expect(
      healthTooltip(
        score({ health: 'unhealthy', reason: 'too_large' }),
      ),
    ).toMatch(/size limit/i)
    expect(
      healthTooltip(
        score({ health: 'unhealthy', reason: 'http_status', detail: 'HTTP 404' }),
      ),
    ).toBe('Feed URL returned HTTP 404')
    expect(
      healthTooltip(
        score({
          health: 'stale',
          reason: 'stale',
          lastDatedAt: '2025-08-24T00:00:00Z',
          velocityUnknown: false,
        }),
        Date.parse('2026-08-24T12:00:00Z'),
      ),
    ).toMatch(/Last dated post .*Aug 24, 2025/)
    expect(
      healthTooltip(
        score({ health: 'unhealthy', reason: 'manual', detail: 'Marked unhealthy by you' }),
      ),
    ).toBe('Marked unhealthy by you')
  })
})
