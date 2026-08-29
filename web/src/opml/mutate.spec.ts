import { describe, expect, it } from 'vitest'
import { updateFeedXmlUrlByOldUrl } from './mutate'
import type { OpmlDocument } from './types'

function doc(outlines: OpmlDocument['outlines']): OpmlDocument {
  return { title: 'Test', outlines }
}

describe('updateFeedXmlUrlByOldUrl', () => {
  it('rewrites a top-level feed found by its current url', () => {
    const d = doc([{ kind: 'feed', text: 'A', xmlUrl: 'https://old.example/feed' }])
    const next = updateFeedXmlUrlByOldUrl(d, 'https://old.example/feed', 'https://new.example/feed')
    expect(next.outlines[0]).toMatchObject({ xmlUrl: 'https://new.example/feed' })
  })

  it('rewrites a feed nested inside a folder', () => {
    const d = doc([
      {
        kind: 'folder',
        text: 'Folder',
        children: [{ kind: 'feed', text: 'A', xmlUrl: 'https://old.example/feed' }],
      },
    ])
    const next = updateFeedXmlUrlByOldUrl(d, 'https://old.example/feed', 'https://new.example/feed')
    const folder = next.outlines[0]
    expect(folder.kind).toBe('folder')
    if (folder.kind === 'folder') {
      expect(folder.children[0]).toMatchObject({ xmlUrl: 'https://new.example/feed' })
    }
  })

  it('is a no-op when the old url is not found', () => {
    const d = doc([{ kind: 'feed', text: 'A', xmlUrl: 'https://old.example/feed' }])
    const next = updateFeedXmlUrlByOldUrl(d, 'https://nope.example/feed', 'https://new.example/feed')
    expect(next).toBe(d)
  })

  it('rejects a non-http(s) new url without mutating', () => {
    const d = doc([{ kind: 'feed', text: 'A', xmlUrl: 'https://old.example/feed' }])
    const next = updateFeedXmlUrlByOldUrl(d, 'https://old.example/feed', 'javascript:alert(1)')
    expect(next).toBe(d)
  })

  it('matches the old url regardless of trailing slash (normalizeFeedUrl)', () => {
    const d = doc([{ kind: 'feed', text: 'A', xmlUrl: 'https://old.example/feed/' }])
    const next = updateFeedXmlUrlByOldUrl(d, 'https://old.example/feed', 'https://new.example/feed')
    expect(next.outlines[0]).toMatchObject({ xmlUrl: 'https://new.example/feed' })
  })
})
