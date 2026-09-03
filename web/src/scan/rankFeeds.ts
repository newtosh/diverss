import type { ScanResult } from "@/scan/client";
import { lastPostAgeDays, reasonLabel } from "@/scan/presentation";

/** No post inside this window is inactive noise, not signal. Mirrors
 * scripts/discover-suggest/suggest.py's MIN_ACTIVITY_DAYS. */
export const MIN_ACTIVITY_DAYS = 30;

export type RankedBucket = "fresh" | "inactive" | "unverified";

export interface RankedFeed<T> {
  candidate: T;
  bucket: RankedBucket;
  scan?: ScanResult;
  /** Present when bucket === 'inactive'. */
  reason?: string;
}

/**
 * Bucket + rank candidates by their Scan result: fresh (post within
 * MIN_ACTIVITY_DAYS, sorted by posts30d desc then recency — volume beats
 * recency so a sparse-but-technically-active feed, e.g. a publisher's
 * secondary endpoint, doesn't outrank its higher-cadence sibling), inactive
 * (reachable but stale/unhealthy), unverified (no scan result — scan
 * failed or wasn't run for this URL).
 */
export function rankFeeds<T extends { xmlUrl: string }>(
  candidates: T[],
  scans: Map<string, ScanResult>,
  now = Date.now(),
): RankedFeed<T>[] {
  const fresh: RankedFeed<T>[] = [];
  const inactive: RankedFeed<T>[] = [];
  const unverified: RankedFeed<T>[] = [];

  for (const candidate of candidates) {
    const scan = scans.get(candidate.xmlUrl);
    if (!scan) {
      unverified.push({ candidate, bucket: "unverified" });
      continue;
    }
    if (scan.health !== "ok" || !scan.lastDatedAt) {
      inactive.push({
        candidate,
        bucket: "inactive",
        scan,
        reason: reasonLabel(scan.reason, scan.detail),
      });
      continue;
    }
    const ageDays = lastPostAgeDays(scan.lastDatedAt, now);
    if (ageDays != null && ageDays > MIN_ACTIVITY_DAYS) {
      inactive.push({
        candidate,
        bucket: "inactive",
        scan,
        reason: `last post ${ageDays}d ago`,
      });
      continue;
    }
    fresh.push({ candidate, bucket: "fresh", scan });
  }

  fresh.sort((a, b) => {
    const postsDiff = (b.scan!.posts30d ?? 0) - (a.scan!.posts30d ?? 0);
    if (postsDiff !== 0) return postsDiff;
    return Date.parse(b.scan!.lastDatedAt!) - Date.parse(a.scan!.lastDatedAt!);
  });

  return [...fresh, ...inactive, ...unverified];
}
