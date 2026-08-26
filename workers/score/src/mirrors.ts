/** Known publisher mirrors when the origin blocks datacenter Score egress. */

const FEED_MIRRORS: Record<string, readonly string[]> = {
  // Origin /feed is Cloudflare-403 from Vercel; Feedburner still serves the same feed.
  'css-tricks.com': ['https://feeds.feedburner.com/CssTricks'],
}

/** Alternate feed URLs to try when the publisher host blocks Score fetch. */
export function feedMirrorsFor(xmlUrl: string): string[] {
  try {
    const host = new URL(xmlUrl).hostname.replace(/^www\./i, '').toLowerCase()
    return [...(FEED_MIRRORS[host] ?? [])]
  } catch {
    return []
  }
}
