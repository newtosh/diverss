import { describe, expect, it } from 'vitest'
import { feedMirrorsFor } from './mirrors'

describe('feedMirrorsFor', () => {
  it('returns Feedburner for css-tricks.com feed URLs', () => {
    expect(feedMirrorsFor('https://css-tricks.com/feed/')).toEqual([
      'https://feeds.feedburner.com/CssTricks',
    ])
    expect(feedMirrorsFor('https://www.css-tricks.com/feed/')).toEqual([
      'https://feeds.feedburner.com/CssTricks',
    ])
  })

  it('returns empty for unknown hosts', () => {
    expect(feedMirrorsFor('https://example.com/feed')).toEqual([])
  })
})
