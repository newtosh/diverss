import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { readerFetch, ReaderTransportError } from './transport'

describe('readerFetch', () => {
  const originalEnv = import.meta.env.VITE_SCORE_URL

  beforeEach(() => {
    vi.stubEnv('VITE_SCORE_URL', 'https://score.test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    if (originalEnv !== undefined) {
      vi.stubEnv('VITE_SCORE_URL', originalEnv)
    }
  })

  it('returns direct success without calling proxy', async () => {
    const fetchImpl = vi.fn(async () => new Response('ok-body', { status: 200 }))
    const result = await readerFetch(
      'https://reader.example/v1/me',
      { headers: { 'X-Auth-Token': 't' } },
      fetchImpl,
    )
    expect(result).toEqual({ status: 200, bodyText: 'ok-body', via: 'direct' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(String(fetchImpl.mock.calls[0]![0])).toBe('https://reader.example/v1/me')
  })

  it('retries via proxy when direct fetch throws', async () => {
    const fetchImpl = vi.fn(async (input: string) => {
      if (String(input).includes('/proxy')) {
        return new Response(
          JSON.stringify({ status: 200, bodyText: 'proxied', headers: {} }),
          { status: 200 },
        )
      }
      throw new TypeError('Failed to fetch')
    })
    const result = await readerFetch('https://reader.example/v1/me', {}, fetchImpl)
    expect(result.via).toBe('proxy')
    expect(result.bodyText).toBe('proxied')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('errors clearly when direct fails and Worker URL is missing', async () => {
    vi.stubEnv('VITE_SCORE_URL', '')
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(
      readerFetch('https://reader.example/v1/me', {}, fetchImpl),
    ).rejects.toBeInstanceOf(ReaderTransportError)
  })
})
