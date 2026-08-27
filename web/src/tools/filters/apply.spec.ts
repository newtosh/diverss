import { describe, expect, it, vi } from 'vitest'
import { applyPackToAdapter, selectFeedsForPack } from './apply'
import type { FilterPack } from './types'
import type { ReaderAdapter, ReaderFeedSummary } from '../types'

const pack: FilterPack = {
  schemaVersion: 1,
  id: 'fortnite-chapter',
  name: 'Fortnite Chapter',
  mode: 'block',
  match: 'any',
  pattern: 'Fortnite Chapter',
  patternKind: 'keyword',
  fields: ['title'],
  scope: { global: false, feedUrls: ['https://example.com/feed.xml'] },
}

const feeds: ReaderFeedSummary[] = [
  {
    id: '1',
    title: 'A',
    xmlUrl: 'https://example.com/feed.xml',
    blocklistRules: '',
  },
  {
    id: '2',
    title: 'B',
    xmlUrl: 'https://other.example/rss',
    blocklistRules: 'EntryTitle=keep',
  },
]

describe('selectFeedsForPack', () => {
  it('fans out when global', () => {
    const r = selectFeedsForPack({ ...pack, scope: { global: true } }, feeds)
    expect(r.selected).toHaveLength(2)
  })

  it('matches feedUrls and counts unmatched as skipped', () => {
    const r = selectFeedsForPack(
      {
        ...pack,
        scope: {
          global: false,
          feedUrls: [
            'https://example.com/feed.xml',
            'https://missing.example/x',
          ],
        },
      },
      feeds,
    )
    expect(r.selected.map((f) => f.id)).toEqual(['1'])
    expect(r.skipped).toBe(1)
  })
})

describe('applyPackToAdapter', () => {
  it('merges blocklist and reports counts', async () => {
    const store = new Map(feeds.map((f) => [f.id, { ...f }]))
    const adapter: ReaderAdapter = {
      id: 'miniflux',
      supportsFilterApply: true,
      test: async () => {},
      exportOpml: async () => '',
      importOpml: async () => {},
      listFeeds: async () => [...store.values()],
      deleteFeed: async () => {},
      listCategories: async () => [],
      deleteCategory: async () => {},
      summarize: async () => ({ feedCount: 0, lastErrors: [] }),
      updateFeedBlocklist: async (id, rules) => {
        const row = store.get(id)!
        store.set(id, { ...row, blocklistRules: rules })
      },
    }

    const result = await applyPackToAdapter(pack, adapter)
    expect(result.feedsTouched).toBe(1)
    expect(result.linesAdded).toBe(1)
    expect(result.mode).toBe('block')
    expect(result.errors).toEqual([])
    expect(store.get('1')!.blocklistRules).toContain('EntryTitle=(?i)Fortnite Chapter')
    expect(store.get('2')!.blocklistRules).toBe('EntryTitle=keep')
  })

  it('merges into keeplist when mode is keep', async () => {
    const store = new Map(feeds.map((f) => [f.id, { ...f, keeplistRules: '' }]))
    const adapter: ReaderAdapter = {
      id: 'miniflux',
      supportsFilterApply: true,
      test: async () => {},
      exportOpml: async () => '',
      importOpml: async () => {},
      listFeeds: async () => [...store.values()],
      deleteFeed: async () => {},
      listCategories: async () => [],
      deleteCategory: async () => {},
      summarize: async () => ({ feedCount: 0, lastErrors: [] }),
      updateFeedFilters: async (id, patch) => {
        const row = store.get(id)!
        store.set(id, {
          ...row,
          keeplistRules: patch.keeplistRules ?? row.keeplistRules,
        })
      },
    }
    const result = await applyPackToAdapter(
      { ...pack, mode: 'keep', scope: { global: true } },
      adapter,
    )
    expect(result.mode).toBe('keep')
    expect(result.feedsTouched).toBe(2)
    expect(store.get('1')!.keeplistRules).toContain('EntryTitle=(?i)Fortnite Chapter')
  })

  it('surfaces per-feed PUT errors without claiming success', async () => {
    const adapter: ReaderAdapter = {
      id: 'miniflux',
      supportsFilterApply: true,
      test: async () => {},
      exportOpml: async () => '',
      importOpml: async () => {},
      listFeeds: async () => feeds,
      deleteFeed: async () => {},
      listCategories: async () => [],
      deleteCategory: async () => {},
      summarize: async () => ({ feedCount: 0, lastErrors: [] }),
      updateFeedBlocklist: async () => {
        throw new Error('HTTP 500')
      },
    }
    const result = await applyPackToAdapter(
      { ...pack, scope: { global: true } },
      adapter,
    )
    expect(result.feedsTouched).toBe(0)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toMatch(/HTTP 500/)
  })

  it('rejects adapters without filter apply', async () => {
    const adapter = {
      id: 'freshrss' as const,
      supportsFilterApply: false,
    } as ReaderAdapter
    await expect(applyPackToAdapter(pack, adapter)).rejects.toThrow(
      /does not support/i,
    )
  })

  it('skips duplicate lines on re-apply', async () => {
    const line = 'EntryTitle=(?i)Fortnite Chapter'
    const store = new Map([
      [
        '1',
        {
          id: '1',
          title: 'A',
          xmlUrl: 'https://example.com/feed.xml',
          blocklistRules: line,
        },
      ],
    ])
    const update = vi.fn()
    const adapter: ReaderAdapter = {
      id: 'miniflux',
      supportsFilterApply: true,
      test: async () => {},
      exportOpml: async () => '',
      importOpml: async () => {},
      listFeeds: async () => [...store.values()],
      deleteFeed: async () => {},
      listCategories: async () => [],
      deleteCategory: async () => {},
      summarize: async () => ({ feedCount: 0, lastErrors: [] }),
      updateFeedBlocklist: update,
    }
    const result = await applyPackToAdapter(pack, adapter)
    expect(result.feedsTouched).toBe(0)
    expect(result.linesAdded).toBe(0)
    expect(update).not.toHaveBeenCalled()
  })
})
