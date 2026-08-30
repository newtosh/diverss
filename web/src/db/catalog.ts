import { normalizeFeedUrl } from '@/opml/url'
import type { ScanResult, ScanTimeframe } from '@/scan/client'

export const LOCAL_CATALOG_KEY = 'gardenrss-catalog-v1'

/** Feeds the user opted into from Community sources (Catalog only — not workspace). */
export interface LocalCatalogFeed {
  title: string
  xmlUrl: string
  htmlUrl?: string
  category?: string
  /** OPML folder path labels from the source pack, if any. */
  groups?: string[]
  sourceId?: string
  sourceTitle?: string
  addedAt: number
}

export interface LocalCatalogSnapshot {
  schemaVersion: 1
  feeds: LocalCatalogFeed[]
  /** Scan Worker results keyed by xmlUrl (and normalized url). */
  scores?: Record<string, ScanResult>
  timeframe?: ScanTimeframe
  /**
   * Normalized feed URLs hidden from Catalog (curated + community).
   * Community rows are also dropped from `feeds` on prune; curated stay dismissed only.
   */
  dismissedUrls?: string[]
  updatedAt: number
}

function emptySnapshot(): LocalCatalogSnapshot {
  return {
    schemaVersion: 1,
    feeds: [],
    scores: {},
    timeframe: '7d',
    dismissedUrls: [],
    updatedAt: 0,
  }
}

function normalizeDismissed(urls: unknown): string[] {
  if (!Array.isArray(urls)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const u of urls) {
    if (typeof u !== 'string') continue
    const key = normalizeFeedUrl(u)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(key)
  }
  return out
}

export function loadLocalCatalog(): LocalCatalogSnapshot {
  try {
    const raw = localStorage.getItem(LOCAL_CATALOG_KEY)
    if (!raw) return emptySnapshot()
    const parsed = JSON.parse(raw) as Partial<LocalCatalogSnapshot>
    if (!Array.isArray(parsed.feeds)) return emptySnapshot()
    const timeframe =
      parsed.timeframe === '1d' ||
      parsed.timeframe === '7d' ||
      parsed.timeframe === '30d'
        ? parsed.timeframe
        : '7d'
    return {
      schemaVersion: 1,
      feeds: parsed.feeds.filter(
        (f) =>
          f &&
          typeof f.title === 'string' &&
          typeof f.xmlUrl === 'string' &&
          f.xmlUrl.trim(),
      ),
      scores:
        parsed.scores && typeof parsed.scores === 'object' && !Array.isArray(parsed.scores)
          ? parsed.scores
          : {},
      timeframe,
      dismissedUrls: normalizeDismissed(parsed.dismissedUrls),
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    }
  } catch {
    return emptySnapshot()
  }
}

export function saveLocalCatalog(snapshot: LocalCatalogSnapshot): void {
  const next: LocalCatalogSnapshot = {
    schemaVersion: 1,
    feeds: snapshot.feeds,
    scores: snapshot.scores ?? {},
    timeframe: snapshot.timeframe ?? '7d',
    dismissedUrls: normalizeDismissed(snapshot.dismissedUrls),
    updatedAt: snapshot.updatedAt ?? Date.now(),
  }
  localStorage.setItem(LOCAL_CATALOG_KEY, JSON.stringify(next))
}

export function saveCatalogScans(
  scores: Record<string, ScanResult>,
  timeframe: ScanTimeframe,
): void {
  const snap = loadLocalCatalog()
  snap.scores = scores
  snap.timeframe = timeframe
  snap.updatedAt = Date.now()
  saveLocalCatalog(snap)
}

/** Merge feeds into local Catalog. Overwrites matching urls when `overwrite` is true. */
export function mergeIntoLocalCatalog(
  incoming: Omit<LocalCatalogFeed, 'addedAt'>[],
  opts?: { overwrite?: boolean },
): { snapshot: LocalCatalogSnapshot; added: number; updated: number } {
  const overwrite = opts?.overwrite !== false
  const snap = loadLocalCatalog()
  const indexByUrl = new Map(
    snap.feeds.map((f, i) => [normalizeFeedUrl(f.xmlUrl), i] as const),
  )
  const dismissed = new Set(normalizeDismissed(snap.dismissedUrls))
  const now = Date.now()
  let added = 0
  let updated = 0
  for (const f of incoming) {
    const key = normalizeFeedUrl(f.xmlUrl)
    if (!key) continue
    // Explicit re-add clears a prior prune dismiss.
    if (dismissed.delete(key)) {
      /* undismiss */
    }
    const next: LocalCatalogFeed = {
      title: f.title.trim() || key,
      xmlUrl: f.xmlUrl.trim(),
      htmlUrl: f.htmlUrl,
      category: f.category,
      groups: f.groups?.length ? [...f.groups] : undefined,
      sourceId: f.sourceId,
      sourceTitle: f.sourceTitle,
      addedAt: now,
    }
    const existingIdx = indexByUrl.get(key)
    if (existingIdx !== undefined) {
      if (!overwrite) continue
      const prev = snap.feeds[existingIdx]!
      snap.feeds[existingIdx] = { ...next, addedAt: prev.addedAt }
      updated += 1
      continue
    }
    indexByUrl.set(key, snap.feeds.length)
    snap.feeds.push(next)
    added += 1
  }
  snap.dismissedUrls = [...dismissed]
  snap.updatedAt = now
  saveLocalCatalog(snap)
  return { snapshot: snap, added, updated }
}

/**
 * Hide feeds from Catalog. Community local rows are removed; curated-only URLs
 * stay dismissed so they do not reappear from directory.json.
 * Also drops matching score keys.
 */
export function pruneCatalogFeeds(xmlUrls: string[]): {
  snapshot: LocalCatalogSnapshot
  dismissed: number
  removedCommunity: number
} {
  const snap = loadLocalCatalog()
  const keys = new Set(
    xmlUrls.map((u) => normalizeFeedUrl(u)).filter(Boolean),
  )
  if (keys.size === 0) {
    return { snapshot: snap, dismissed: 0, removedCommunity: 0 }
  }

  const beforeFeeds = snap.feeds.length
  snap.feeds = snap.feeds.filter((f) => !keys.has(normalizeFeedUrl(f.xmlUrl)))
  const removedCommunity = beforeFeeds - snap.feeds.length

  const dismissed = new Set(normalizeDismissed(snap.dismissedUrls))
  let addedDismiss = 0
  for (const key of keys) {
    if (!dismissed.has(key)) {
      dismissed.add(key)
      addedDismiss += 1
    }
  }
  snap.dismissedUrls = [...dismissed]

  if (snap.scores) {
    const nextScores: Record<string, ScanResult> = {}
    for (const [k, v] of Object.entries(snap.scores)) {
      if (keys.has(normalizeFeedUrl(k)) || keys.has(normalizeFeedUrl(v.xmlUrl))) {
        continue
      }
      nextScores[k] = v
    }
    snap.scores = nextScores
  }

  snap.updatedAt = Date.now()
  saveLocalCatalog(snap)
  return {
    snapshot: snap,
    dismissed: addedDismiss,
    removedCommunity,
  }
}
