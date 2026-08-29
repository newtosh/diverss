import { describe, expect, it } from 'vitest'
import { buildRebuildCandidates, rsshubCandidates } from './rsshub'

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

describe('buildRebuildCandidates', () => {
  it('returns a candidate for an unrelated host against one base', () => {
    expect(
      buildRebuildCandidates('https://rfeed.jonxo.dev/picuki/profile/x', [
        'https://rsshub.newto.sh',
      ]),
    ).toEqual(['https://rsshub.newto.sh/picuki/profile/x'])
  })

  it('returns candidates in order for three bases', () => {
    expect(
      buildRebuildCandidates('https://dead.example/picuki/profile/x', [
        'https://a.example',
        'https://b.example',
        'https://c.example',
      ]),
    ).toEqual([
      'https://a.example/picuki/profile/x',
      'https://b.example/picuki/profile/x',
      'https://c.example/picuki/profile/x',
    ])
  })

  it('skips a base matching the feed host, keeps the rest', () => {
    expect(
      buildRebuildCandidates('https://a.example/feed', [
        'https://a.example',
        'https://b.example',
      ]),
    ).toEqual(['https://b.example/feed'])
  })

  it('returns [] for an unparseable url', () => {
    expect(buildRebuildCandidates('not a url', ['https://rsshub.app'])).toEqual([])
  })

  it('preserves path and query string across the swap', () => {
    expect(
      buildRebuildCandidates('https://dead.example/instagram/tags/x?limit=20', [
        'https://rsshub.newto.sh',
      ]),
    ).toEqual(['https://rsshub.newto.sh/instagram/tags/x?limit=20'])
  })
})
