import type { FilterPack } from './types'

/** Copy the raw pattern string (keyword or regex body). */
export function formatPatternCopy(pack: FilterPack): string {
  return pack.pattern.trim()
}

/** Pretty-printed filter pack JSON for backup / share. */
export function formatPackJson(pack: FilterPack): string {
  return `${JSON.stringify(pack, null, 2)}\n`
}
