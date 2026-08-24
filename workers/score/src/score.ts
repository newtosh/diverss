import type { ParsedFeed, ParsedItem, ReasonCode, ScoreResult } from './types'
import { SCHEMA_VERSION, VELOCITY_WINDOW_MS } from './types'

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

  const windowStart = new Date(now.getTime() - VELOCITY_WINDOW_MS)
  let datedInWindow = 0
  let anyDated = false

  for (const item of feed.items) {
    const t = item.published
    if (t == null) continue
    anyDated = true
    if (t >= windowStart && t <= now) {
      datedInWindow++
    }
  }

  if (!anyDated) {
    result.velocityUnknown = true
    return result
  }

  const weeks = VELOCITY_WINDOW_MS / (7 * 24 * 60 * 60 * 1000)
  const ppw = Math.round((datedInWindow / weeks) * 100) / 100
  result.postsPerWeek = ppw
  result.itemCountWindow = datedInWindow
  result.velocityUnknown = false
  return result
}

export function unhealthy(
  xmlUrl: string,
  reason: ReasonCode,
  now: Date = new Date(),
): ScoreResult {
  return {
    schemaVersion: SCHEMA_VERSION,
    xmlUrl,
    health: 'unhealthy',
    reason,
    velocityUnknown: true,
    scoredAt: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
  }
}

export type { ParsedFeed, ParsedItem, ScoreResult }
