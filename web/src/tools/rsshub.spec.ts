import { describe, expect, it } from 'vitest'
import { rsshubCandidates } from './rsshub'

describe('rsshubCandidates', () => {
  it('returns bases in priority order when the feed host matches a lower-priority base', () => {
    const candidates = rsshubCandidates('https://rfeed.jonxo.dev/picuki/profile/alexotos', [
      'https://rsshub.app',
      'https://rfeed.jonxo.dev',
    ])
    expect(candidates).toEqual([
      'https://rsshub.app/picuki/profile/alexotos',
    ])
  })

  it('returns [] when the feed host matches no configured base', () => {
    expect(
      rsshubCandidates('https://example.com/feed', ['https://rsshub.app']),
    ).toEqual([])
  })

  it('skips a candidate identical to the original url', () => {
    const candidates = rsshubCandidates('https://rsshub.app/picuki/profile/alexotos', [
      'https://rsshub.app',
      'https://rfeed.jonxo.dev',
    ])
    expect(candidates).toEqual(['https://rfeed.jonxo.dev/picuki/profile/alexotos'])
  })

  it('preserves path and query string across the host swap', () => {
    const candidates = rsshubCandidates(
      'https://rfeed.jonxo.dev/instagram/tags/mechanicalkeyboards?limit=20',
      ['https://rsshub.app', 'https://rfeed.jonxo.dev'],
    )
    expect(candidates).toEqual([
      'https://rsshub.app/instagram/tags/mechanicalkeyboards?limit=20',
    ])
  })

  it('matches hosts case-insensitively', () => {
    const candidates = rsshubCandidates('https://RFeed.Jonxo.Dev/picuki/profile/x', [
      'https://rfeed.jonxo.dev',
      'https://rsshub.app',
    ])
    expect(candidates).toEqual(['https://rsshub.app/picuki/profile/x'])
  })

  it('returns [] for an unparseable url', () => {
    expect(rsshubCandidates('not a url', ['https://rsshub.app'])).toEqual([])
  })
})
