import type { FilterField, FilterPack } from './types'

/** Strip optional /.../ or /.../flags wrappers from regex. */
export function stripRegexDelimiters(pattern: string): string {
  const t = pattern.trim()
  const m = /^\/(.+)\/[a-z]*$/is.exec(t)
  return m?.[1] ?? t
}

export function escapeRe2Literal(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function fieldToEntryKey(field: FilterField): string {
  return field === 'body' ? 'EntryContent' : 'EntryTitle'
}

/**
 * Compile a filter pack into Miniflux Entry* rule lines.
 * Callers attach lines to block_filter_entry_rules / keep_filter_entry_rules.
 */
export function compilePackToMinifluxLines(pack: FilterPack): string[] {
  const raw = pack.pattern.trim()
  if (!raw) {
    throw new Error('Filter pack pattern is empty.')
  }
  const body =
    pack.patternKind === 'regex'
      ? stripRegexDelimiters(raw)
      : `(?i)${escapeRe2Literal(raw)}`
  if (!body.trim()) {
    throw new Error('Filter pack pattern is empty after normalize.')
  }
  // Lookarounds / backrefs are JS/PCRE — Miniflux RE2 rejects them.
  if (/\(\?[<=!]|\\[1-9]/.test(body)) {
    throw new Error(
      'Pattern uses lookarounds or backreferences, which Miniflux RE2 does not support. Rewrite with alternation (e.g. A.*B|B.*A for “both”).',
    )
  }

  const keys = [...new Set(pack.fields.map(fieldToEntryKey))]
  return keys.map((k) => `${k}=${body}`)
}

export function mergeBlocklistLines(
  existing: string,
  additions: string[],
): { next: string; added: number } {
  const current = existing
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const seen = new Set(current)
  let added = 0
  const out = [...current]
  for (const line of additions) {
    const t = line.trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
    added++
  }
  return { next: out.join('\n'), added }
}
