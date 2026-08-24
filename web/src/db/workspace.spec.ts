import { describe, it, expect, beforeEach } from 'vitest'
import { db, loadWorkspace, saveWorkspace, clearWorkspace } from './workspace'
import { emptyOpmlDocument } from '@/opml/types'

describe('workspace persistence', () => {
  beforeEach(async () => {
    await clearWorkspace()
    await db.workspace.clear()
  })

  it('returns empty document when nothing saved', async () => {
    const doc = await loadWorkspace()
    expect(doc).toEqual(emptyOpmlDocument())
  })

  it('restores saved workspace (AE4)', async () => {
    const saved = {
      title: 'My list',
      outlines: [
        {
          kind: 'feed' as const,
          text: 'Alpha',
          xmlUrl: 'https://alpha.example/feed.xml',
        },
      ],
    }
    await saveWorkspace(saved)
    const loaded = await loadWorkspace()
    expect(loaded).toEqual(saved)
  })
})
