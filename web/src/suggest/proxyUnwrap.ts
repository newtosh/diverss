/** Local suggestions when a feed URL looks like a known proxy/wrapper. */

export interface FeedSuggestion {
  xmlUrl: string
  label: string
  source: 'proxy_unwrap' | 'autodiscover'
}

export interface ProxyUnwrapResult {
  suggestions: FeedSuggestion[]
  /** Homepage (or section) to run HTML feed autodiscovery against. */
  discoverPageUrl?: string
}

const RSSHUB_HOST_RE = /(^|\.)rsshub\./i

/** Curated RSSHub route → official site + feed(s). First path segment is the route id. */
const RSSHUB_OFFICIAL: Record<
  string,
  { site: string; feeds: { xmlUrl: string; label: string }[] }
> = {
  theverge: {
    site: 'https://www.theverge.com/',
    feeds: [
      {
        xmlUrl: 'https://www.theverge.com/rss/index.xml',
        label: 'Official The Verge RSS',
      },
    ],
  },
  techcrunch: {
    site: 'https://techcrunch.com/',
    feeds: [{ xmlUrl: 'https://techcrunch.com/feed/', label: 'Official TechCrunch feed' }],
  },
  wired: {
    site: 'https://www.wired.com/',
    feeds: [{ xmlUrl: 'https://www.wired.com/feed/rss', label: 'Official WIRED RSS' }],
  },
  arstechnica: {
    site: 'https://arstechnica.com/',
    feeds: [
      {
        xmlUrl: 'https://feeds.arstechnica.com/arstechnica/index',
        label: 'Official Ars Technica feed',
      },
    ],
  },
  engadget: {
    site: 'https://www.engadget.com/',
    feeds: [
      {
        xmlUrl: 'https://www.engadget.com/rss.xml',
        label: 'Official Engadget RSS',
      },
    ],
  },
  bbc: {
    site: 'https://www.bbc.com/news',
    feeds: [
      {
        xmlUrl: 'https://feeds.bbci.co.uk/news/rss.xml',
        label: 'BBC News RSS',
      },
    ],
  },
  nytimes: {
    site: 'https://www.nytimes.com/',
    feeds: [
      {
        xmlUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
        label: 'NYTimes Home Page RSS',
      },
    ],
  },
  github: {
    site: 'https://github.com/blog',
    feeds: [
      {
        xmlUrl: 'https://github.blog/feed/',
        label: 'GitHub Blog feed',
      },
    ],
  },
}

function isRssHubHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return h === 'rsshub.app' || RSSHUB_HOST_RE.test(h)
}

/**
 * Suggest canonical feeds for proxied URLs (RSSHub, etc.).
 * Safe offline — no network.
 */
export function proxyUnwrap(xmlUrl: string): ProxyUnwrapResult {
  let url: URL
  try {
    url = new URL(xmlUrl.trim())
  } catch {
    return { suggestions: [] }
  }

  if (!isRssHubHost(url.hostname)) {
    return { suggestions: [] }
  }

  const segments = url.pathname.split('/').filter(Boolean)
  if (segments.length === 0) {
    return { suggestions: [] }
  }

  const route = segments[0]!.toLowerCase()
  const entry = RSSHUB_OFFICIAL[route]
  if (!entry) {
    // Unknown route: still offer discovery if we can guess a public site from the path.
    // Prefer not to invent feed URLs — only a homepage when the route looks like a brand.
    return { suggestions: [] }
  }

  const hub = segments[1]?.toLowerCase()
  const suggestions: FeedSuggestion[] = entry.feeds.map((f) => ({
    xmlUrl: f.xmlUrl,
    label: f.label,
    source: 'proxy_unwrap' as const,
  }))

  // The Verge (and similar) expose per-hub RSS under /rss/:hub/index.xml
  if (route === 'theverge' && hub) {
    suggestions.unshift({
      xmlUrl: `https://www.theverge.com/rss/${encodeURIComponent(hub)}/index.xml`,
      label: `The Verge · ${hub} RSS`,
      source: 'proxy_unwrap',
    })
  }

  return {
    suggestions: dedupeSuggestions(suggestions),
    discoverPageUrl: entry.site,
  }
}

/** Prefer OPML htmlUrl, else proxy-derived site, else same-origin homepage guess. */
export function discoverPageForFeed(opts: {
  xmlUrl: string
  htmlUrl?: string
}): string | undefined {
  const html = opts.htmlUrl?.trim()
  if (html) {
    try {
      const u = new URL(html)
      if (u.protocol === 'http:' || u.protocol === 'https:') return u.href
    } catch {
      /* ignore */
    }
  }

  const unwrapped = proxyUnwrap(opts.xmlUrl)
  if (unwrapped.discoverPageUrl) return unwrapped.discoverPageUrl

  try {
    const u = new URL(opts.xmlUrl.trim())
    if (isRssHubHost(u.hostname)) return undefined
    // Same host root — useful when xmlUrl is a dead path on a live site.
    return `${u.protocol}//${u.host}/`
  } catch {
    return undefined
  }
}

export function dedupeSuggestions(items: FeedSuggestion[]): FeedSuggestion[] {
  const seen = new Set<string>()
  const out: FeedSuggestion[] = []
  for (const item of items) {
    const key = item.xmlUrl.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}
