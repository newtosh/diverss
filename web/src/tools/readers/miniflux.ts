import { readerFetch, type FetchLike } from '../transport'
import type {
  MinifluxConnection,
  ReaderAdapter,
  ReaderCategorySummary,
  ReaderFeedSummary,
  ReaderStatusSummary,
} from '../types'

function apiRoot(baseUrl: string): string {
  const b = baseUrl.replace(/\/+$/, '')
  return b.endsWith('/v1') ? b.slice(0, -3) : b
}

export function createMinifluxAdapter(
  conn: MinifluxConnection,
  fetchImpl?: FetchLike,
): ReaderAdapter {
  const root = apiRoot(conn.baseUrl)
  const headers = { 'X-Auth-Token': conn.token }

  async function req(
    path: string,
    init: { method?: string; body?: string; contentType?: string } = {},
  ) {
    const h: Record<string, string> = { ...headers }
    if (init.contentType) h['Content-Type'] = init.contentType
    const res = await readerFetch(
      `${root}${path}`,
      { method: init.method ?? 'GET', headers: h, body: init.body ?? null },
      fetchImpl,
    )
    return res
  }

  return {
    id: 'miniflux',

    async test() {
      const res = await req('/v1/me')
      if (res.status === 401 || res.status === 403) {
        throw new Error('Miniflux rejected the API token (unauthorized).')
      }
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`Miniflux test failed (HTTP ${res.status}).`)
      }
    },

    async exportOpml() {
      const res = await req('/v1/export')
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`Miniflux export failed (HTTP ${res.status}).`)
      }
      return res.bodyText
    },

    async importOpml(opml: string) {
      const res = await req('/v1/import', {
        method: 'POST',
        body: opml,
        contentType: 'application/xml',
      })
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`Miniflux import failed (HTTP ${res.status}).`)
      }
    },

    async listFeeds() {
      const res = await req('/v1/feeds')
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`Miniflux list feeds failed (HTTP ${res.status}).`)
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(res.bodyText)
      } catch {
        throw new Error('Miniflux list feeds returned invalid JSON.')
      }
      if (!Array.isArray(parsed)) return []
      return parsed.map((row): ReaderFeedSummary => {
        const o = row as Record<string, unknown>
        const cat = o.category as Record<string, unknown> | undefined
        return {
          id: String(o.id ?? ''),
          title: String(o.title ?? o.feed_url ?? 'Untitled'),
          xmlUrl: String(o.feed_url ?? o.site_url ?? ''),
          categoryId: cat?.id != null ? String(cat.id) : undefined,
          categoryTitle:
            typeof cat?.title === 'string' ? cat.title : undefined,
          lastError:
            typeof o.parsing_error_message === 'string' &&
            o.parsing_error_message
              ? o.parsing_error_message
              : undefined,
        }
      })
    },

    async deleteFeed(id: string) {
      const res = await req(`/v1/feeds/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`Miniflux delete feed failed (HTTP ${res.status}).`)
      }
    },

    async listCategories() {
      const res = await req('/v1/categories')
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`Miniflux list categories failed (HTTP ${res.status}).`)
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(res.bodyText)
      } catch {
        throw new Error('Miniflux list categories returned invalid JSON.')
      }
      if (!Array.isArray(parsed)) return []
      const feeds = await this.listFeeds()
      const counts = new Map<string, number>()
      for (const f of feeds) {
        if (!f.categoryId) continue
        counts.set(f.categoryId, (counts.get(f.categoryId) ?? 0) + 1)
      }
      return parsed.map((row): ReaderCategorySummary => {
        const o = row as Record<string, unknown>
        const id = String(o.id ?? '')
        return {
          id,
          title: String(o.title ?? 'Untitled'),
          feedCount: counts.get(id) ?? 0,
        }
      })
    },

    async deleteCategory(id: string) {
      const res = await req(`/v1/categories/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (res.status < 200 || res.status >= 300) {
        throw new Error(
          `Miniflux delete category failed (HTTP ${res.status}).`,
        )
      }
    },

    async summarize(): Promise<ReaderStatusSummary> {
      const feeds = await this.listFeeds()
      const lastErrors = feeds
        .filter((f) => f.lastError)
        .slice(0, 10)
        .map((f) => ({ title: f.title, detail: f.lastError! }))
      let categoryCount: number | undefined
      try {
        categoryCount = (await this.listCategories()).length
      } catch {
        categoryCount = undefined
      }
      return {
        feedCount: feeds.length,
        categoryCount,
        lastErrors,
      }
    },
  }
}
