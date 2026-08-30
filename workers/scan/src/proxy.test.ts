import { describe, expect, it, vi } from 'vitest'
import {
  assertProxyTargetUrl,
  forwardProxyRequest,
  parseProxyBody,
} from './proxy'

describe('proxy helpers', () => {
  it('parses a valid proxy body', () => {
    expect(
      parseProxyBody({
        url: 'https://miniflux.example/v1/me',
        method: 'get',
        headers: { 'X-Auth-Token': 't' },
        body: null,
      }),
    ).toEqual({
      url: 'https://miniflux.example/v1/me',
      method: 'GET',
      headers: { 'X-Auth-Token': 't' },
      body: null,
    })
  })

  it('rejects non-http(s) targets', () => {
    expect(assertProxyTargetUrl('file:///etc/passwd')).toBeNull()
    expect(assertProxyTargetUrl('https://ok.example/path')).not.toBeNull()
  })

  it('forwards and returns upstream status/body', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('{"ok":true}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )
    const result = await forwardProxyRequest(
      {
        url: 'https://miniflux.example/v1/me',
        method: 'GET',
        headers: { 'X-Auth-Token': 'secret' },
        body: null,
      },
      fetchImpl as unknown as typeof fetch,
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.status).toBe(200)
      expect(result.bodyText).toBe('{"ok":true}')
    }
    expect(fetchImpl).toHaveBeenCalledOnce()
    const [, init] = fetchImpl.mock.calls[0]!
    expect((init as RequestInit).headers).toBeInstanceOf(Headers)
    expect(
      ((init as RequestInit).headers as Headers).get('X-Auth-Token'),
    ).toBe('secret')
  })

  it('rejects invalid URL before fetch', async () => {
    const result = await forwardProxyRequest({
      url: 'not-a-url',
      method: 'GET',
      headers: {},
      body: null,
    })
    expect(result).toEqual({ ok: false, error: 'invalid_url', status: 400 })
  })
})
