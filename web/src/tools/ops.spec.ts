import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OpmlDocument } from '@/opml/types'
import { clearOutbox, getOutboxEntries } from '@/outbox/store'
import type { ReaderAdapter } from './types'
import {
  WipeGuardError,
  WipeIncompleteError,
  pullFromReader,
  pushToReader,
  wipeFeeds,
} from './ops'

function mockAdapter(partial: Partial<ReaderAdapter>): ReaderAdapter {
  return {
    id: 'miniflux',
    test: vi.fn(),
    exportOpml: vi.fn(),
    importOpml: vi.fn(),
    listFeeds: vi.fn(async () => []),
    deleteFeed: vi.fn(),
    listCategories: vi.fn(async () => []),
    deleteCategory: vi.fn(),
    summarize: vi.fn(async () => ({ feedCount: 0, lastErrors: [] })),
    ...partial,
  }
}

const emptyWs: OpmlDocument = { title: 'WS', outlines: [] }

describe('ops wipe gate', () => {
  it('refuses wipe without backup', async () => {
    const adapter = mockAdapter({})
    await expect(
      wipeFeeds(adapter, { backupCompleted: false, confirmed: true }),
    ).rejects.toBeInstanceOf(WipeGuardError)
  })

  it('refuses wipe without confirm', async () => {
    const adapter = mockAdapter({})
    await expect(
      wipeFeeds(adapter, { backupCompleted: true, confirmed: false }),
    ).rejects.toBeInstanceOf(WipeGuardError)
  })

  it('reports progress while wiping', async () => {
    const progress: Array<[number, number]> = []
    let listed = 0
    const adapter = mockAdapter({
      listFeeds: vi.fn(async () => {
        listed++
        // First list: two feeds. After deletes: empty (verify).
        if (listed === 1) {
          return [
            { id: '1', title: 'A', xmlUrl: 'https://a.example/f.xml' },
            { id: '2', title: 'B', xmlUrl: 'https://b.example/f.xml' },
          ]
        }
        return []
      }),
      deleteFeed: vi.fn(async () => {}),
    })
    const wipe = await wipeFeeds(adapter, {
      backupCompleted: true,
      confirmed: true,
      onProgress: (done, total) => progress.push([done, total]),
    })
    expect(wipe).toEqual({ before: 2, remaining: 0, verified: true })
    expect(progress[0]).toEqual([0, 2])
    expect(progress.at(-1)).toEqual([2, 2])
    expect(adapter.deleteFeed).toHaveBeenCalledTimes(2)
  })

  it('throws when feeds remain after delete', async () => {
    const adapter = mockAdapter({
      listFeeds: vi.fn(async () => [
        { id: '1', title: 'A', xmlUrl: 'https://a.example/f.xml' },
      ]),
      deleteFeed: vi.fn(async () => {}),
    })
    await expect(
      wipeFeeds(adapter, { backupCompleted: true, confirmed: true }),
    ).rejects.toBeInstanceOf(WipeIncompleteError)
  })
})

describe('pushToReader', () => {
  it('replace wipes then imports', async () => {
    const order: string[] = []
    let listed = 0
    const adapter = mockAdapter({
      listFeeds: vi.fn(async () => {
        listed++
        if (listed === 1) {
          return [{ id: '1', title: 'A', xmlUrl: 'https://a.example/f.xml' }]
        }
        return []
      }),
      deleteFeed: vi.fn(async () => {
        order.push('delete')
      }),
      importOpml: vi.fn(async () => {
        order.push('import')
      }),
    })
    const summary = await pushToReader(
      adapter,
      {
        title: 'WS',
        outlines: [
          {
            kind: 'feed',
            text: 'B',
            xmlUrl: 'https://b.example/f.xml',
          },
        ],
      },
      'replace',
      { backupCompleted: true, confirmed: true },
    )
    expect(summary.wiped).toBe(1)
    expect(order).toEqual(['delete', 'import'])
  })

  it('merge does not wipe', async () => {
    const adapter = mockAdapter({
      listFeeds: vi.fn(async () => {
        throw new Error('should not list')
      }),
      importOpml: vi.fn(async () => {}),
    })
    await pushToReader(adapter, emptyWs, 'merge')
    expect(adapter.importOpml).toHaveBeenCalledOnce()
    expect(adapter.listFeeds).not.toHaveBeenCalled()
  })
})

describe('pullFromReader', () => {
  beforeEach(() => {
    clearOutbox()
  })

  it('stage produces Outbox entries', async () => {
    const opml = `<?xml version="1.0"?>
<opml version="2.0"><head><title>R</title></head><body>
  <outline text="News">
    <outline type="rss" text="Alpha" xmlUrl="https://alpha.example/feed.xml"/>
  </outline>
</body></opml>`
    const adapter = mockAdapter({
      exportOpml: vi.fn(async () => opml),
    })
    const summary = await pullFromReader(adapter, emptyWs, 'stage')
    expect(summary.staged).toBe(1)
    expect(getOutboxEntries().some((e) => e.xmlUrl.includes('alpha'))).toBe(
      true,
    )
  })

  it('merge skips existing membership', async () => {
    const opml = `<?xml version="1.0"?>
<opml version="2.0"><head><title>R</title></head><body>
  <outline type="rss" text="Alpha" xmlUrl="https://alpha.example/feed.xml"/>
  <outline type="rss" text="Beta" xmlUrl="https://beta.example/feed.xml"/>
</body></opml>`
    const workspace: OpmlDocument = {
      title: 'WS',
      outlines: [
        {
          kind: 'feed',
          text: 'Alpha',
          xmlUrl: 'https://alpha.example/feed.xml',
        },
      ],
    }
    const adapter = mockAdapter({
      exportOpml: vi.fn(async () => opml),
    })
    const summary = await pullFromReader(adapter, workspace, 'merge')
    expect(summary.added).toBe(1)
    expect(summary.skipped).toBe(1)
    expect(summary.document?.outlines).toHaveLength(2)
  })
})
