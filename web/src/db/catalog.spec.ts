import { beforeEach, describe, expect, it } from 'vitest'
import {
  loadLocalCatalog,
  LOCAL_CATALOG_KEY,
  mergeIntoLocalCatalog,
  pruneCatalogFeeds,
  saveLocalCatalog,
} from './catalog'

describe('pruneCatalogFeeds', () => {
  beforeEach(() => {
    localStorage.removeItem(LOCAL_CATALOG_KEY)
  })

  it('removes community rows, dismisses urls, and drops scores', () => {
    mergeIntoLocalCatalog([
      {
        title: 'Dead Feed',
        xmlUrl: 'https://example.com/dead.xml',
        sourceTitle: 'Pack',
      },
      {
        title: 'Live Feed',
        xmlUrl: 'https://example.com/live.xml',
        sourceTitle: 'Pack',
      },
    ])
    const withScores = loadLocalCatalog()
    withScores.scores = {
      'https://example.com/dead.xml': {
        schemaVersion: 2,
        xmlUrl: 'https://example.com/dead.xml',
        health: 'unhealthy',
        reason: 'http_status',
        detail: '404',
        velocityUnknown: false,
        scannedAt: '2026-01-01T00:00:00Z',
      },
    }
    saveLocalCatalog(withScores)

    const result = pruneCatalogFeeds(['https://example.com/dead.xml'])
    expect(result.removedCommunity).toBe(1)
    expect(result.dismissed).toBe(1)
    expect(result.snapshot.feeds.map((f) => f.xmlUrl)).toEqual([
      'https://example.com/live.xml',
    ])
    expect(result.snapshot.dismissedUrls).toContain('https://example.com/dead.xml')
    expect(result.snapshot.scores?.['https://example.com/dead.xml']).toBeUndefined()
  })

  it('keeps curated-only urls dismissed after prune', () => {
    const result = pruneCatalogFeeds(['https://curated.example/feed.xml'])
    expect(result.removedCommunity).toBe(0)
    expect(result.dismissed).toBe(1)
    expect(loadLocalCatalog().dismissedUrls).toContain(
      'https://curated.example/feed.xml',
    )
  })

  it('undismisses when merge re-adds a pruned url', () => {
    pruneCatalogFeeds(['https://example.com/back.xml'])
    mergeIntoLocalCatalog([
      { title: 'Back', xmlUrl: 'https://example.com/back.xml' },
    ])
    const snap = loadLocalCatalog()
    expect(snap.dismissedUrls ?? []).not.toContain('https://example.com/back.xml')
    expect(snap.feeds.some((f) => f.xmlUrl === 'https://example.com/back.xml')).toBe(
      true,
    )
  })
})
