import { describe, expect, it, vi, beforeEach } from 'vitest'
import { scoreUrls } from './client'
import { CONNECTIONS_KEY, saveRsshubConnection } from '@/tools/connections'

describe('scoreUrls', () => {
  beforeEach(() => {
    localStorage.removeItem(CONNECTIONS_KEY)
  })

  it('chunks batches of 25 and merges results', async () => {
    const urls = Array.from({ length: 30 }, (_, i) => `https://ex.example/f${i}.xml`)
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { urls: string[] }
      return {
        ok: true,
        json: async () => ({
          results: body.urls.map((xmlUrl) => ({
            schemaVersion: 1,
            xmlUrl,
            health: 'ok',
            reason: 'ok',
            velocityUnknown: true,
            scoredAt: new Date().toISOString(),
          })),
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('VITE_SCORE_URL', 'https://score.example')

    const results = await scoreUrls(urls)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(results).toHaveLength(30)
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('omits rsshubBases when no RSSHub connection is configured', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ results: [] }) }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('VITE_SCORE_URL', 'https://score.example')

    await scoreUrls(['https://ex.example/f.xml'])
    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(String((init as RequestInit).body))
    expect(body).not.toHaveProperty('rsshubBases')

    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('includes rsshubBases on every chunk when an RSSHub connection is configured', async () => {
    saveRsshubConnection(['https://rsshub.app', 'https://rfeed.jonxo.dev'])
    const urls = Array.from({ length: 30 }, (_, i) => `https://ex.example/f${i}.xml`)
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ results: [] }) }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('VITE_SCORE_URL', 'https://score.example')

    await scoreUrls(urls)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    for (const call of fetchMock.mock.calls) {
      const body = JSON.parse(String((call[1] as RequestInit).body))
      expect(body.rsshubBases).toEqual(['https://rsshub.app', 'https://rfeed.jonxo.dev'])
    }

    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })
})
