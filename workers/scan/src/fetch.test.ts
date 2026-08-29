import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveFeedBody } from './fetch'

const FEED_XML = '<?xml version="1.0"?><rss><channel><item></item></channel></rss>'

/** Fake a public, non-private DNS answer for any hostname (assertSafeUrl's DoH check). */
function dohResponse(): Response {
  return new Response(
    JSON.stringify({ Answer: [{ type: 1, data: '93.184.216.34' }] }),
    { status: 200, headers: { 'Content-Type': 'application/dns-json' } },
  )
}

/** Route global fetch: DoH lookups always resolve; feed fetches are decided per-host. */
function stubFetch(feedHandler: (url: string) => Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('cloudflare-dns.com')) return dohResponse()
      return feedHandler(url)
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('resolveFeedBody RSSHub candidates', () => {
  it('falls back to a working RSSHub base when the primary host is unreachable', async () => {
    stubFetch((url) => {
      if (url.startsWith('https://rfeed.jonxo.dev/')) {
        throw new Error('getaddrinfo ENOTFOUND rfeed.jonxo.dev')
      }
      if (url.startsWith('https://rsshub.app/')) {
        return new Response(FEED_XML, { status: 200 })
      }
      return new Response('', { status: 404 })
    })

    const result = await resolveFeedBody(
      'https://rfeed.jonxo.dev/picuki/profile/alexotos',
      { rsshubBases: ['https://rsshub.app', 'https://rfeed.jonxo.dev'] },
    )
    expect('reason' in result).toBe(false)
    if (!('reason' in result)) {
      expect(result.fetchUrl).toBe('https://rsshub.app/picuki/profile/alexotos')
      expect(result.body).toBe(FEED_XML)
    }
  })

  it('advances through multiple RSSHub candidates until one succeeds', async () => {
    stubFetch((url) => {
      if (url.startsWith('https://dead.example/')) {
        throw new Error('getaddrinfo ENOTFOUND dead.example')
      }
      if (url.startsWith('https://also-dead.example/')) {
        return new Response('', { status: 503 })
      }
      if (url.startsWith('https://good.example/')) {
        return new Response(FEED_XML, { status: 200 })
      }
      return new Response('', { status: 404 })
    })

    const result = await resolveFeedBody('https://dead.example/feed', {
      rsshubBases: ['https://dead.example', 'https://also-dead.example', 'https://good.example'],
    })
    expect('reason' in result).toBe(false)
    if (!('reason' in result)) {
      expect(result.fetchUrl).toBe('https://good.example/feed')
    }
  })

  it('falls through to existing static mirrors when all RSSHub candidates fail', async () => {
    stubFetch((url) => {
      if (url.startsWith('https://css-tricks.com/')) {
        return new Response('', { status: 403 })
      }
      if (url.startsWith('https://feeds.feedburner.com/CssTricks')) {
        return new Response(FEED_XML, { status: 200 })
      }
      if (url.startsWith('https://dead-hub.example/')) {
        throw new Error('getaddrinfo ENOTFOUND dead-hub.example')
      }
      return new Response('', { status: 404 })
    })

    const result = await resolveFeedBody('https://css-tricks.com/feed/', {
      rsshubBases: ['https://dead-hub.example'],
    })
    expect('reason' in result).toBe(false)
    if (!('reason' in result)) {
      expect(result.fetchUrl).toBe('https://feeds.feedburner.com/CssTricks')
    }
  })

  it('behaves exactly as before when no rsshubBases are supplied', async () => {
    stubFetch((url) => {
      if (url.startsWith('https://example.com/')) {
        return new Response(FEED_XML, { status: 200 })
      }
      return new Response('', { status: 404 })
    })

    const result = await resolveFeedBody('https://example.com/feed')
    expect('reason' in result).toBe(false)
    if (!('reason' in result)) {
      expect(result.fetchUrl).toBe('https://example.com/feed')
    }
  })

  it('treats a malformed rsshubBases-less primary success without attempting any candidate fetch', async () => {
    const feedHandler = vi.fn((url: string) =>
      url.startsWith('https://example.com/')
        ? new Response(FEED_XML, { status: 200 })
        : new Response('', { status: 404 }),
    )
    stubFetch(feedHandler)

    await resolveFeedBody('https://example.com/feed', { rsshubBases: ['https://rsshub.app'] })
    const calledUrls = feedHandler.mock.calls.map((c) => c[0] as string)
    expect(calledUrls.some((u) => u.includes('rsshub.app'))).toBe(false)
  })

  it('returns the primary error when no configured base matches and no mirror exists', async () => {
    stubFetch((url) => {
      if (url.startsWith('https://totally-dead.example/')) {
        throw new Error('getaddrinfo ENOTFOUND totally-dead.example')
      }
      return new Response('', { status: 404 })
    })

    const result = await resolveFeedBody('https://totally-dead.example/feed', {
      rsshubBases: ['https://rsshub.app'],
    })
    expect('reason' in result).toBe(true)
    if ('reason' in result) {
      expect(result.reason).toBe('dns')
    }
  })
})
