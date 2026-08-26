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
