import { readerFetch, type FetchLike } from '../transport'
import type {
  FreshRssConnection,
  ReaderAdapter,
  ReaderCategorySummary,
  ReaderFeedSummary,
  ReaderStatusSummary,
} from '../types'

/** Normalize to …/api/greader.php root. */
export function freshrssApiRoot(baseUrl: string): string {
  let b = baseUrl.trim().replace(/\/+$/, '')
  if (b.endsWith('/api/greader.php')) return b
  if (b.endsWith('/greader.php')) {
    return b.includes('/api/') ? b : b.replace(/\/greader\.php$/, '/api/greader.php')
  }
  if (b.endsWith('/api')) return `${b}/greader.php`
  return `${b}/api/greader.php`
}

function parseClientLogin(body: string): string | null {
  const authLine = body.split(/\r?\n/).find((l) => l.startsWith('Auth='))
  if (!authLine) return null
  return authLine.slice('Auth='.length).trim() || null
}

export function createFreshRssAdapter(
  conn: FreshRssConnection,
  fetchImpl?: FetchLike,
): ReaderAdapter {
  const root = freshrssApiRoot(conn.baseUrl)
  let auth: string | null = null

  async function ensureAuth(): Promise<string> {
    if (auth) return auth
    const res = await readerFetch(
      `${root}/accounts/ClientLogin`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `Email=${encodeURIComponent(conn.username)}&Passwd=${encodeURIComponent(conn.apiPassword)}`,
      },
      fetchImpl,
    )
    if (res.status < 200 || res.status >= 300) {
      throw new Error(
        'FreshRSS ClientLogin failed — check username and API password (not login password).',
      )
    }
    const token = parseClientLogin(res.bodyText)
    if (!token) {
      throw new Error('FreshRSS ClientLogin did not return an Auth token.')
    }
    auth = token
    return token
  }

  async function req(
    path: string,
    init: { method?: string; body?: string; contentType?: string } = {},
  ) {
    const token = await ensureAuth()
    const headers: Record<string, string> = {
      Authorization: `GoogleLogin auth=${token}`,
    }
    if (init.contentType) headers['Content-Type'] = init.contentType
    return readerFetch(
      `${root}${path}`,
      {
        method: init.method ?? 'GET',
        headers,
        body: init.body ?? null,
      },
      fetchImpl,
    )
  }

  return {
    id: 'freshrss',

    async test() {
      await ensureAuth()
      const res = await req('/reader/api/0/subscription/list?output=json')
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`FreshRSS test failed (HTTP ${res.status}).`)
      }
    },

    async exportOpml() {
      const res = await req('/reader/api/0/subscription/export')
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`FreshRSS export failed (HTTP ${res.status}).`)
      }
      return res.bodyText
    },

    async importOpml(opml: string) {
      const res = await req('/reader/api/0/subscription/import', {
        method: 'POST',
        body: opml,
        contentType: 'application/xml',
      })
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`FreshRSS import failed (HTTP ${res.status}).`)
      }
    },

    async listFeeds() {
      const res = await req('/reader/api/0/subscription/list?output=json')
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`FreshRSS list feeds failed (HTTP ${res.status}).`)
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(res.bodyText)
      } catch {
        throw new Error('FreshRSS list feeds returned invalid JSON.')
      }
      const subs =
        parsed &&
        typeof parsed === 'object' &&
        Array.isArray((parsed as { subscriptions?: unknown }).subscriptions)
          ? ((parsed as { subscriptions: unknown[] }).subscriptions)
          : []
      return subs.map((row): ReaderFeedSummary => {
        const o = row as Record<string, unknown>
        const idRaw = String(o.id ?? '')
        const id = idRaw.startsWith('feed/') ? idRaw.slice(5) : idRaw
        const cats = Array.isArray(o.categories)
          ? (o.categories as Record<string, unknown>[])
          : []
        const cat = cats[0]
        return {
          id,
          title: String(o.title ?? o.htmlUrl ?? 'Untitled'),
          xmlUrl: String(o.url ?? o.htmlUrl ?? ''),
          categoryId: cat?.id != null ? String(cat.id) : undefined,
          categoryTitle: typeof cat?.label === 'string' ? cat.label : undefined,
        }
      })
    },

    async deleteFeed(id: string) {
      const s = id.startsWith('feed/') ? id : `feed/${id}`
      const res = await req('/reader/api/0/subscription/edit', {
        method: 'POST',
        body: `ac=unsubscribe&s=${encodeURIComponent(s)}`,
        contentType: 'application/x-www-form-urlencoded',
      })
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`FreshRSS unsubscribe failed (HTTP ${res.status}).`)
      }
    },

    async listCategories() {
      const feeds = await this.listFeeds()
      const map = new Map<string, ReaderCategorySummary>()
      for (const f of feeds) {
        if (!f.categoryId) continue
        const cur = map.get(f.categoryId)
        if (cur) cur.feedCount += 1
        else {
          map.set(f.categoryId, {
            id: f.categoryId,
            title: f.categoryTitle ?? f.categoryId,
            feedCount: 1,
          })
        }
      }
      return [...map.values()]
    },

    async deleteCategory(id: string) {
      // GReader disable/folder delete varies; FreshRSS often uses edit with s=user/-/label/...
      const s = id.includes('/') ? id : `user/-/label/${id}`
      const res = await req('/reader/api/0/subscription/edit', {
        method: 'POST',
        body: `ac=disable&s=${encodeURIComponent(s)}`,
        contentType: 'application/x-www-form-urlencoded',
      })
      if (res.status < 200 || res.status >= 300) {
        throw new Error(
          `FreshRSS could not delete category (HTTP ${res.status}). This reader may not support empty-category cleanup via API.`,
        )
      }
    },

    async summarize(): Promise<ReaderStatusSummary> {
      const feeds = await this.listFeeds()
      const cats = await this.listCategories()
      return {
        feedCount: feeds.length,
        categoryCount: cats.length,
        lastErrors: [],
      }
    },
  }
}
