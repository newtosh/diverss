import type { OpmlFeed, OpmlOutline } from '@/opml/types'
import type { ScanResult, ScanTimeframe } from '@/scan/client'
import { isFetchBlocked } from '@/scan/presentation'

export type ListHealthFilter =
  | 'all'
  | 'ok'
  | 'stale'
  | 'unhealthy'
  | 'blocked'
  | 'unscanned'

export const LIST_HEALTH_OPTIONS: { id: ListHealthFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'ok', label: 'Healthy' },
  { id: 'stale', label: 'Stale' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'unhealthy', label: 'Unhealthy' },
  { id: 'unscanned', label: 'Unscanned' },
]

export const PING_TIMEFRAMES: ScanTimeframe[] = ['1d', '7d', '30d']

export function feedHealthKey(
  score: ScanResult | undefined,
): Exclude<ListHealthFilter, 'all'> {
  if (!score) return 'unscanned'
  if (score.health === 'ok') return 'ok'
  if (score.health === 'stale') return 'stale'
  if (isFetchBlocked(score)) return 'blocked'
  return 'unhealthy'
}

export function feedMatchesListFilter(
  feed: OpmlFeed,
  scores: Record<string, ScanResult>,
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
  scores: Record<string, ScanResult>,
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
  scores: Record<string, ScanResult>,
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
