import { describe, expect, it } from 'vitest'
import { flattenFeeds } from '@/opml/types'
import { listSectionOptions } from '@/opml/mutate'
import { parseOpml } from '@/opml/parse'
import { importOutbox } from './import'
import type { OutboxEntry } from './types'

function entry(
  partial: Partial<OutboxEntry> & Pick<OutboxEntry, 'xmlUrl' | 'title' | 'destination'>,
): OutboxEntry {
  return {
    id: partial.id ?? crypto.randomUUID(),
    groups: partial.groups ?? [],
    alreadyInWorkspace: partial.alreadyInWorkspace ?? false,
    stagedAt: partial.stagedAt ?? 1,
    htmlUrl: partial.htmlUrl,
    ...partial,
  }
}

const sample = `<?xml version="1.0"?>
<opml version="2.0"><head><title>x</title></head><body>
  <outline text="Apple">
    <outline text="MacRumors" xmlUrl="https://macrumors.com/feed" />
  </outline>
</body></opml>`

describe('importOutbox', () => {
  it('imports into an existing category without creating folders', () => {
    const doc = parseOpml(sample)
    const result = importOutbox(doc, [
      entry({
        title: '9to5Mac',
        xmlUrl: 'https://9to5mac.com/feed',
        destination: { kind: 'existing', path: [0], label: 'Apple' },
      }),
    ])
    expect(result.added).toBe(1)
    expect(result.createdCategories).toEqual([])
    expect(listSectionOptions(result.document.outlines)).toEqual([
      { path: [0], label: 'Apple' },
    ])
    expect(flattenFeeds(result.document.outlines).map((f) => f.xmlUrl)).toContain(
      'https://9to5mac.com/feed',
    )
  })

  it('creates nested categories when missing', () => {
    const doc = parseOpml(sample)
    const result = importOutbox(doc, [
      entry({
        title: 'Sec News',
        xmlUrl: 'https://sec.example/feed',
        destination: { kind: 'new', label: 'A › B' },
      }),
    ])
    expect(result.added).toBe(1)
    expect(result.createdCategories).toEqual(['A', 'A › B'])
    const labels = listSectionOptions(result.document.outlines).map((s) => s.label)
    expect(labels).toContain('A › B')
  })

  it('appends ungrouped feeds at the document root', () => {
    const doc = parseOpml(sample)
    const result = importOutbox(doc, [
      entry({
        title: 'Root Feed',
        xmlUrl: 'https://root.example/feed',
        destination: { kind: 'ungrouped' },
      }),
    ])
    expect(result.added).toBe(1)
    expect(result.document.outlines.some((n) => n.kind === 'feed')).toBe(true)
  })

  it('skips already-present urls and reports counts', () => {
    const doc = parseOpml(sample)
    const result = importOutbox(doc, [
      entry({
        title: 'MacRumors',
        xmlUrl: 'https://macrumors.com/feed',
        destination: { kind: 'existing', path: [0], label: 'Apple' },
        alreadyInWorkspace: true,
      }),
      entry({
        title: 'New',
        xmlUrl: 'https://new.example/feed',
        destination: { kind: 'new', label: 'Gadgets' },
      }),
    ])
    expect(result.added).toBe(1)
    expect(result.skippedAlreadyPresent).toBe(1)
    expect(result.addedIds).toHaveLength(1)
    expect(
      flattenFeeds(result.document.outlines).filter(
        (f) => f.xmlUrl === 'https://macrumors.com/feed',
      ),
    ).toHaveLength(1)
  })
})
