import type { OpmlFeed, OpmlOutline } from '@/opml/types'
import type { ScoreResult, ScoreTimeframe } from '@/score/client'

export type ListHealthFilter = 'all' | 'ok' | 'stale' | 'unhealthy' | 'unscored'

export const LIST_HEALTH_OPTIONS: { id: ListHealthFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'ok', label: 'Healthy' },
  { id: 'stale', label: 'Stale' },
  { id: 'unhealthy', label: 'Unhealthy' },
  { id: 'unscored', label: 'Unscored' },
]

export const PING_TIMEFRAMES: ScoreTimeframe[] = ['1d', '7d', '30d']

export function feedHealthKey(
  score: ScoreResult | undefined,
): Exclude<ListHealthFilter, 'all'> {
  if (!score) return 'unscored'
  if (score.health === 'ok') return 'ok'
  if (score.health === 'stale') return 'stale'
  return 'unhealthy'
}

export function feedMatchesListFilter(
  feed: OpmlFeed,
  scores: Record<string, ScoreResult>,
  query: string,
  health: ListHealthFilter,
): boolean {
  if (health !== 'all' && feedHealthKey(scores[feed.xmlUrl]) !== health) {
    return false
  }
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    feed.text.toLowerCase().includes(q) ||
    feed.xmlUrl.toLowerCase().includes(q) ||
    (feed.htmlUrl?.toLowerCase().includes(q) ?? false)
  )
}

/** True if this node (or any descendant feed) matches the list filter. */
export function outlineMatchesListFilter(
  node: OpmlOutline,
  scores: Record<string, ScoreResult>,
  query: string,
  health: ListHealthFilter,
): boolean {
  if (node.kind === 'feed') {
    return feedMatchesListFilter(node, scores, query, health)
  }
  return node.children.some((c) =>
    outlineMatchesListFilter(c, scores, query, health),
  )
}

export function countMatchingFeeds(
  node: OpmlOutline,
  scores: Record<string, ScoreResult>,
  query: string,
  health: ListHealthFilter,
): number {
  if (node.kind === 'feed') {
    return feedMatchesListFilter(node, scores, query, health) ? 1 : 0
  }
  return node.children.reduce(
    (n, child) => n + countMatchingFeeds(child, scores, query, health),
    0,
  )
}

export function listFilterActive(query: string, health: ListHealthFilter): boolean {
  return health !== 'all' || query.trim().length > 0
}
