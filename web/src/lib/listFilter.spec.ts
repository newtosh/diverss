import { describe, expect, it } from 'vitest'
import type { OpmlFolder } from '@/opml/types'
import type { ScoreResult } from '@/score/client'
import {
  countMatchingFeeds,
  feedMatchesListFilter,
  outlineMatchesListFilter,
} from './listFilter'

function score(partial: Partial<ScoreResult> & Pick<ScoreResult, 'xmlUrl' | 'health'>): ScoreResult {
  return {
    schemaVersion: 2,
    reason: partial.health === 'ok' ? 'ok' : partial.health === 'stale' ? 'stale' : 'timeout',
    velocityUnknown: false,
    scoredAt: '2026-01-01T00:00:00Z',
    ...partial,
  }
}

describe('listFilter', () => {
  const feed = {
    kind: 'feed' as const,
    text: 'MacStories',
    xmlUrl: 'https://macstories.net/feed',
  }

  it('matches query on title or url', () => {
    expect(
      feedMatchesListFilter(feed, {}, 'mac', 'all'),
    ).toBe(true)
    expect(
      feedMatchesListFilter(feed, {}, 'macstories.net', 'all'),
    ).toBe(true)
    expect(
      feedMatchesListFilter(feed, {}, 'zzz', 'all'),
    ).toBe(false)
  })

  it('filters by health including unscored', () => {
    const scores = {
      [feed.xmlUrl]: score({ xmlUrl: feed.xmlUrl, health: 'stale' }),
    }
    expect(feedMatchesListFilter(feed, scores, '', 'stale')).toBe(true)
    expect(feedMatchesListFilter(feed, scores, '', 'ok')).toBe(false)
    expect(feedMatchesListFilter(feed, {}, '', 'unscored')).toBe(true)
    expect(feedMatchesListFilter(feed, scores, '', 'unscored')).toBe(false)
  })

  it('counts matching feeds under a folder', () => {
    const folder: OpmlFolder = {
      kind: 'folder',
      text: 'Apple',
      children: [
        feed,
        {
          kind: 'feed',
          text: 'Other',
          xmlUrl: 'https://other.example/feed',
        },
      ],
    }
    const scores = {
      [feed.xmlUrl]: score({ xmlUrl: feed.xmlUrl, health: 'unhealthy' }),
    }
    expect(countMatchingFeeds(folder, scores, '', 'unhealthy')).toBe(1)
    expect(outlineMatchesListFilter(folder, scores, 'other', 'all')).toBe(true)
    expect(outlineMatchesListFilter(folder, scores, 'zzz', 'all')).toBe(false)
  })
})
