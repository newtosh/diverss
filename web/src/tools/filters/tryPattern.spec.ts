import { describe, expect, it } from 'vitest'
import {
  compileBrowserRegex,
  findMatches,
  highlightSegments,
  tryPatternAgainstSamples,
} from './tryPattern'

describe('tryPattern', () => {
  it('compiles keyword as case-insensitive literal', () => {
    const c = compileBrowserRegex('Fortnite Chapter', 'keyword')
    expect('regex' in c).toBe(true)
    if (!('regex' in c)) return
    expect(c.regex.test('fortnite chapter spoilers')).toBe(true)
  })

  it('strips /…/ wrappers for regex packs', () => {
    const c = compileBrowserRegex('/(?=.*iPhone)(?=.*trick)/', 'regex')
    expect('regex' in c).toBe(true)
    if (!('regex' in c)) return
    expect(c.regex.test('iPhone camera trick')).toBe(true)
    expect(c.regex.test('Android tip')).toBe(false)
  })

  it('compiles shipped iPhone SEO pattern in browser preview', () => {
    const c = compileBrowserRegex(
      '/(?:(?:iPhone|iOS).*(?:feature|ability|trick)|(?:feature|ability|trick).*(?:iPhone|iOS))/',
      'regex',
    )
    expect('regex' in c).toBe(true)
    if (!('regex' in c)) return
    expect(c.regex.test('New iPhone feature revealed')).toBe(true)
    expect(c.regex.test('iPhone review')).toBe(false)
  })

  it('surfaces compile errors', () => {
    const c = compileBrowserRegex('([unbalanced', 'regex')
    expect('error' in c).toBe(true)
  })

  it('highlights match spans without overlapping', () => {
    const re = /hit/gi
    const matches = findMatches(re, 'hit and HIT again')
    expect(matches).toHaveLength(2)
    const segs = highlightSegments('hit and HIT again', matches)
    expect(segs.filter((s) => s.hit).map((s) => s.text)).toEqual(['hit', 'HIT'])
  })

  it('tries multiple samples', () => {
    const r = tryPatternAgainstSamples('streaming', 'keyword', [
      'Now streaming free',
      'No match here',
    ])
    expect(r.error).toBeNull()
    expect(r.rows[0]?.matchCount).toBe(1)
    expect(r.rows[1]?.matchCount).toBe(0)
  })
})
