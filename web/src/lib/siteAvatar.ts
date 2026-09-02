/** Prefer htmlUrl host; fall back to xmlUrl (feed) host. */
export function siteHostname(xmlUrl: string, htmlUrl?: string): string | null {
  for (const raw of [htmlUrl, xmlUrl]) {
    if (!raw) continue
    try {
      const host = new URL(raw).hostname
      if (host) return host.replace(/^www\./i, '')
    } catch {
      /* try next */
    }
  }
  return null
}

/** Favicon URL via DuckDuckGo icon CDN (no API key; img request only). */
export function siteAvatarUrl(xmlUrl: string, htmlUrl?: string): string | null {
  const host = siteHostname(xmlUrl, htmlUrl)
  if (!host) return null
  return `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`
}

export function siteInitial(text: string): string {
  const t = text.trim()
  if (!t) return '?'
  return t.charAt(0).toUpperCase()
}

/**
 * Deterministic hue (0-359) from a seed string, used to give each feed's
 * avatar a distinct tint. Real pixel-based color extraction isn't possible
 * here — the favicon CDN sends no CORS header, so canvas reads are blocked.
 */
export function siteHue(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return hash % 360
}
