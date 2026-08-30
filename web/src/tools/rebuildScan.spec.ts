import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { applyRebuildCandidate, scanForRebuilds } from './rebuildScan'
import { db, clearWorkspace, loadWorkspaceSnapshot, saveWorkspaceSnapshot } from '@/db/workspace'
import type { OpmlDocument } from '@/opml/types'
import type { ScanResult } from '@/scan/client'
import { CONNECTIONS_KEY, saveRsshubConnection } from '@/tools/connections'

function feedDoc(feeds: { xmlUrl: string; text: string }[]): OpmlDocument {
  return {
    title: 'Test',
    outlines: feeds.map((f) => ({ kind: 'feed' as const, ...f })),
  }
}

function score(xmlUrl: string, health: ScanResult['health']): ScanResult {
  return {
    schemaVersion: 1,
    xmlUrl,
    health,
    reason: health === 'unhealthy' ? 'http_status' : 'ok',
    velocityUnknown: true,
    scannedAt: new Date().toISOString(),
  }
}

/** Stub scanUrls' transport: fetch to /api/score, respond per-url via a lookup. */
function stubScoreApi(healthByUrl: Record<string, ScanResult['health']>) {
  vi.stubEnv('VITE_SCAN_URL', 'https://score.example')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { urls: string[] }
      return {
        ok: true,
        json: async () => ({
          results: body.urls.map((xmlUrl) => score(xmlUrl, healthByUrl[xmlUrl] ?? 'unhealthy')),
        }),
      }
    }),
  )
}

beforeEach(async () => {
  await clearWorkspace()
  await db.workspace.clear()
  localStorage.removeItem(CONNECTIONS_KEY)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('scanForRebuilds', () => {
  it('finds a working candidate on the first base', async () => {
    const doc = feedDoc([{ xmlUrl: 'https://dead.example/feed', text: 'Feed A' }])
    const scores = { 'https://dead.example/feed': score('https://dead.example/feed', 'unhealthy') }
    stubScoreApi({ 'https://good.example/feed': 'ok' })

    const results = await scanForRebuilds(doc, scores, ['https://good.example'])
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      xmlUrl: 'https://dead.example/feed',
      candidateUrl: 'https://good.example/feed',
    })
  })

  it('falls through to the second base when the first fails', async () => {
    const doc = feedDoc([{ xmlUrl: 'https://dead.example/feed', text: 'Feed A' }])
    const scores = { 'https://dead.example/feed': score('https://dead.example/feed', 'unhealthy') }
    stubScoreApi({
      'https://also-dead.example/feed': 'unhealthy',
      'https://good.example/feed': 'ok',
    })

    const results = await scanForRebuilds(doc, scores, [
      'https://also-dead.example',
      'https://good.example',
    ])
    expect(results).toHaveLength(1)
    expect(results[0]?.candidateUrl).toBe('https://good.example/feed')
  })

  it('omits a feed with no working candidate on any base (AE2)', async () => {
    const doc = feedDoc([{ xmlUrl: 'https://dead.example/feed', text: 'Feed A' }])
    const scores = { 'https://dead.example/feed': score('https://dead.example/feed', 'unhealthy') }
    stubScoreApi({}) // every candidate scores unhealthy (default)

    const results = await scanForRebuilds(doc, scores, ['https://also-dead.example'])
    expect(results).toEqual([])
  })

  it('never includes a healthy feed in trial-fetch batches', async () => {
    const doc = feedDoc([{ xmlUrl: 'https://healthy.example/feed', text: 'Healthy' }])
    const scores = { 'https://healthy.example/feed': score('https://healthy.example/feed', 'ok') }
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('VITE_SCAN_URL', 'https://score.example')

    const results = await scanForRebuilds(doc, scores, ['https://good.example'])
    expect(results).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('only re-tries the still-unresolved feed against the second base', async () => {
    const doc = feedDoc([
      { xmlUrl: 'https://dead.example/a', text: 'A' },
      { xmlUrl: 'https://dead.example/b', text: 'B' },
    ])
    const scores = {
      'https://dead.example/a': score('https://dead.example/a', 'unhealthy'),
      'https://dead.example/b': score('https://dead.example/b', 'unhealthy'),
    }
    let secondBaseUrls: string[] = []
    vi.stubEnv('VITE_SCAN_URL', 'https://score.example')
    let call = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { urls: string[] }
        call++
        if (call === 2) secondBaseUrls = body.urls
        const healthByUrl: Record<string, ScanResult['health']> =
          call === 1
            ? { 'https://base1.example/a': 'ok' }
            : { 'https://base2.example/b': 'ok' }
        return {
          ok: true,
          json: async () => ({
            results: body.urls.map((xmlUrl) => score(xmlUrl, healthByUrl[xmlUrl] ?? 'unhealthy')),
          }),
        }
      }),
    )

    const results = await scanForRebuilds(doc, scores, ['https://base1.example', 'https://base2.example'])
    expect(results).toHaveLength(2)
    expect(secondBaseUrls).toEqual(['https://base2.example/b'])
  })

  it('suppresses the Worker rsshub fallback so a candidate is judged on its own base', async () => {
    // Even with a broader RSSHub connection saved, a candidate under test
    // must not silently pass via the Worker retrying a *different*
    // configured base — that would defeat the per-base pass logic.
    saveRsshubConnection(['https://base1.example', 'https://other-configured.example'])
    const doc = feedDoc([{ xmlUrl: 'https://dead.example/feed', text: 'A' }])
    const scores = { 'https://dead.example/feed': score('https://dead.example/feed', 'unhealthy') }
    let sentBody: { rsshubBases?: unknown } = {}
    vi.stubEnv('VITE_SCAN_URL', 'https://score.example')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        sentBody = JSON.parse(String(init?.body)) as { urls: string[]; rsshubBases?: unknown }
        return { ok: true, json: async () => ({ results: [] }) }
      }),
    )

    await scanForRebuilds(doc, scores, ['https://base1.example'])
    expect(sentBody).not.toHaveProperty('rsshubBases')
  })

  it('returns [] without calling scanUrls when no bases are configured', async () => {
    const doc = feedDoc([{ xmlUrl: 'https://dead.example/feed', text: 'A' }])
    const scores = { 'https://dead.example/feed': score('https://dead.example/feed', 'unhealthy') }
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const results = await scanForRebuilds(doc, scores, [])
    expect(results).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('applyRebuildCandidate', () => {
  it('rewrites the workspace xmlUrl and stores the trial score without a second fetch', async () => {
    const doc = feedDoc([{ xmlUrl: 'https://dead.example/feed', text: 'Feed A' }])
    const oldScore = score('https://dead.example/feed', 'unhealthy')
    await saveWorkspaceSnapshot({ document: doc, scores: { 'https://dead.example/feed': oldScore }, timeframe: '7d' })

    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const newScore = score('https://good.example/feed', 'ok')
    const applied = await applyRebuildCandidate({
      xmlUrl: 'https://dead.example/feed',
      title: 'Feed A',
      candidateUrl: 'https://good.example/feed',
      result: newScore,
    })

    expect(applied).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
    const snap = await loadWorkspaceSnapshot()
    expect(snap.document.outlines[0]).toMatchObject({ xmlUrl: 'https://good.example/feed' })
    expect(snap.scores['https://good.example/feed']).toEqual(newScore)
    expect(snap.scores['https://dead.example/feed']).toBeUndefined()
  })

  it('returns false and is a no-op when the feed can no longer be found', async () => {
    const doc = feedDoc([{ xmlUrl: 'https://other.example/feed', text: 'Other' }])
    await saveWorkspaceSnapshot({ document: doc, scores: {}, timeframe: '7d' })

    const applied = await applyRebuildCandidate({
      xmlUrl: 'https://dead.example/feed',
      title: 'Feed A',
      candidateUrl: 'https://good.example/feed',
      result: score('https://good.example/feed', 'ok'),
    })

    expect(applied).toBe(false)
    const snap = await loadWorkspaceSnapshot()
    expect(snap.document.outlines[0]).toMatchObject({ xmlUrl: 'https://other.example/feed' })
  })
})
