import type {
  ReaderAdapter,
  ReaderCategorySummary,
  ReaderFeedSummary,
  ReaderStatusSummary,
} from '../types'

export interface MockMinifluxFeedSeed {
  id: string
  title: string
  xmlUrl: string
  categoryId: string
  categoryTitle: string
  blocklistRules?: string
  keeplistRules?: string
  lastError?: string
}

const DEFAULT_FEEDS: MockMinifluxFeedSeed[] = [
  {
    id: '101',
    title: 'The Verge',
    xmlUrl: 'https://www.theverge.com/rss/index.xml',
    categoryId: '1',
    categoryTitle: 'Tech',
  },
  {
    id: '102',
    title: 'MacStories',
    xmlUrl: 'https://www.macstories.net/feed/',
    categoryId: '1',
    categoryTitle: 'Tech',
    blocklistRules: 'EntryTitle=(?i)Sponsored',
  },
  {
    id: '103',
    title: 'Nine To Five Mac',
    xmlUrl: 'https://9to5mac.com/feed/',
    categoryId: '1',
    categoryTitle: 'Tech',
  },
  {
    id: '201',
    title: 'Polygon',
    xmlUrl: 'https://www.polygon.com/rss/index.xml',
    categoryId: '2',
    categoryTitle: 'Games',
  },
  {
    id: '202',
    title: 'Eurogamer',
    xmlUrl: 'https://www.eurogamer.net/?format=rss',
    categoryId: '2',
    categoryTitle: 'Games',
  },
  {
    id: '301',
    title: 'CSS-Tricks',
    xmlUrl: 'https://css-tricks.com/feed/',
    categoryId: '3',
    categoryTitle: 'Web',
  },
  {
    id: '302',
    title: 'Smashing Magazine',
    xmlUrl: 'https://www.smashingmagazine.com/feed/',
    categoryId: '3',
    categoryTitle: 'Web',
    lastError: 'Unable to parse this feed (mock sample error)',
  },
  {
    id: '401',
    title: 'Empty Category Feed',
    xmlUrl: 'https://example.com/empty-cat.xml',
    categoryId: '4',
    categoryTitle: 'Archive',
  },
]

/**
 * In-memory Miniflux stand-in for local Tools UI review.
 * Apply / wipe / import mutate session state only.
 */
export function createMockMinifluxAdapter(
  seeds: MockMinifluxFeedSeed[] = DEFAULT_FEEDS,
): ReaderAdapter {
  let feeds: ReaderFeedSummary[] = seeds.map((s) => ({
    id: s.id,
    title: s.title,
    xmlUrl: s.xmlUrl,
    categoryId: s.categoryId,
    categoryTitle: s.categoryTitle,
    blocklistRules: s.blocklistRules ?? '',
    keeplistRules: s.keeplistRules ?? '',
    lastError: s.lastError,
  }))

  const categories = (): ReaderCategorySummary[] => {
    const map = new Map<string, ReaderCategorySummary>()
    for (const f of feeds) {
      if (!f.categoryId) continue
      const cur = map.get(f.categoryId)
      if (cur) cur.feedCount += 1
      else {
        map.set(f.categoryId, {
          id: f.categoryId,
          title: f.categoryTitle ?? 'Untitled',
          feedCount: 1,
        })
      }
    }
    // Keep empty categories visible for cleanup UI demos
    if (![...map.keys()].includes('5')) {
      map.set('5', { id: '5', title: 'Empty (mock)', feedCount: 0 })
    }
    return [...map.values()]
  }

  return {
    id: 'miniflux',
    supportsFilterApply: true,

    async test() {
      /* always ok */
    },

    async exportOpml() {
      const cats = categories().filter((c) => c.feedCount > 0)
      const outlines = cats
        .map((c) => {
          const kids = feeds
            .filter((f) => f.categoryId === c.id)
            .map(
              (f) =>
                `    <outline type="rss" text="${escapeXml(f.title)}" xmlUrl="${escapeXml(f.xmlUrl)}" />`,
            )
            .join('\n')
          return `  <outline text="${escapeXml(c.title)}">\n${kids}\n  </outline>`
        })
        .join('\n')
      return `<?xml version="1.0"?>\n<opml version="2.0">\n<head><title>Mock Miniflux</title></head>\n<body>\n${outlines}\n</body>\n</opml>\n`
    },

    async importOpml(_opml: string) {
      // Keep existing mock feeds; pretend import succeeded.
      void _opml
    },

    async listFeeds() {
      return feeds.map((f) => ({ ...f }))
    },

    async deleteFeed(id: string) {
      feeds = feeds.filter((f) => f.id !== id)
    },

    async listCategories() {
      return categories()
    },

    async deleteCategory(id: string) {
      const cat = categories().find((c) => c.id === id)
      if (cat && cat.feedCount > 0) {
        throw new Error('Mock category is not empty.')
      }
      // Empty categories are synthetic; nothing to persist.
    },

    async summarize(): Promise<ReaderStatusSummary> {
      const lastErrors = feeds
        .filter((f) => f.lastError)
        .slice(0, 10)
        .map((f) => ({ title: f.title, detail: f.lastError! }))
      return {
        feedCount: feeds.length,
        categoryCount: categories().length,
        lastErrors,
      }
    },

    async updateFeedFilters(id, patch) {
      const i = feeds.findIndex((f) => f.id === id)
      if (i < 0) throw new Error(`Mock feed ${id} not found.`)
      const row = feeds[i]!
      feeds[i] = {
        ...row,
        ...(patch.blocklistRules !== undefined
          ? { blocklistRules: patch.blocklistRules }
          : {}),
        ...(patch.keeplistRules !== undefined
          ? { keeplistRules: patch.keeplistRules }
          : {}),
      }
    },

    async updateFeedBlocklist(id: string, blocklistRules: string) {
      const i = feeds.findIndex((f) => f.id === id)
      if (i < 0) throw new Error(`Mock feed ${id} not found.`)
      const row = feeds[i]!
      feeds[i] = { ...row, blocklistRules }
    },
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
