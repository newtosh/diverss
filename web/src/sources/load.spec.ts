import { describe, expect, it } from 'vitest'
import { dedupeSourceFeeds, entrypointRole, resolveEntrypointUrls } from './load'
import type { CommunitySource, ParsedSourceFeed } from './types'

function feed(
  partial: Partial<ParsedSourceFeed> & Pick<ParsedSourceFeed, 'xmlUrl'>,
): ParsedSourceFeed {
  return {
    text: partial.text ?? 'T',
    xmlUrl: partial.xmlUrl,
    groups: partial.groups ?? [],
    sourceId: partial.sourceId ?? 's',
    sourceTitle: partial.sourceTitle ?? 'Source',
    entrypointLabel: partial.entrypointLabel ?? 'Pack',
    htmlUrl: partial.htmlUrl,
  }
}

describe('dedupeSourceFeeds', () => {
  it('keeps the first xmlUrl and drops case duplicates', () => {
    const out = dedupeSourceFeeds([
      feed({ xmlUrl: 'https://Ex.example/feed', text: 'A' }),
      feed({ xmlUrl: 'https://ex.example/feed', text: 'B' }),
      feed({ xmlUrl: 'https://other.example/rss', text: 'C' }),
    ])
    expect(out).toHaveLength(2)
    expect(out[0]?.text).toBe('A')
    expect(out[1]?.text).toBe('C')
  })
})

describe('resolveEntrypointUrls', () => {
  const source: CommunitySource = {
    id: 'plenary',
    title: 'Plenary',
    kind: 'opml_bundle',
    homepage: 'https://example.com',
    attribution: 'test',
    entrypoints: [
      { label: 'Awesome RSS Feeds (Plenary)', role: 'collection', mergeSections: true },
      {
        label: 'Apple',
        role: 'section',
        url: 'https://example.com/Apple.opml',
      },
      {
        label: 'Tech',
        role: 'section',
        url: 'https://example.com/Tech.opml',
      },
    ],
  }

  it('merges all section URLs for a collection pack', () => {
    expect(resolveEntrypointUrls(source, source.entrypoints[0]!)).toEqual([
      'https://example.com/Apple.opml',
      'https://example.com/Tech.opml',
    ])
    expect(entrypointRole(source.entrypoints[0]!)).toBe('collection')
  })

  it('returns a single URL for a section pack', () => {
    expect(resolveEntrypointUrls(source, source.entrypoints[1]!)).toEqual([
      'https://example.com/Apple.opml',
    ])
  })
})
