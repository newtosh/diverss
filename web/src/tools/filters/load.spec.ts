import { describe, expect, it, vi } from 'vitest'
import { loadFilterPacks } from './load'

describe('loadFilterPacks', () => {
  it('loads manifest then each pack file', async () => {
    const fetchImpl = vi.fn(async (input: string) => {
      const url = String(input)
      if (url.endsWith('filter-packs/index.json')) {
        return new Response(
          JSON.stringify({
            schemaVersion: 1,
            packs: ['fortnite-chapter'],
          }),
          { status: 200 },
        )
      }
      if (url.endsWith('filter-packs/fortnite-chapter.json')) {
        return new Response(
          JSON.stringify({
            schemaVersion: 1,
            id: 'fortnite-chapter',
            name: 'Fortnite Chapter',
            mode: 'block',
            pattern: 'Fortnite Chapter',
            patternKind: 'keyword',
            fields: ['title'],
            scope: { global: false },
          }),
          { status: 200 },
        )
      }
      return new Response('missing', { status: 404 })
    })
    const packs = await loadFilterPacks(
      fetchImpl as unknown as typeof fetch,
    )
    expect(packs).toHaveLength(1)
    expect(packs[0]?.id).toBe('fortnite-chapter')
  })
})
