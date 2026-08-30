/**
 * Host-swap candidates for an RSSHub-routed feed. Imported by both
 * web/src/tools/rsshub.ts and workers/scan/src/rsshub.ts — this is the one
 * copy; do not fork it again.
 */

export function parseBaseOrigins(bases: string[]): URL[] {
  return bases
    .map((b) => {
      try {
        return new URL(b.trim())
      } catch {
        return null
      }
    })
    .filter((u): u is URL => u !== null)
}

/** Candidate URLs (base origin + original path/query) for every base other than one matching `host`. */
export function otherBaseCandidates(suffix: string, host: string, baseOrigins: URL[]): string[] {
  const out: string[] = []
  for (const base of baseOrigins) {
    if (base.hostname.toLowerCase() === host) continue
    out.push(base.origin + suffix)
  }
  return out
}

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
  const baseOrigins = parseBaseOrigins(bases)

  const matches = baseOrigins.some((b) => b.hostname.toLowerCase() === host)
  if (!matches) return []

  return otherBaseCandidates(url.pathname + url.search, host, baseOrigins)
}
