import { describe, expect, it, vi } from 'vitest'
import { createMinifluxAdapter } from './miniflux'

describe('miniflux adapter', () => {
  it('maps 401 on test to a clear auth error', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('nope', { status: 401 }),
    )
    const adapter = createMinifluxAdapter(
      { baseUrl: 'https://m.example', token: 'bad' },
      fetchImpl,
    )
    await expect(adapter.test()).rejects.toThrow(/unauthorized/i)
  })

  it('exportOpml returns body text', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('<opml/>', { status: 200 }),
    )
    const adapter = createMinifluxAdapter(
      { baseUrl: 'https://m.example', token: 't' },
      fetchImpl,
    )
    await expect(adapter.exportOpml()).resolves.toBe('<opml/>')
  })

  it('wipe deletes each listed feed id', async () => {
    const calls: string[] = []
    const fetchImpl = vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input)
      const method = (init?.method ?? 'GET').toUpperCase()
      calls.push(`${method} ${url}`)
      if (url.endsWith('/v1/feeds') && method === 'GET') {
        return {
          status: 200,
          text: async () =>
            JSON.stringify([
              { id: 1, title: 'A', feed_url: 'https://a.example/feed.xml' },
              { id: 2, title: 'B', feed_url: 'https://b.example/feed.xml' },
            ]),
        } as Response
      }
      return {
        status: 200,
        text: async () => '',
      } as Response
    })
    const adapter = createMinifluxAdapter(
      { baseUrl: 'https://m.example', token: 't' },
      fetchImpl,
    )
    const feeds = await adapter.listFeeds()
    for (const f of feeds) await adapter.deleteFeed(f.id)
    expect(calls.some((c) => c.includes('DELETE') && c.includes('/v1/feeds/1'))).toBe(
      true,
    )
    expect(calls.some((c) => c.includes('DELETE') && c.includes('/v1/feeds/2'))).toBe(
      true,
    )
  })

  it('updateFeedFilters PUTs blocklist and keeplist', async () => {
    const fetchImpl = vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input)
      const method = (init?.method ?? 'GET').toUpperCase()
      if (url.includes('/v1/feeds/9') && method === 'PUT') {
        expect(JSON.parse(String(init?.body))).toEqual({
          blocklist_rules: 'EntryTitle=x',
          keeplist_rules: 'EntryTitle=y',
        })
        return { status: 201, text: async () => '' } as Response
      }
      return { status: 404, text: async () => '' } as Response
    })
    const adapter = createMinifluxAdapter(
      { baseUrl: 'https://m.example', token: 't' },
      fetchImpl,
    )
    expect(adapter.supportsFilterApply).toBe(true)
    await adapter.updateFeedFilters!('9', {
      blocklistRules: 'EntryTitle=x',
      keeplistRules: 'EntryTitle=y',
    })
  })

  it('listFeeds maps blocklist_rules and keeplist_rules', async () => {
    const fetchImpl = vi.fn(
      async () =>
        ({
          status: 200,
          text: async () =>
            JSON.stringify([
              {
                id: 3,
                title: 'C',
                feed_url: 'https://c.example/rss',
                blocklist_rules: 'EntryTitle=a',
                keeplist_rules: 'EntryTitle=b',
              },
            ]),
        }) as Response,
    )
    const adapter = createMinifluxAdapter(
      { baseUrl: 'https://m.example', token: 't' },
      fetchImpl,
    )
    const feeds = await adapter.listFeeds()
    expect(feeds[0]?.blocklistRules).toBe('EntryTitle=a')
    expect(feeds[0]?.keeplistRules).toBe('EntryTitle=b')
  })
})
