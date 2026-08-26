import { describe, expect, it, beforeEach } from 'vitest'
import {
  CONNECTIONS_KEY,
  clearConnection,
  loadConnections,
  normalizeBaseUrl,
  saveConnection,
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
})
