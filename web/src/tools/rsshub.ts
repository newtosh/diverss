/**
 * Host-swap candidates for an RSSHub-routed feed.
 * Keep in sync with workers/scan/src/rsshub.ts.
 */

/** Ordered candidate URLs (base host + original path/query) for a feed whose
 * current host matches one of the configured RSSHub bases. Empty when no
 * configured base matches — the feed isn't RSSHub-routed. */
export function rsshubCandidates(xmlUrl: string, bases: string[]): string[] {
  let url: URL
  try {
    url = new URL(xmlUrl.trim())
  } catch {
    return []
  }
  const host = url.hostname.toLowerCase()

  const baseOrigins = bases
    .map((b) => {
      try {
        return new URL(b.trim())
      } catch {
        return null
      }
    })
    .filter((u): u is URL => u !== null)

  const matches = baseOrigins.some((b) => b.hostname.toLowerCase() === host)
  if (!matches) return []

  const suffix = url.pathname + url.search
  const out: string[] = []
  for (const base of baseOrigins) {
    if (base.hostname.toLowerCase() === host) continue
    out.push(base.origin + suffix)
  }
  return out
}
