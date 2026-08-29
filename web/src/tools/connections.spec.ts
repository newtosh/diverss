import { describe, expect, it, beforeEach } from 'vitest'
import {
  CONNECTIONS_KEY,
  clearConnection,
  clearRsshubConnection,
  defaultRsshubConnection,
  loadConnections,
  normalizeBaseUrl,
  saveConnection,
  saveRsshubConnection,
} from './connections'

describe('connections store', () => {
  beforeEach(() => {
    localStorage.removeItem(CONNECTIONS_KEY)
  })

  it('normalizes trailing slashes on base URLs', () => {
    expect(normalizeBaseUrl('https://rss.example/')).toBe('https://rss.example')
    expect(normalizeBaseUrl(' https://rss.example/// ')).toBe(
      'https://rss.example',
    )
  })

  it('round-trips Miniflux token record', () => {
    saveConnection('miniflux', {
      baseUrl: 'https://miniflux.example/',
      token: ' secret ',
    })
    expect(loadConnections().miniflux).toEqual({
      baseUrl: 'https://miniflux.example',
      token: 'secret',
    })
  })

  it('round-trips FreshRSS credentials', () => {
    saveConnection('freshrss', {
      baseUrl: 'https://fresh.example/api/greader.php',
      username: 'alice',
      apiPassword: 'api-pass',
    })
    expect(loadConnections().freshrss).toEqual({
      baseUrl: 'https://fresh.example/api/greader.php',
      username: 'alice',
      apiPassword: 'api-pass',
    })
  })

  it('clearConnection removes one reader without wiping the other', () => {
    saveConnection('miniflux', {
      baseUrl: 'https://m.example',
      token: 't',
    })
    saveConnection('freshrss', {
      baseUrl: 'https://f.example',
      username: 'u',
      apiPassword: 'p',
    })
    clearConnection('miniflux')
    const next = loadConnections()
    expect(next.miniflux).toBeUndefined()
    expect(next.freshrss?.username).toBe('u')
  })

  it('corrupt JSON yields empty store without throw', () => {
    localStorage.setItem(CONNECTIONS_KEY, '{not-json')
    expect(loadConnections()).toEqual({})
  })

  it('defaultRsshubConnection seeds the public instance', () => {
    expect(defaultRsshubConnection()).toEqual({ bases: ['https://rsshub.app'] })
  })

  it('round-trips an rsshub base list in priority order', () => {
    saveRsshubConnection(['https://rfeed.jonxo.dev/', 'https://rsshub.app'])
    expect(loadConnections().rsshub).toEqual({
      bases: ['https://rfeed.jonxo.dev', 'https://rsshub.app'],
    })
  })

  it('saveRsshubConnection normalizes and dedupes bases', () => {
    saveRsshubConnection(['https://rsshub.app/', 'https://rsshub.app', ' https://hub.example '])
    expect(loadConnections().rsshub?.bases).toEqual([
      'https://rsshub.app',
      'https://hub.example',
    ])
  })

  it('clearRsshubConnection removes only the rsshub entry', () => {
    saveConnection('miniflux', { baseUrl: 'https://m.example', token: 't' })
    saveRsshubConnection(['https://rsshub.app'])
    clearRsshubConnection()
    const next = loadConnections()
    expect(next.rsshub).toBeUndefined()
    expect(next.miniflux?.token).toBe('t')
  })

  it('malformed stored rsshub value is dropped, not thrown', () => {
    localStorage.setItem(
      CONNECTIONS_KEY,
      JSON.stringify({ rsshub: { bases: 'not-an-array' } }),
    )
    expect(loadConnections().rsshub).toBeUndefined()
  })
})
