import type { FilterPack, FilterPackManifest } from './types'

const MODES = new Set(['block', 'keep'])
const MATCHES = new Set(['any', 'all'])
const KINDS = new Set(['keyword', 'regex'])
const FIELDS = new Set(['title', 'body'])

export function validateFilterPack(raw: unknown): FilterPack {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Filter pack must be an object.')
  }
  const o = raw as Record<string, unknown>
  if (o.schemaVersion !== 1) {
    throw new Error('Filter pack schemaVersion must be 1.')
  }
  if (typeof o.id !== 'string' || !o.id.trim()) {
    throw new Error('Filter pack requires a non-empty id.')
  }
  if (typeof o.name !== 'string' || !o.name.trim()) {
    throw new Error('Filter pack requires a non-empty name.')
  }
  // Migrate legacy muffle/mute → block (Miniflux has no muffle/mute).
  let mode = o.mode
  if (mode == null && (o.behavior === 'muffle' || o.behavior === 'mute')) {
    mode = 'block'
  }
  if (typeof mode !== 'string' || !MODES.has(mode)) {
    throw new Error('Filter pack mode must be block or keep.')
  }
  if (typeof o.match !== 'string' || !MATCHES.has(o.match)) {
    throw new Error('Filter pack match must be any or all.')
  }
  if (typeof o.pattern !== 'string' || !o.pattern.trim()) {
    throw new Error('Filter pack requires a non-empty pattern.')
  }
  if (typeof o.patternKind !== 'string' || !KINDS.has(o.patternKind)) {
    throw new Error('Filter pack patternKind must be keyword or regex.')
  }
  if (!Array.isArray(o.fields) || o.fields.length === 0) {
    throw new Error('Filter pack requires at least one field.')
  }
  const fields: FilterPack['fields'] = []
  for (const f of o.fields) {
    if (f === 'content_warning') {
      // Legacy Current field → closest Miniflux target.
      if (!fields.includes('body')) fields.push('body')
      continue
    }
    if (typeof f !== 'string' || !FIELDS.has(f)) {
      throw new Error(`Invalid filter field: ${String(f)}`)
    }
    if (!fields.includes(f as FilterPack['fields'][number])) {
      fields.push(f as FilterPack['fields'][number])
    }
  }
  if (fields.length === 0) {
    throw new Error('Filter pack requires at least one field.')
  }
  if (!o.scope || typeof o.scope !== 'object') {
    throw new Error('Filter pack requires a scope object.')
  }
  const scope = o.scope as Record<string, unknown>
  if (typeof scope.global !== 'boolean') {
    throw new Error('Filter pack scope.global must be a boolean.')
  }
  let feedUrls: string[] | undefined
  if (scope.feedUrls !== undefined) {
    if (!Array.isArray(scope.feedUrls) || !scope.feedUrls.every((u) => typeof u === 'string')) {
      throw new Error('Filter pack scope.feedUrls must be a string array.')
    }
    feedUrls = scope.feedUrls as string[]
  }
  const pack: FilterPack = {
    schemaVersion: 1,
    id: o.id.trim(),
    name: o.name.trim(),
    mode: mode as FilterPack['mode'],
    match: o.match as FilterPack['match'],
    pattern: o.pattern.trim(),
    patternKind: o.patternKind as FilterPack['patternKind'],
    fields,
    scope: { global: scope.global, ...(feedUrls ? { feedUrls } : {}) },
  }
  if (typeof o.notes === 'string' && o.notes.trim()) {
    pack.notes = o.notes.trim()
  }
  return pack
}

export function validateManifest(raw: unknown): FilterPackManifest {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Filter pack manifest must be an object.')
  }
  const o = raw as Record<string, unknown>
  if (o.schemaVersion !== 1) {
    throw new Error('Manifest schemaVersion must be 1.')
  }
  if (!Array.isArray(o.packs) || !o.packs.every((p) => typeof p === 'string')) {
    throw new Error('Manifest packs must be a string array.')
  }
  return { schemaVersion: 1, packs: o.packs as string[] }
}
