import { describe, expect, it } from 'vitest'
import {
  candidateToFilterPack,
  groupIntoPackCandidates,
  inventoryFromFeeds,
  parseRuleLine,
} from './pullFromReader'
import type { ReaderFeedSummary } from '../types'

describe('parseRuleLine', () => {
  it('parses EntryTitle and EntryContent', () => {
    const t = parseRuleLine('EntryTitle=(?i)Fortnite Chapter')
    expect(t.fieldKey).toBe('EntryTitle')
    expect(t.field).toBe('title')
    expect(t.body).toBe('(?i)Fortnite Chapter')
    expect(t.importable).toBe(true)

    const c = parseRuleLine('EntryContent=(hit)')
    expect(c.field).toBe('body')
  })

  it('marks unsupported Entry* keys as not importable', () => {
    const u = parseRuleLine('EntryAuthor=(?i)bot')
    expect(u.importable).toBe(false)
    expect(u.fieldKey).toBe('EntryAuthor')
  })

  it('treats bare regex as legacy title rule', () => {
    const l = parseRuleLine('(?i)spam')
    expect(l.fieldKey).toBe('legacy')
    expect(l.importable).toBe(true)
  })
})

describe('inventory + group', () => {
  const feeds: ReaderFeedSummary[] = [
    {
      id: '1',
      title: 'A',
      xmlUrl: 'https://a.example/feed.xml',
      blocklistRules: 'EntryTitle=(?i)Fortnite Chapter\nEntryTitle=(?i)spam',
      keeplistRules: '',
    },
    {
      id: '2',
      title: 'B',
      xmlUrl: 'https://b.example/rss',
      blocklistRules: 'EntryTitle=(?i)Fortnite Chapter',
      keeplistRules: 'EntryContent=keepme',
    },
  ]

  it('builds inventory rows for block and keep', () => {
    const rows = inventoryFromFeeds(feeds)
    expect(rows).toHaveLength(4)
    expect(rows.filter((r) => r.mode === 'block')).toHaveLength(3)
    expect(rows.filter((r) => r.mode === 'keep')).toHaveLength(1)
  })

  it('groups identical lines across feeds', () => {
    const candidates = groupIntoPackCandidates(inventoryFromFeeds(feeds))
    const fortnite = candidates.find((c) =>
      c.body.includes('Fortnite Chapter'),
    )
    expect(fortnite?.feedIds).toEqual(['1', '2'])
    expect(fortnite?.mode).toBe('block')
  })

  it('converts importable candidate to a local pack', () => {
    const candidates = groupIntoPackCandidates(inventoryFromFeeds(feeds))
    const fortnite = candidates.find((c) =>
      c.body.includes('Fortnite Chapter'),
    )!
    const pack = candidateToFilterPack(fortnite, { id: 'pulled-test' })
    expect(pack.id).toBe('pulled-test')
    expect(pack.mode).toBe('block')
    expect(pack.patternKind).toBe('keyword')
    expect(pack.pattern).toBe('Fortnite Chapter')
    expect(pack.fields).toEqual(['title'])
    expect(pack.scope.feedUrls).toEqual([
      'https://a.example/feed.xml',
      'https://b.example/rss',
    ])
  })
})
