import type { ParsedFeed, ParsedItem, ReasonCode, ScoreResult } from './types'
import {
  SCHEMA_VERSION,
  WINDOW_1D_MS,
  WINDOW_7D_MS,
  WINDOW_30D_MS,
  WINDOW_90D_MS,
} from './types'

/** Score a successfully parsed feed (parity with Go ScoreParsedFeed). */
export function scoreParsedFeed(
  xmlUrl: string,
  feed: ParsedFeed | null,
  now: Date = new Date(),
): ScoreResult {
  const scoredAt = now.toISOString().replace(/\.\d{3}Z$/, 'Z')
  if (feed == null) {
    return unhealthy(xmlUrl, 'unparseable', now)
  }

  const result: ScoreResult = {
    schemaVersion: SCHEMA_VERSION,
    xmlUrl,
    health: 'ok',
    reason: 'ok',
    velocityUnknown: false,
    scoredAt,
  }
  if (feed.title) {
    result.title = feed.title
  }

  const start1 = new Date(now.getTime() - WINDOW_1D_MS)
  const start7 = new Date(now.getTime() - WINDOW_7D_MS)
  const start30 = new Date(now.getTime() - WINDOW_30D_MS)
  const start90 = new Date(now.getTime() - WINDOW_90D_MS)

  let posts1 = 0
  let posts7 = 0
  let posts30 = 0
  let posts90 = 0
  let anyDated = false
  let lastDated: Date | null = null
  let wordSum = 0
  let wordItems = 0

  for (const item of feed.items) {
    const t = item.published
    if (t == null) continue
    anyDated = true
    if (lastDated == null || t > lastDated) lastDated = t
    if (t >= start1 && t <= now) posts1++
    if (t >= start7 && t <= now) posts7++
    if (t >= start30 && t <= now) posts30++
    if (t >= start90 && t <= now) posts90++
    const n = wordCount(bestItemText(item))
    if (n > 0) {
      wordSum += n
      wordItems++
    }
  }

  if (!anyDated) {
    // No publish dates (even after permalink inference): treat as stale so
    // owners get Fix URL instead of a silent "Cadence unknown" healthy row.
    result.health = 'stale'
    result.reason = 'stale'
    result.velocityUnknown = true
    result.detail = 'No publish dates found in feed'
    return result
  }

  result.posts1d = posts1
  result.posts7d = posts7
  result.posts30d = posts30
  result.velocityUnknown = false
  if (lastDated) {
    result.lastDatedAt = lastDated.toISOString().replace(/\.\d{3}Z$/, 'Z')
  }
  if (wordItems > 0) {
    result.avgWords = Math.round((wordSum / wordItems) * 100) / 100
  }
  if (posts90 === 0) {
    result.health = 'stale'
    result.reason = 'stale'
  }
  return result
}

export function unhealthy(
  xmlUrl: string,
  reason: ReasonCode,
  now: Date = new Date(),
  detail?: string,
): ScoreResult {
  return {
    schemaVersion: SCHEMA_VERSION,
    xmlUrl,
    health: 'unhealthy',
    reason,
    velocityUnknown: true,
    scoredAt: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    ...(detail ? { detail } : {}),
  }
}

function bestItemText(item: ParsedItem): string {
  if (item.content) return item.content
  if (item.description) return item.description
  return ''
}

function wordCount(raw: string): number {
  const plain = raw
    .replace(/<[^>]*>/gs, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
  const parts = plain.trim().split(/\s+/).filter(Boolean)
  return parts.length
}

export type { ParsedFeed, ParsedItem, ScoreResult }
