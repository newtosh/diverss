import { compilePackToMinifluxLines, mergeBlocklistLines } from './compileMiniflux'
import type { FilterPack } from './types'
import type { ReaderAdapter, ReaderFeedSummary } from '../types'

export interface ApplyFilterResult {
  feedsTouched: number
  linesAdded: number
  feedsSkipped: number
  mode: FilterPack['mode']
  errors: string[]
}

function normalizeFeedUrl(u: string): string {
  try {
    const url = new URL(u.trim())
    url.hash = ''
    let path = url.pathname
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
    return `${url.protocol}//${url.host.toLowerCase()}${path}`.toLowerCase()
  } catch {
    return u.trim().toLowerCase()
  }
}

export function selectFeedsForPack(
  pack: FilterPack,
  feeds: ReaderFeedSummary[],
  /** When set, overrides pack scope (Apply UI multi-select). */
  selectedIds?: string[],
): { selected: ReaderFeedSummary[]; skipped: number } {
  if (selectedIds) {
    const want = new Set(selectedIds)
    return {
      selected: feeds.filter((f) => want.has(f.id)),
      skipped: 0,
    }
  }
  if (pack.scope.global) {
    return { selected: feeds, skipped: 0 }
  }
  const wanted = new Set((pack.scope.feedUrls ?? []).map(normalizeFeedUrl))
  if (wanted.size === 0) {
    return { selected: [], skipped: 0 }
  }
  const selected = feeds.filter((f) => wanted.has(normalizeFeedUrl(f.xmlUrl)))
  const skipped = wanted.size - selected.length
  return { selected, skipped: Math.max(0, skipped) }
}

async function writeFeedRules(
  adapter: ReaderAdapter,
  id: string,
  mode: FilterPack['mode'],
  next: string,
): Promise<void> {
  if (!adapter.updateFeedFilters) {
    throw new Error('This reader does not support filter apply via API.')
  }
  if (mode === 'keep') {
    await adapter.updateFeedFilters(id, { keeplistRules: next })
  } else {
    await adapter.updateFeedFilters(id, { blocklistRules: next })
  }
}

export async function applyPackToAdapter(
  pack: FilterPack,
  adapter: ReaderAdapter,
  opts?: { feedIds?: string[] },
): Promise<ApplyFilterResult> {
  if (!adapter.updateFeedFilters) {
    throw new Error('This reader does not support filter apply via API.')
  }
  const feeds = await adapter.listFeeds()
  const { selected, skipped } = selectFeedsForPack(pack, feeds, opts?.feedIds)
  if (selected.length === 0) {
    return {
      feedsTouched: 0,
      linesAdded: 0,
      feedsSkipped: skipped,
      mode: pack.mode,
      errors:
        skipped > 0
          ? [`No matching feeds on reader (${skipped} pack URL(s) unmatched).`]
          : [
              pack.scope.global
                ? 'Reader has no feeds to update.'
                : 'Associate at least one feed, or set the pack to all feeds.',
            ],
    }
  }

  const lines = compilePackToMinifluxLines(pack)
  let feedsTouched = 0
  let linesAdded = 0
  const errors: string[] = []
  const expectedById = new Map<string, string>()

  for (const t of selected) {
    try {
      const existing =
        pack.mode === 'keep' ? (t.keeplistRules ?? '') : (t.blocklistRules ?? '')
      const merged = mergeBlocklistLines(existing, lines)
      if (merged.added === 0) continue
      await writeFeedRules(adapter, t.id, pack.mode, merged.next)
      expectedById.set(t.id, merged.next)
      feedsTouched++
      linesAdded += merged.added
    } catch (e) {
      errors.push(
        `${t.title || t.xmlUrl}: ${e instanceof Error ? e.message : 'update failed'}`,
      )
    }
  }

  if (expectedById.size > 0) {
    try {
      const after = await adapter.listFeeds()
      const byId = new Map(after.map((f) => [f.id, f]))
      for (const [id] of expectedById) {
        const row = byId.get(id)
        const rules =
          pack.mode === 'keep'
            ? (row?.keeplistRules ?? '')
            : (row?.blocklistRules ?? '')
        const ok = lines.every((l) => rules.includes(l.trim()))
        if (!ok) {
          const label = row?.title || row?.xmlUrl || id
          errors.push(
            `${label}: update succeeded but rules did not verify on read-back.`,
          )
        }
      }
    } catch (e) {
      errors.push(
        `Could not verify filter updates: ${e instanceof Error ? e.message : 'read-back failed'}`,
      )
    }
  }

  return {
    feedsTouched,
    linesAdded,
    feedsSkipped: skipped,
    mode: pack.mode,
    errors,
  }
}
