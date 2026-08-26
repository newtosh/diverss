/** Normalize feed URLs for exact membership / dedupe (not for display). */
export function normalizeFeedUrl(url: string): string {
  const raw = url.trim()
  if (!raw) return ''
  try {
    const u = new URL(raw)
    u.hash = ''
    u.username = ''
    u.password = ''
    u.hostname = u.hostname.replace(/^www\./i, '').toLowerCase()
    // /feed/ and /feed are the same outline for membership.
    u.pathname = u.pathname.replace(/\/+$/, '')
    // Drop default ports
    if (
      (u.protocol === 'http:' && u.port === '80') ||
      (u.protocol === 'https:' && u.port === '443')
    ) {
      u.port = ''
    }
    // URL#toString keeps trailing slash on bare origins; strip for stable keys.
    return u.toString().replace(/\/$/, '').toLowerCase()
  } catch {
    return raw.replace(/\/+$/, '').toLowerCase()
  }
}

/**
 * Registrable-ish site root: label between subdomain and public suffix.
 * `feeds.macrumors.com` → `macrumors`, `www.macstories.net` → `macstories`.
 */
export function feedDomainRoot(url: string): string {
  const raw = url.trim()
  if (!raw) return ''
  try {
    const host = new URL(raw).hostname.replace(/^www\./i, '').toLowerCase()
    const parts = host.split('.').filter(Boolean)
    if (parts.length === 0) return ''
    if (parts.length === 1) return parts[0]!

    const last = parts[parts.length - 1]!
    const second = parts[parts.length - 2]!
    // example.co.uk / example.com.au
    if (
      parts.length >= 3 &&
      last.length === 2 &&
      ['co', 'com', 'org', 'net', 'gov', 'ac', 'edu'].includes(second)
    ) {
      return parts[parts.length - 3]!
    }
    return second
  } catch {
    return ''
  }
}

/** Hosts where many unrelated feeds share one domain — exact URL only. */
function isAggregatorHost(hostname: string): boolean {
  const h = hostname.replace(/^www\./i, '').toLowerCase()
  if (h === 'youtube.com' || h.endsWith('.youtube.com') || h === 'youtu.be') {
    return true
  }
  if (h === 'medium.com' || h.endsWith('.medium.com')) return true
  if (h.includes('feedburner')) return true
  if (h === 'substack.com') return true
  if (h === 'blogspot.com' || h.endsWith('.blogspot.com')) return true
  return false
}

/**
 * Keys used to decide “already in workspace”: exact normalized URL, plus
 * `site:<root>` when the host is not a multi-feed aggregator.
 */
export function feedMembershipKeys(url: string): string[] {
  const exact = normalizeFeedUrl(url)
  if (!exact) return []
  const keys = [exact]
  try {
    const host = new URL(url.trim()).hostname
    if (isAggregatorHost(host)) return keys
    const root = feedDomainRoot(url)
    if (root) keys.push(`site:${root}`)
  } catch {
    /* exact only */
  }
  return keys
}

export function feedsShareMembership(a: string, b: string): boolean {
  const ka = new Set(feedMembershipKeys(a))
  return feedMembershipKeys(b).some((k) => ka.has(k))
}
