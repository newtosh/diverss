/** Known publisher mirrors — keep in sync with workers/score/src/mirrors.ts */

const FEED_MIRRORS: Record<string, readonly string[]> = {
  'css-tricks.com': ['https://feeds.feedburner.com/CssTricks'],
}

/** Alternate feed URLs when the publisher host blocks Score egress. */
export function feedMirrorsFor(xmlUrl: string): string[] {
  try {
    const host = new URL(xmlUrl).hostname.replace(/^www\./i, '').toLowerCase()
    return [...(FEED_MIRRORS[host] ?? [])]
  } catch {
    return []
  }
}
