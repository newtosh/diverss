import { describe, expect, it } from 'vitest'
import {
  feedDomainRoot,
  feedMembershipKeys,
  feedsShareMembership,
  normalizeFeedUrl,
} from './url'

describe('normalizeFeedUrl', () => {
  it('treats trailing slash and www as the same feed', () => {
    expect(normalizeFeedUrl('https://www.macstories.net/feed/')).toBe(
      normalizeFeedUrl('https://macstories.net/feed'),
    )
  })

  it('is case-insensitive', () => {
    expect(normalizeFeedUrl('https://Feeds.Example/RSS')).toBe(
      'https://feeds.example/rss',
    )
  })

  it('strips hash', () => {
    expect(normalizeFeedUrl('https://ex.example/feed#top')).toBe(
      'https://ex.example/feed',
    )
  })
})

describe('feedDomainRoot', () => {
  it('strips subdomain and public suffix', () => {
    expect(feedDomainRoot('https://feeds.macrumors.com/MacRumors-All')).toBe(
      'macrumors',
    )
    expect(feedDomainRoot('https://www.macrumors.com/macrumors.xml')).toBe(
      'macrumors',
    )
    expect(feedDomainRoot('https://blog.vuejs.org/feed.rss')).toBe('vuejs')
    expect(feedDomainRoot('https://go.dev/blog/feed.atom')).toBe('go')
  })

  it('handles compound country TLDs', () => {
    expect(feedDomainRoot('https://news.example.co.uk/rss')).toBe('example')
  })
})

describe('feedMembershipKeys', () => {
  it('matches same site across feed URL variants', () => {
    expect(
      feedsShareMembership(
        'https://feeds.macrumors.com/MacRumors-All',
        'https://www.macrumors.com/macrumors.xml',
      ),
    ).toBe(true)
  })

  it('does not site-match YouTube channels to each other', () => {
    const a = 'https://www.youtube.com/feeds/videos.xml?channel_id=AAA'
    const b = 'https://www.youtube.com/feeds/videos.xml?channel_id=BBB'
    expect(feedMembershipKeys(a).some((k) => k.startsWith('site:'))).toBe(false)
    expect(feedsShareMembership(a, b)).toBe(false)
  })
})
