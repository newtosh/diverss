import { describe, it, expect } from 'vitest'
import { parseOpml, OpmlParseError } from './parse'
import { serializeOpml } from './serialize'
import { flattenFeeds } from './types'
import { removeAtPath } from './mutate'

const sample = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Sample</title>
  </head>
  <body>
    <outline text="News">
      <outline text="Alpha" type="rss" xmlUrl="https://alpha.example/feed.xml" htmlUrl="https://alpha.example/" />
      <outline text="Beta" xmlUrl="https://beta.example/rss" />
    </outline>
    <outline text="Solo" xmlUrl="https://solo.example/atom.xml" />
  </body>
</opml>`

describe('parseOpml', () => {
  it('parses feeds and preserves folders', () => {
    const doc = parseOpml(sample)
    expect(doc.title).toBe('Sample')
    expect(doc.outlines).toHaveLength(2)
    expect(doc.outlines[0]).toMatchObject({ kind: 'folder', text: 'News' })
    expect(flattenFeeds(doc.outlines)).toHaveLength(3)
    expect(flattenFeeds(doc.outlines).map((f) => f.xmlUrl)).toEqual([
      'https://alpha.example/feed.xml',
      'https://beta.example/rss',
      'https://solo.example/atom.xml',
    ])
  })

  it('rejects malformed XML', () => {
    expect(() => parseOpml('<opml><body><outline')).toThrow(OpmlParseError)
    expect(() => parseOpml('<opml><body><outline')).toThrow(/Malformed XML/)
  })

  it('rejects leaf outline missing xmlUrl', () => {
    const xml = `<?xml version="1.0"?><opml version="2.0"><body>
      <outline text="Not a feed" />
    </body></opml>`
    expect(() => parseOpml(xml)).toThrow(/missing xmlUrl/)
  })

  it('rejects feed outline missing text', () => {
    const xml = `<?xml version="1.0"?><opml version="2.0"><body>
      <outline xmlUrl="https://x.example/feed" />
    </body></opml>`
    expect(() => parseOpml(xml)).toThrow(/requires a text/)
  })
})

describe('serializeOpml round-trip', () => {
  it('round-trips structure and feed fields', () => {
    const original = parseOpml(sample)
    const xml = serializeOpml(original)
    expect(xml).toMatch(/<\?xml version="1\.0"/)
    expect(xml).toContain('<opml')
    const again = parseOpml(xml)
    expect(again.title).toBe(original.title)
    expect(flattenFeeds(again.outlines)).toEqual(flattenFeeds(original.outlines))
    expect(again.outlines[0]?.kind).toBe('folder')
  })

  it('omits pruned feeds from export (AE5)', () => {
    const doc = parseOpml(sample)
    // path [0, 1] = News → Beta
    const pruned = removeAtPath(doc, [0, 1])
    const exported = parseOpml(serializeOpml(pruned))
    const urls = flattenFeeds(exported.outlines).map((f) => f.xmlUrl)
    expect(urls).toEqual([
      'https://alpha.example/feed.xml',
      'https://solo.example/atom.xml',
    ])
    expect(urls).not.toContain('https://beta.example/rss')
  })
})
