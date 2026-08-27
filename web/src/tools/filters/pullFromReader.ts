import { newLocalPackId } from './localStore'
import type { FilterField, FilterMode, FilterPack, FilterPatternKind } from './types'
import type { ReaderFeedSummary } from '../types'

export type MinifluxRuleFieldKey = 'EntryTitle' | 'EntryContent' | 'legacy'

export interface ParsedRuleLine {
  raw: string
  fieldKey: MinifluxRuleFieldKey
  body: string
  /** Best-effort DiveRSS field; undefined for unsupported keys. */
  field?: FilterField
  importable: boolean
}

export interface FeedRuleInventoryRow {
  feedId: string
  feedTitle: string
  xmlUrl: string
  mode: FilterMode
  line: ParsedRuleLine
}

export interface PullPackCandidate {
  key: string
  mode: FilterMode
  fieldKey: MinifluxRuleFieldKey
  body: string
  field?: FilterField
  importable: boolean
  feedIds: string[]
  feedUrls: string[]
  feedTitles: string[]
  rawLine: string
}

const IMPORTABLE: Record<string, FilterField> = {
  EntryTitle: 'title',
  EntryContent: 'body',
}

export function splitRuleLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
}

/** Parse a single Miniflux filter line into structured pieces. */
export function parseRuleLine(raw: string): ParsedRuleLine {
  const t = raw.trim()
  const eq = t.indexOf('=')
  if (eq <= 0) {
    return {
      raw: t,
      fieldKey: 'legacy',
      body: t,
      importable: true,
      field: 'title',
    }
  }
  const key = t.slice(0, eq).trim()
  const body = t.slice(eq + 1)
  const field = IMPORTABLE[key]
  if (field) {
    return {
      raw: t,
      fieldKey: key as MinifluxRuleFieldKey,
      body,
      field,
      importable: true,
    }
  }
  // Other Entry* keys exist in Miniflux but we don't map them yet.
  if (key.startsWith('Entry')) {
    return {
      raw: t,
      fieldKey: 'legacy',
      body,
      importable: false,
    }
  }
  return {
    raw: t,
    fieldKey: 'legacy',
    body: t,
    field: 'title',
    importable: true,
  }
}

export function inventoryFromFeeds(
  feeds: ReaderFeedSummary[],
): FeedRuleInventoryRow[] {
  const rows: FeedRuleInventoryRow[] = []
  for (const f of feeds) {
    for (const line of splitRuleLines(f.blocklistRules ?? '')) {
      rows.push({
        feedId: f.id,
        feedTitle: f.title,
        xmlUrl: f.xmlUrl,
        mode: 'block',
        line: parseRuleLine(line),
      })
    }
    for (const line of splitRuleLines(f.keeplistRules ?? '')) {
      rows.push({
        feedId: f.id,
        feedTitle: f.title,
        xmlUrl: f.xmlUrl,
        mode: 'keep',
        line: parseRuleLine(line),
      })
    }
  }
  return rows
}

function candidateKey(mode: FilterMode, rawLine: string): string {
  return `${mode}::${rawLine.trim()}`
}

/**
 * Group identical rule lines across feeds into import candidates.
 * Same raw line + mode → one candidate with multi-feed scope.
 */
export function groupIntoPackCandidates(
  rows: FeedRuleInventoryRow[],
): PullPackCandidate[] {
  const map = new Map<string, PullPackCandidate>()
  for (const row of rows) {
    const key = candidateKey(row.mode, row.line.raw)
    const existing = map.get(key)
    if (existing) {
      if (!existing.feedIds.includes(row.feedId)) {
        existing.feedIds.push(row.feedId)
        existing.feedUrls.push(row.xmlUrl)
        existing.feedTitles.push(row.feedTitle)
      }
      continue
    }
    map.set(key, {
      key,
      mode: row.mode,
      fieldKey: row.line.fieldKey,
      body: row.line.body,
      field: row.line.field,
      importable: row.line.importable,
      feedIds: [row.feedId],
      feedUrls: [row.xmlUrl],
      feedTitles: [row.feedTitle],
      rawLine: row.line.raw,
    })
  }
  return [...map.values()].sort((a, b) => {
    if (b.feedIds.length !== a.feedIds.length) {
      return b.feedIds.length - a.feedIds.length
    }
    return a.rawLine.localeCompare(b.rawLine)
  })
}

function inferPatternKind(body: string): FilterPatternKind {
  // Our keyword compile emits (?i)literal — reverse that when obvious.
  if (/^\(\?i\)[A-Za-z0-9 _.-]+$/.test(body) && !/[\\[\](){}|*+?^$]/.test(body.slice(4))) {
    return 'keyword'
  }
  return 'regex'
}

function patternFromBody(body: string, kind: FilterPatternKind): string {
  if (kind === 'keyword' && body.startsWith('(?i)')) {
    return body.slice(4)
  }
  return body
}

function slugFromBody(body: string): string {
  const base = body
    .replace(/^\(\?i\)/, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32)
    .toLowerCase()
  return base || 'rule'
}

/** Build a local FilterPack from a pull candidate (best-effort). */
export function candidateToFilterPack(
  candidate: PullPackCandidate,
  opts?: { id?: string; totalFeedCount?: number },
): FilterPack {
  if (!candidate.importable || !candidate.field) {
    throw new Error(
      `Cannot import ${candidate.fieldKey} rules yet (need EntryTitle/EntryContent).`,
    )
  }
  const kind = inferPatternKind(candidate.body)
  const pattern = patternFromBody(candidate.body, kind)
  const global =
    opts?.totalFeedCount != null &&
    opts.totalFeedCount > 0 &&
    candidate.feedIds.length >= opts.totalFeedCount
  const id = opts?.id ?? `pulled-${candidate.mode}-${slugFromBody(candidate.body)}-${newLocalPackId().slice(-4)}`
  const short = pattern.length > 40 ? `${pattern.slice(0, 40)}…` : pattern
  return {
    schemaVersion: 1,
    id,
    name: `Pulled ${candidate.mode}: ${short}`,
    mode: candidate.mode,
    pattern,
    patternKind: kind,
    fields: [candidate.field],
    scope: global
      ? { global: true }
      : { global: false, feedUrls: [...candidate.feedUrls] },
    notes: `Imported from Miniflux ${candidate.mode}list (${candidate.rawLine}). Preview may differ from RE2.`,
  }
}

export function summarizeInventory(rows: FeedRuleInventoryRow[]): {
  feedsWithRules: number
  blockLines: number
  keepLines: number
  importableCandidates: number
} {
  const feedIds = new Set(rows.map((r) => r.feedId))
  const candidates = groupIntoPackCandidates(rows)
  return {
    feedsWithRules: feedIds.size,
    blockLines: rows.filter((r) => r.mode === 'block').length,
    keepLines: rows.filter((r) => r.mode === 'keep').length,
    importableCandidates: candidates.filter((c) => c.importable).length,
  }
}
