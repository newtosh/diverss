import { updateFeedXmlUrlByOldUrl } from '@/opml/mutate'
import { flattenFeeds } from '@/opml/types'
import { loadWorkspaceSnapshot, saveWorkspaceSnapshot } from '@/db/workspace'
import type { ScanResult } from '@/scan/client'
import { scanUrls } from '@/scan/client'

import { buildRebuildCandidates } from './rsshub'

export interface RebuildCandidate {
  xmlUrl: string
  title: string
  candidateUrl: string
  result: ScanResult
}

/**
 * For each unhealthy workspace feed, try one candidate URL per configured
 * base (in priority order) until one scores non-unhealthy. Feeds with no
 * working candidate across all bases are simply absent from the result.
 */
export async function scanForRebuilds(
  document: import('@/opml/types').OpmlDocument,
  scores: Record<string, ScanResult>,
  bases: string[],
): Promise<RebuildCandidate[]> {
  if (bases.length === 0) return []

  const unhealthy = flattenFeeds(document.outlines).filter(
    (f) => scores[f.xmlUrl]?.health === 'unhealthy',
  )
  if (unhealthy.length === 0) return []

  const found: RebuildCandidate[] = []
  let remaining = unhealthy

  for (const base of bases) {
    if (remaining.length === 0) break

    const attempts = remaining
      .map((feed) => ({
        feed,
        candidateUrl: buildRebuildCandidates(feed.xmlUrl, [base])[0],
      }))
      .filter((a): a is { feed: (typeof remaining)[number]; candidateUrl: string } =>
        Boolean(a.candidateUrl),
      )
    if (attempts.length === 0) continue

    // Suppress the Worker's cross-base fallback (opts.rsshubBases: []) — this
    // pass tests one specific base, so a candidate must pass on that base
    // alone, not via a silent retry against a different configured base.
    const results = await scanUrls(
      attempts.map((a) => a.candidateUrl),
      undefined,
      { rsshubBases: [] },
    )
    const resultByUrl = new Map(results.map((r) => [r.xmlUrl, r] as const))
    const attemptByFeedUrl = new Map(attempts.map((a) => [a.feed.xmlUrl, a] as const))

    const stillRemaining: typeof remaining = []
    for (const feed of remaining) {
      const attempt = attemptByFeedUrl.get(feed.xmlUrl)
      const result = attempt ? resultByUrl.get(attempt.candidateUrl) : undefined
      if (attempt && result && result.health !== 'unhealthy') {
        found.push({
          xmlUrl: feed.xmlUrl,
          title: feed.text,
          candidateUrl: attempt.candidateUrl,
          result,
        })
      } else {
        stillRemaining.push(feed)
      }
    }
    remaining = stillRemaining
  }

  return found
}

/**
 * Apply a found rebuild candidate: rewrite the feed's xmlUrl in the
 * workspace and store the already-fetched score under the new URL — no
 * second fetch. Returns false without writing if the feed can no longer be
 * found (workspace changed since the scan ran) — callers must not report
 * success on that path.
 */
export async function applyRebuildCandidate(candidate: RebuildCandidate): Promise<boolean> {
  const snap = await loadWorkspaceSnapshot()
  const stillPresent = flattenFeeds(snap.document.outlines).some(
    (f) => f.xmlUrl === candidate.xmlUrl,
  )
  if (!stillPresent) return false

  const document = updateFeedXmlUrlByOldUrl(
    snap.document,
    candidate.xmlUrl,
    candidate.candidateUrl,
  )
  const scores = { ...snap.scores }
  delete scores[candidate.xmlUrl]
  scores[candidate.candidateUrl] = candidate.result

  await saveWorkspaceSnapshot({ document, scores, timeframe: snap.timeframe })
  return true
}
