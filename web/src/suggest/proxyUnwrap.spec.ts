import { describe, expect, it } from 'vitest'
import { discoverPageForFeed, proxyUnwrap } from './proxyUnwrap'

describe('proxyUnwrap', () => {
  it('maps rsshub theverge to official feed + site', () => {
    const r = proxyUnwrap('https://rsshub.app/theverge')
    expect(r.discoverPageUrl).toBe('https://www.theverge.com/')
    expect(r.suggestions.map((s) => s.xmlUrl)).toContain(
      'https://www.theverge.com/rss/index.xml',
    )
    expect(r.suggestions.every((s) => s.source === 'proxy_unwrap')).toBe(true)
  })

  it('adds hub-specific verge feed when present', () => {
    const r = proxyUnwrap('https://rsshub.app/theverge/apple')
    expect(r.suggestions[0]?.xmlUrl).toBe(
      'https://www.theverge.com/rss/apple/index.xml',
    )
  })

  it('ignores non-proxy hosts', () => {
    expect(proxyUnwrap('https://www.theverge.com/rss/index.xml').suggestions).toEqual([])
  })
})

describe('discoverPageForFeed', () => {
  it('prefers htmlUrl', () => {
    expect(
      discoverPageForFeed({
        xmlUrl: 'https://rsshub.app/theverge',
        htmlUrl: 'https://www.theverge.com/about',
      }),
    ).toBe('https://www.theverge.com/about')
  })

  it('falls back to proxy site then same-origin root', () => {
    expect(
      discoverPageForFeed({ xmlUrl: 'https://rsshub.app/theverge' }),
    ).toBe('https://www.theverge.com/')
    expect(
      discoverPageForFeed({ xmlUrl: 'https://example.com/old/feed.xml' }),
    ).toBe('https://example.com/')
  })
})
