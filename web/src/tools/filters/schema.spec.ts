import { describe, expect, it } from 'vitest'
import { validateFilterPack, validateManifest } from './schema'

const iphone = {
  schemaVersion: 1,
  id: 'iphone-seo',
  name: 'iPhone SEO',
  mode: 'block',
  pattern: '/(?=.*(?:iPhone|iOS))(?=.*(?:feature|ability|trick))/',
  patternKind: 'regex',
  fields: ['title'],
  scope: { global: false },
}

const fortnite = {
  schemaVersion: 1,
  id: 'fortnite-chapter',
  name: 'Fortnite Chapter',
  mode: 'block',
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
  it('parses seed-shaped packs', () => {
    expect(validateFilterPack(iphone).mode).toBe('block')
    expect(validateFilterPack(fortnite).patternKind).toBe('keyword')
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

  it('rejects invalid fields', () => {
    expect(() =>
      validateFilterPack({ ...iphone, fields: ['content_warning'] }),
    ).toThrow(/field/i)
  })
})
