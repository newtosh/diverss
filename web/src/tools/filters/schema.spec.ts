import { describe, expect, it } from 'vitest'
import { validateFilterPack, validateManifest } from './schema'

const iphone = {
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

const streaming = {
  schemaVersion: 1,
  id: 'streaming-clickbait',
  name: 'Streaming Clickbait',
  mode: 'block',
  match: 'any',
  pattern:
    '/(free (on )?streaming|streaming (smash )?hit|officially streaming|essential viewing|10\\/10)/',
  patternKind: 'regex',
  fields: ['title', 'body', 'content_warning'],
  scope: { global: false },
}

const fortnite = {
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

const index = {
  schemaVersion: 1,
  packs: ['iphone-seo', 'streaming-clickbait', 'fortnite-chapter'],
}

describe('filter pack schema', () => {
  it('parses seed-shaped packs and migrates legacy fields', () => {
    expect(validateFilterPack(iphone).mode).toBe('block')
    expect(validateFilterPack(streaming).fields).toEqual(['title', 'body'])
    expect(validateFilterPack(fortnite).patternKind).toBe('keyword')
  })

  it('migrates legacy muffle/mute behavior to block', () => {
    const pack = validateFilterPack({
      ...fortnite,
      mode: undefined,
      behavior: 'muffle',
    })
    expect(pack.mode).toBe('block')
  })

  it('manifest lists exactly the three seed ids', () => {
    expect(validateManifest(index).packs).toEqual([
      'iphone-seo',
      'streaming-clickbait',
      'fortnite-chapter',
    ])
  })

  it('rejects missing name', () => {
    expect(() => validateFilterPack({ ...iphone, name: '' })).toThrow(/name/i)
  })

  it('rejects empty pattern', () => {
    expect(() => validateFilterPack({ ...fortnite, pattern: '  ' })).toThrow(
      /pattern/i,
    )
  })
})
