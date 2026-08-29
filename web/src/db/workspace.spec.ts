import { describe, it, expect, beforeEach } from 'vitest'
import {
  db,
  loadWorkspace,
  loadWorkspaceSnapshot,
  saveWorkspace,
  saveWorkspaceSnapshot,
  clearWorkspace,
  LOCAL_BACKUP_KEY,
  workspaceEpoch,
} from './workspace'
import { emptyOpmlDocument } from '@/opml/types'

describe('workspace persistence', () => {
  beforeEach(async () => {
    await clearWorkspace()
    await db.workspace.clear()
    localStorage.removeItem(LOCAL_BACKUP_KEY)
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

  it('bumps workspaceEpoch on each save so KeepAlive views can resync', async () => {
    const before = workspaceEpoch.value
    await saveWorkspace({
      title: 'Synced',
      outlines: [
        {
          kind: 'feed',
          text: 'Alpha',
          xmlUrl: 'https://alpha.example/feed.xml',
        },
      ],
    })
    expect(workspaceEpoch.value).toBe(before + 1)
    const snap = await saveWorkspaceSnapshot({
      document: emptyOpmlDocument(),
      scores: {},
      timeframe: '7d',
    })
    expect(workspaceEpoch.value).toBe(before + 2)
    expect(snap.updatedAt).toBeGreaterThan(0)
  })

  it('dual-writes localStorage backup and restores scores', async () => {
    const document = {
      title: 'Cached',
      outlines: [
        {
          kind: 'feed' as const,
          text: 'Alpha',
          xmlUrl: 'https://alpha.example/feed.xml',
        },
      ],
    }
    const scores = {
      'https://alpha.example/feed.xml': {
        schemaVersion: 2,
        xmlUrl: 'https://alpha.example/feed.xml',
        health: 'ok' as const,
        reason: 'ok' as const,
        velocityUnknown: false,
        posts7d: 2,
        scannedAt: '2026-08-24T00:00:00Z',
      },
    }
    await saveWorkspaceSnapshot({ document, scores, timeframe: '30d' })

    const raw = localStorage.getItem(LOCAL_BACKUP_KEY)
    expect(raw).toBeTruthy()
    expect(JSON.parse(String(raw)).document.title).toBe('Cached')

    await db.workspace.clear()
    const snap = await loadWorkspaceSnapshot()
    expect(snap.document.title).toBe('Cached')
    expect(snap.scores['https://alpha.example/feed.xml']?.health).toBe('ok')
    expect(snap.timeframe).toBe('30d')
  })
})
