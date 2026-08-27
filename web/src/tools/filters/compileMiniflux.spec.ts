import { describe, expect, it } from 'vitest'
import {
  compilePackToMinifluxBlocklist,
  mergeBlocklistLines,
  stripRegexDelimiters,
} from './compileMiniflux'
import { formatPackJson, formatPatternCopy } from './formatCopy'
import type { FilterPack } from './types'

const fortnite: FilterPack = {
  schemaVersion: 1,
  id: 'fortnite-chapter',
  name: 'Fortnite Chapter',
  mode: 'block',
  match: 'any',
  pattern: 'Fortnite Chapter',
  patternKind: 'keyword',
  fields: ['title'],
  scope: { global: false },
}

const iphone: FilterPack = {
  schemaVersion: 1,
  id: 'iphone-seo',
  name: 'iPhone SEO',
  mode: 'block',
  match: 'any',
  pattern: '/(?=.*(?:iPhone|iOS))(?=.*(?:feature|ability|trick))/',
  patternKind: 'regex',
  fields: ['title'],
  scope: { global: false },
}

describe('compilePackToMinifluxBlocklist', () => {
  it('compiles keyword Fortnite to case-insensitive EntryTitle line', () => {
    expect(compilePackToMinifluxBlocklist(fortnite)).toEqual([
      'EntryTitle=(?i)Fortnite Chapter',
    ])
  })

  it('strips /.../ delimiters from regex packs', () => {
    expect(stripRegexDelimiters('/foo/i')).toBe('foo')
    const lines = compilePackToMinifluxBlocklist(iphone)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toBe(
      'EntryTitle=(?=.*(?:iPhone|iOS))(?=.*(?:feature|ability|trick))',
    )
  })

  it('emits EntryTitle and EntryContent for multi-field packs', () => {
    const pack: FilterPack = {
      ...iphone,
      fields: ['title', 'body'],
      pattern: '/(hit)/',
      patternKind: 'regex',
    }
    expect(compilePackToMinifluxBlocklist(pack)).toEqual([
      'EntryTitle=(hit)',
      'EntryContent=(hit)',
    ])
  })

  it('throws on empty pattern', () => {
    expect(() =>
      compilePackToMinifluxBlocklist({ ...fortnite, pattern: '  ' }),
    ).toThrow(/empty/i)
  })
})

describe('mergeBlocklistLines', () => {
  it('appends new lines and skips duplicates', () => {
    const a = mergeBlocklistLines('EntryTitle=a\n', ['EntryTitle=b', 'EntryTitle=a'])
    expect(a.next).toBe('EntryTitle=a\nEntryTitle=b')
    expect(a.added).toBe(1)
  })
})

describe('formatCopy', () => {
  it('copies pattern and pack JSON', () => {
    expect(formatPatternCopy(iphone)).toBe(iphone.pattern)
    expect(formatPackJson(fortnite)).toContain('"mode": "block"')
    expect(formatPackJson(fortnite)).not.toMatch(/muffle|mute/i)
  })
})
