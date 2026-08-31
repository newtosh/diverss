import { stripRegexDelimiters, escapeRe2Literal } from './compileMiniflux'
import type { FilterPatternKind } from './types'

export interface MatchSpan {
  start: number
  end: number
  text: string
}

export type HighlightSeg = { text: string; hit: boolean }

/**
 * Normalize pack pattern to a browser RegExp source string.
 * Keywords become case-insensitive literals; regex strips /…/ wrappers.
 * A leading (?i) — RE2/PCRE inline case-insensitive flag, valid for
 * Miniflux but not JS RegExp syntax — is peeled off and reported via
 * caseInsensitive instead of left embedded, where it would throw.
 * Note: browser JS RegExp ≠ Miniflux RE2 — preview is approximate.
 */
export function browserPatternSource(
  pattern: string,
  patternKind: FilterPatternKind,
): { source: string; caseInsensitive: boolean } | { error: string } {
  const raw = pattern.trim()
  if (!raw) return { error: 'Pattern is empty.' }
  if (patternKind === 'keyword') {
    return { source: escapeRe2Literal(raw), caseInsensitive: true }
  }
  let body = stripRegexDelimiters(raw)
  if (!body.trim()) return { error: 'Pattern is empty after normalize.' }
  let caseInsensitive = false
  if (body.startsWith('(?i)')) {
    caseInsensitive = true
    body = body.slice(4)
  }
  return { source: body, caseInsensitive }
}

export function compileBrowserRegex(
  pattern: string,
  patternKind: FilterPatternKind,
): { regex: RegExp; source: string } | { error: string } {
  const src = browserPatternSource(pattern, patternKind)
  if ('error' in src) return src
  const flags = patternKind === 'keyword' || src.caseInsensitive ? 'gi' : 'g'
  try {
    return { regex: new RegExp(src.source, flags), source: src.source }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : 'Invalid regular expression.',
    }
  }
}

const MAX_MATCHES = 200

export function findMatches(regex: RegExp, sample: string): MatchSpan[] {
  const out: MatchSpan[] = []
  // Avoid zero-length infinite loops
  const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`
  const re = new RegExp(regex.source, flags)
  let m: RegExpExecArray | null
  let guard = 0
  while ((m = re.exec(sample)) !== null) {
    const text = m[0] ?? ''
    const start = m.index
    const end = start + text.length
    out.push({ start, end, text })
    if (text.length === 0) re.lastIndex = start + 1
    if (++guard >= MAX_MATCHES) break
  }
  return out
}

export function highlightSegments(
  sample: string,
  matches: MatchSpan[],
): HighlightSeg[] {
  if (!matches.length) return [{ text: sample, hit: false }]
  const sorted = [...matches].sort((a, b) => a.start - b.start)
  const segs: HighlightSeg[] = []
  let cursor = 0
  for (const m of sorted) {
    if (m.start < cursor) continue
    if (m.start > cursor) {
      segs.push({ text: sample.slice(cursor, m.start), hit: false })
    }
    segs.push({ text: sample.slice(m.start, m.end), hit: true })
    cursor = m.end
  }
  if (cursor < sample.length) {
    segs.push({ text: sample.slice(cursor), hit: false })
  }
  return segs
}

export function tryPatternAgainstSamples(
  pattern: string,
  patternKind: FilterPatternKind,
  samples: string[],
): {
  error: string | null
  source: string | null
  rows: { sample: string; matchCount: number; segments: HighlightSeg[] }[]
} {
  const compiled = compileBrowserRegex(pattern, patternKind)
  if ('error' in compiled) {
    return { error: compiled.error, source: null, rows: [] }
  }
  const rows = samples.map((sample) => {
    const matches = findMatches(compiled.regex, sample)
    return {
      sample,
      matchCount: matches.length,
      segments: highlightSegments(sample, matches),
    }
  })
  return { error: null, source: compiled.source, rows }
}
