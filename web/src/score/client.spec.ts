import { describe, expect, it, vi } from 'vitest'
import { scoreUrls } from './client'

describe('scoreUrls', () => {
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
})
