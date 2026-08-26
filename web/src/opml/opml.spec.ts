import { describe, it, expect } from 'vitest'
import { parseOpml, OpmlParseError } from './parse'
import { serializeOpml } from './serialize'
import { opmlDownloadFilename } from './filename'
import { flattenFeeds } from './types'
import {
  removeAtPath,
  removeEmptyFolders,
  removeFeedsByXmlUrls,
  outlineAtPath,
  updateFeedXmlUrl,
  appendFeed,
  appendFolder,
  ensureCategoryPath,
  listSectionOptions,
  moveFeed,
  moveFeedsByUrls,
  updateFolderText,
} from './mutate'

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

  it('falls back to hostname when feed outline lacks text', () => {
    const xml = `<?xml version="1.0"?><opml version="2.0"><body>
      <outline xmlUrl="https://www.x.example/feed" />
    </body></opml>`
    const doc = parseOpml(xml)
    expect(doc.outlines).toEqual([
      {
        kind: 'feed',
        text: 'x.example',
        xmlUrl: 'https://www.x.example/feed',
      },
    ])
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

  it('removes feeds by xmlUrl set without index corruption', () => {
    const doc = parseOpml(sample)
    const next = removeFeedsByXmlUrls(doc, [
      'https://alpha.example/feed.xml',
      'https://solo.example/atom.xml',
    ])
    expect(flattenFeeds(next.outlines).map((f) => f.xmlUrl)).toEqual([
      'https://beta.example/rss',
    ])
  })

  it('removes a whole section folder and its feeds', () => {
    const doc = parseOpml(sample)
    const next = removeAtPath(doc, [0])
    expect(next.outlines).toHaveLength(1)
    expect(next.outlines[0]).toMatchObject({
      kind: 'feed',
      xmlUrl: 'https://solo.example/atom.xml',
    })
    expect(flattenFeeds(next.outlines).map((f) => f.xmlUrl)).toEqual([
      'https://solo.example/atom.xml',
    ])
    const exported = flattenFeeds(parseOpml(serializeOpml(next)).outlines).map(
      (f) => f.xmlUrl,
    )
    expect(exported).toEqual(['https://solo.example/atom.xml'])
  })

  it('outlineAtPath resolves folders and feeds', () => {
    const doc = parseOpml(sample)
    expect(outlineAtPath(doc.outlines, [0])).toMatchObject({
      kind: 'folder',
      text: 'News',
    })
    expect(outlineAtPath(doc.outlines, [0, 1])).toMatchObject({
      kind: 'feed',
      xmlUrl: 'https://beta.example/rss',
    })
    expect(outlineAtPath(doc.outlines, [9])).toBeUndefined()
  })

  it('updates feed xmlUrl in place', () => {
    const doc = parseOpml(sample)
    const next = updateFeedXmlUrl(
      doc,
      [0, 0],
      'https://alpha.example/new-feed.xml',
    )
    expect(flattenFeeds(next.outlines)[0]?.xmlUrl).toBe(
      'https://alpha.example/new-feed.xml',
    )
  })

  it('removes empty folders after feed prune', () => {
    const doc = parseOpml(sample)
    const emptied = removeFeedsByXmlUrls(doc, [
      'https://alpha.example/feed.xml',
      'https://beta.example/rss',
    ])
    expect(emptied.outlines.some((n) => n.kind === 'folder' && n.text === 'News')).toBe(
      true,
    )
    const { document: cleaned, removed } = removeEmptyFolders(emptied)
    expect(removed).toBe(1)
    expect(cleaned.outlines).toHaveLength(1)
    expect(cleaned.outlines[0]).toMatchObject({
      kind: 'feed',
      xmlUrl: 'https://solo.example/atom.xml',
    })
  })

  it('collapses nested empty folders in one pass', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Nested</title></head>
  <body>
    <outline text="Outer">
      <outline text="Inner">
        <outline text="Gone" xmlUrl="https://gone.example/feed" />
      </outline>
    </outline>
    <outline text="Keep" xmlUrl="https://keep.example/feed" />
  </body>
</opml>`
    const doc = parseOpml(xml)
    const emptied = removeFeedsByXmlUrls(doc, ['https://gone.example/feed'])
    const { document: cleaned, removed } = removeEmptyFolders(emptied)
    expect(removed).toBe(2)
    expect(cleaned.outlines).toHaveLength(1)
    expect(flattenFeeds(cleaned.outlines).map((f) => f.xmlUrl)).toEqual([
      'https://keep.example/feed',
    ])
  })
})

describe('appendFeed / listSectionOptions', () => {
  it('appends into a chosen section', () => {
    const doc = parseOpml(sample)
    const next = appendFeed(
      doc,
      { text: 'Gamma', xmlUrl: 'https://gamma.example/feed' },
      [0],
    )
    const news = outlineAtPath(next.outlines, [0])
    expect(news?.kind).toBe('folder')
    if (news?.kind !== 'folder') return
    expect(news.children.map((c) => (c.kind === 'feed' ? c.xmlUrl : ''))).toContain(
      'https://gamma.example/feed',
    )
  })

  it('lists nested section labels', () => {
    const doc = parseOpml(`<?xml version="1.0"?>
<opml version="2.0"><head><title>x</title></head><body>
  <outline text="Outer"><outline text="Inner">
    <outline text="F" xmlUrl="https://f.example/feed" />
  </outline></outline>
</body></opml>`)
    expect(listSectionOptions(doc.outlines)).toEqual([
      { path: [0], label: 'Outer' },
      { path: [0, 0], label: 'Outer › Inner' },
    ])
  })

  it('appends a category at root and under a parent', () => {
    const doc = parseOpml(sample)
    const top = appendFolder(doc, 'Gadgets')
    expect(top).not.toBeNull()
    expect(top!.path).toEqual([2])
    const nested = appendFolder(top!.document, 'Phones', [0])
    expect(nested).not.toBeNull()
    const news = outlineAtPath(nested!.document.outlines, [0])
    expect(news?.kind).toBe('folder')
    if (news?.kind !== 'folder') return
    expect(news.children.some((c) => c.kind === 'folder' && c.text === 'Phones')).toBe(
      true,
    )
  })

  it('ensureCategoryPath reuses existing folders and creates missing ones', () => {
    const doc = parseOpml(sample)
    const reused = ensureCategoryPath(doc, ['News'])
    expect(reused.path).toEqual([0])
    expect(reused.document.outlines).toHaveLength(2)

    const nested = ensureCategoryPath(doc, ['Gadgets', 'Phones'])
    expect(listSectionOptions(nested.document.outlines).map((s) => s.label)).toEqual(
      expect.arrayContaining(['News', 'Gadgets', 'Gadgets › Phones']),
    )
    expect(nested.path).toEqual([2, 0])
  })

  it('renames a folder in place', () => {
    const doc = parseOpml(sample)
    const next = updateFolderText(doc, [0], 'Headlines')
    expect(outlineAtPath(next.outlines, [0])).toMatchObject({
      kind: 'folder',
      text: 'Headlines',
    })
    expect(flattenFeeds(next.outlines)).toHaveLength(3)
  })

  it('moves a feed into another category and to root', () => {
    const doc = parseOpml(sample)
    const intoNews = moveFeed(doc, [1], [0])
    expect(flattenFeeds(intoNews.outlines).map((f) => f.xmlUrl)).toEqual([
      'https://alpha.example/feed.xml',
      'https://beta.example/rss',
      'https://solo.example/atom.xml',
    ])
    const news = outlineAtPath(intoNews.outlines, [0])
    expect(news?.kind).toBe('folder')
    if (news?.kind !== 'folder') return
    expect(news.children.filter((c) => c.kind === 'feed')).toHaveLength(3)

    const toRoot = moveFeed(intoNews, [0, 0], null)
    expect(toRoot.outlines.some((n) => n.kind === 'feed')).toBe(true)
  })

  it('moves multiple feeds by url into a category', () => {
    const doc = parseOpml(sample)
    const next = moveFeedsByUrls(
      doc,
      ['https://solo.example/atom.xml', 'https://beta.example/rss'],
      [0],
    )
    const news = outlineAtPath(next.outlines, [0])
    expect(news?.kind).toBe('folder')
    if (news?.kind !== 'folder') return
    expect(news.children.filter((c) => c.kind === 'feed').map((c) => c.xmlUrl)).toEqual([
      'https://alpha.example/feed.xml',
      'https://beta.example/rss',
      'https://solo.example/atom.xml',
    ])
    expect(next.outlines.some((n) => n.kind === 'feed')).toBe(false)
  })
})

describe('opmlDownloadFilename', () => {
  it('uses the OPML title as the download name', () => {
    expect(opmlDownloadFilename('Miniflux-0826')).toBe('Miniflux-0826.opml')
  })

  it('sanitizes unsafe characters and falls back when empty', () => {
    expect(opmlDownloadFilename('My Feeds: Aug/26')).toBe('My-Feeds-Aug-26.opml')
    expect(opmlDownloadFilename('  ')).toBe('diverss-export.opml')
    expect(opmlDownloadFilename('already.opml')).toBe('already.opml')
  })
})
