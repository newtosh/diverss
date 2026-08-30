import { otherBaseCandidates, parseBaseOrigins } from '../../../shared/rsshubCandidates'

export { rsshubCandidates } from '../../../shared/rsshubCandidates'

/** Candidate URLs (base host + original path/query) for rebuilding a feed
 * onto configured bases, regardless of the feed's current host — unlike
 * rsshubCandidates, no host-membership match is required. Used when a feed's
 * host was never itself a configured base (e.g. a retired personal proxy);
 * correctness is proven empirically by trial-fetching these, not by matching. */
export function buildRebuildCandidates(xmlUrl: string, bases: string[]): string[] {
  let url: URL
  try {
    url = new URL(xmlUrl.trim())
  } catch {
    return []
  }
  const host = url.hostname.toLowerCase()
  const baseOrigins = parseBaseOrigins(bases)

  return otherBaseCandidates(url.pathname + url.search, host, baseOrigins)
}
