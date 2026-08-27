import { describe, expect, it } from 'vitest'
import { createMockMinifluxAdapter } from './mockMiniflux'
import { applyPackToAdapter } from '../filters/apply'
import type { FilterPack } from '../filters/types'

describe('createMockMinifluxAdapter', () => {
  it('summarizes sample feeds and categories', async () => {
    const adapter = createMockMinifluxAdapter()
    const summary = await adapter.summarize()
    expect(summary.feedCount).toBeGreaterThan(0)
    expect(summary.categoryCount).toBeGreaterThan(0)
    expect(summary.lastErrors.length).toBeGreaterThan(0)
  })

  it('accepts filter apply and merges blocklist lines', async () => {
    const adapter = createMockMinifluxAdapter()
    const pack: FilterPack = {
      schemaVersion: 1,
      id: 'fortnite-chapter',
      name: 'Fortnite Chapter',
      mode: 'block',
      pattern: 'Fortnite Chapter',
      patternKind: 'keyword',
      fields: ['title'],
      scope: { global: true },
    }
    const result = await applyPackToAdapter(pack, adapter)
    expect(result.feedsTouched).toBeGreaterThan(0)
    expect(result.errors).toEqual([])
    const feeds = await adapter.listFeeds()
    expect(
      feeds.every((f) =>
        (f.blocklistRules ?? '').includes('EntryTitle=(?i)Fortnite Chapter'),
      ),
    ).toBe(true)
  })
})
