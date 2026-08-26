import { describe, expect, it } from 'vitest'
import { siteAvatarUrl, siteHostname, siteInitial } from './siteAvatar'

describe('siteHostname', () => {
  it('prefers htmlUrl host and strips www', () => {
    expect(
      siteHostname(
        'https://feeds.example.com/rss.xml',
        'https://www.example.com/blog/',
      ),
    ).toBe('example.com')
  })

  it('falls back to xmlUrl host', () => {
    expect(siteHostname('https://macrumors.com/feed.xml')).toBe('macrumors.com')
  })

  it('returns null for invalid urls', () => {
    expect(siteHostname('not-a-url')).toBeNull()
  })
})

describe('siteAvatarUrl', () => {
  it('builds duckduckgo icon url', () => {
    expect(siteAvatarUrl('https://blog.vuejs.org/feed.xml')).toBe(
      'https://icons.duckduckgo.com/ip3/blog.vuejs.org.ico',
    )
  })
})

describe('siteInitial', () => {
  it('uses first letter uppercased', () => {
    expect(siteInitial('macStories')).toBe('M')
    expect(siteInitial('  ')).toBe('?')
  })
})
