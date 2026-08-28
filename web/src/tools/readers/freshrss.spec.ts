import { describe, expect, it, vi } from 'vitest'
import { createFreshRssAdapter, freshrssApiRoot } from './freshrss'

describe('freshrss adapter', () => {
  it('normalizes API root to greader.php', () => {
    expect(freshrssApiRoot('https://fresh.example')).toBe(
      'https://fresh.example/api/greader.php',
    )
    expect(freshrssApiRoot('https://fresh.example/api/greader.php/')).toBe(
      'https://fresh.example/api/greader.php',
    )
  })

  it('surfaces ClientLogin failure', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('Error=BadAuthentication', { status: 403 }),
    )
    const adapter = createFreshRssAdapter(
      {
        baseUrl: 'https://fresh.example',
        username: 'alice',
        apiPassword: 'wrong',
      },
      fetchImpl,
    )
    await expect(adapter.test()).rejects.toThrow(/API password/i)
  })

  it('calls export with GoogleLogin auth header after login', async () => {
    const fetchImpl = vi.fn(async (input: string, _init?: RequestInit) => {
      const url = String(input)
      if (url.includes('ClientLogin')) {
        return new Response('SID=x\nAuth=alice/token\n', { status: 200 })
      }
      return new Response('<opml/>', { status: 200 })
    })
    const adapter = createFreshRssAdapter(
      {
        baseUrl: 'https://fresh.example',
        username: 'alice',
        apiPassword: 'ok',
      },
      fetchImpl,
    )
    await expect(adapter.exportOpml()).resolves.toBe('<opml/>')
    const exportCall = fetchImpl.mock.calls.find((c) =>
      String(c[0]).includes('subscription/export'),
    )
    expect(exportCall).toBeTruthy()
    const headers = (exportCall![1] as RequestInit).headers as Record<
      string,
      string
    >
    expect(headers.Authorization).toBe('GoogleLogin auth=alice/token')
  })
})
