import { validateFilterPack } from './schema'
import type { FilterPack } from './types'

export const LOCAL_FILTER_PACKS_KEY = 'diverss-filter-packs-v1'

function readRaw(): unknown {
  try {
    const raw = localStorage.getItem(LOCAL_FILTER_PACKS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as unknown
  } catch {
    return []
  }
}

export function loadLocalFilterPacks(): FilterPack[] {
  const raw = readRaw()
  if (!Array.isArray(raw)) return []
  const out: FilterPack[] = []
  for (const row of raw) {
    try {
      out.push(validateFilterPack(row))
    } catch {
      /* skip corrupt rows */
    }
  }
  return out
}

export function saveLocalFilterPack(pack: FilterPack): FilterPack[] {
  const validated = validateFilterPack(pack)
  const next = loadLocalFilterPacks().filter((p) => p.id !== validated.id)
  next.unshift(validated)
  localStorage.setItem(LOCAL_FILTER_PACKS_KEY, JSON.stringify(next))
  return next
}

export function deleteLocalFilterPack(id: string): FilterPack[] {
  const next = loadLocalFilterPacks().filter((p) => p.id !== id)
  localStorage.setItem(LOCAL_FILTER_PACKS_KEY, JSON.stringify(next))
  return next
}

export function exportLocalFilterPacksJson(): string {
  return `${JSON.stringify(loadLocalFilterPacks(), null, 2)}\n`
}

export function importLocalFilterPacksJson(text: string): {
  packs: FilterPack[]
  imported: number
} {
  const parsed = JSON.parse(text) as unknown
  const rows = Array.isArray(parsed) ? parsed : [parsed]
  let imported = 0
  let packs = loadLocalFilterPacks()
  for (const row of rows) {
    const pack = validateFilterPack(row)
    packs = packs.filter((p) => p.id !== pack.id)
    packs.unshift(pack)
    imported++
  }
  localStorage.setItem(LOCAL_FILTER_PACKS_KEY, JSON.stringify(packs))
  return { packs, imported }
}

export function newLocalPackId(): string {
  return `local-${Date.now().toString(36)}`
}

export function blankFilterPack(id: string): FilterPack {
  return {
    schemaVersion: 1,
    id,
    name: 'New filter pack',
    mode: 'block',
    pattern: 'TODO',
    patternKind: 'keyword',
    fields: ['title'],
    scope: { global: false, feedUrls: [] },
  }
}
