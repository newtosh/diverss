export type FilterMode = 'block' | 'keep'
export type FilterMatch = 'any' | 'all'
export type FilterPatternKind = 'keyword' | 'regex'
export type FilterField = 'title' | 'body'

export interface FilterPackScope {
  global: boolean
  feedUrls?: string[]
}

export interface FilterPack {
  schemaVersion: 1
  id: string
  name: string
  /** Miniflux-native: block drops matches; keep retains only matches. */
  mode: FilterMode
  match: FilterMatch
  pattern: string
  patternKind: FilterPatternKind
  fields: FilterField[]
  scope: FilterPackScope
  notes?: string
}

export interface FilterPackManifest {
  schemaVersion: 1
  packs: string[]
}

export type PackSource = 'shipped' | 'local'
