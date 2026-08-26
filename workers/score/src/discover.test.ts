import { describe, expect, it } from 'vitest'
import {
  looksLikeBotChallenge,
  looksLikeFeedAnchor,
  looksLikeHtml,
  parseAlternateFeedLinks,
  parseAnchorFeedLinks,
  parseHtmlAttributes,
  rankDiscoveredFeeds,
  wellKnownFeedUrls,
} from './discover'

describe('parseAlternateFeedLinks', () => {
  it('extracts rss/atom alternate links as absolute URLs', () => {
    const html = `
      <html><head>
        <link rel="stylesheet" href="/app.css" />
        <link rel="alternate" type="application/rss+xml" title="Main" href="/rss/index.xml" />
        <link rel='alternate' type='application/atom+xml' href='https://cdn.example/atom.xml' />
        <link rel="alternate" type="application/json" title="JSON" href="/feed.json" />
      </head></html>
    `
    const got = parseAlternateFeedLinks(html, 'https://www.theverge.com/')
    expect(got).toEqual([
      {
        xmlUrl: 'https://www.theverge.com/rss/index.xml',
        title: 'Main',
        type: 'application/rss+xml',
      },
      {
        xmlUrl: 'https://cdn.example/atom.xml',
        type: 'application/atom+xml',
      },
      {
        xmlUrl: 'https://www.theverge.com/feed.json',
        title: 'JSON',
        type: 'application/json',
      },
    ])
  })

  it('dedupes case-insensitively', () => {
    const html = `
      <link rel="alternate" type="application/rss+xml" href="https://ex.com/feed" />
      <link rel="alternate" type="application/rss+xml" href="https://EX.com/feed" />
    `
    expect(parseAlternateFeedLinks(html, 'https://ex.com/').length).toBe(1)
  })
})

describe('parseAnchorFeedLinks', () => {
  it('finds AppleInsider-style nav RSS anchors', () => {
    const html = `
      <a href="https://forums.appleinsider.com" title="Forums">Forums</a>
      <a href="https://appleinsider.com/rss/news" title="RSS">RSS</a>
      <a href="/about">About</a>
    `
    expect(looksLikeFeedAnchor('https://appleinsider.com/rss/news', 'RSS')).toBe(true)
    expect(looksLikeFeedAnchor('https://forums.appleinsider.com', 'Forums')).toBe(false)
    expect(parseAnchorFeedLinks(html, 'https://appleinsider.com/')).toEqual([
      {
        xmlUrl: 'https://appleinsider.com/rss/news',
        title: 'RSS',
        type: 'anchor',
      },
    ])
  })
})

describe('parseHtmlAttributes', () => {
  it('parses quoted and unquoted attrs', () => {
    expect(
      parseHtmlAttributes(`<link rel="alternate" type='application/rss+xml' href=/feed>`),
    ).toMatchObject({
      rel: 'alternate',
      type: 'application/rss+xml',
      href: '/feed',
    })
  })
})

describe('wellKnownFeedUrls', () => {
  it('includes origin atom/rss paths', () => {
    const urls = wellKnownFeedUrls('https://cursor.com/')
    expect(urls).toContain('https://cursor.com/atom.xml')
    expect(urls).toContain('https://cursor.com/rss.xml')
    expect(urls).toContain('https://cursor.com/feed.xml')
    expect(urls).toContain('https://cursor.com/rss/news')
  })

  it('also probes first path segment base', () => {
    const urls = wellKnownFeedUrls('https://example.com/blog/hello')
    expect(urls).toContain('https://example.com/atom.xml')
    expect(urls).toContain('https://example.com/blog/atom.xml')
  })
})

describe('looksLikeBotChallenge', () => {
  it('detects Cloudflare interstitial HTML', () => {
    expect(
      looksLikeBotChallenge(
        '<!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title>',
      ),
    ).toBe(true)
    expect(looksLikeBotChallenge('<html><head><title>News</title></head>')).toBe(
      false,
    )
  })
})

describe('looksLikeHtml', () => {
  it('detects HTML shells vs XML feeds', () => {
    expect(looksLikeHtml('<!DOCTYPE html><html><body>app</body></html>')).toBe(true)
    expect(looksLikeHtml('<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">')).toBe(
      false,
    )
  })
})

describe('rankDiscoveredFeeds', () => {
  it('sorts comments feeds after primary feeds', () => {
    const ranked = rankDiscoveredFeeds([
      {
        xmlUrl: 'https://www.gearpatrol.com/comments/feed/',
        title: 'Comments Feed',
      },
      { xmlUrl: 'https://www.gearpatrol.com/feed/', title: 'Gear Patrol' },
    ])
    expect(ranked[0]?.xmlUrl).toBe('https://www.gearpatrol.com/feed/')
    expect(ranked[1]?.xmlUrl).toContain('comments')
  })
})
