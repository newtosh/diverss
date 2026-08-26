import { parseFeed } from './parse'
import { assertSafeUrl } from './ssrf'
import { mapPool } from './fetch'
import type { ReasonCode } from './types'
import {
  FETCH_TIMEOUT_MS,
  HTML_FETCH_USER_AGENT,
  MAX_BODY_BYTES,
  MAX_REDIRECTS,
  USER_AGENT,
} from './types'

export interface DiscoveredFeed {
  xmlUrl: string
  title?: string
  type?: string
}

export type DiscoverResult =
  | { ok: true; pageUrl: string; candidates: DiscoveredFeed[] }
  | { ok: false; reason: ReasonCode }

/** Common feed paths relative to site origin (and page directory). */
export const WELL_KNOWN_FEED_SUFFIXES = [
  '/atom.xml',
  '/rss.xml',
  '/feed.xml',
  '/index.xml',
  '/feed',
  '/rss',
  '/rss/news',
  '/rss/news/',
  '/rss.json',
  '/feed.json',
] as const

const PROBE_CONCURRENCY = 3
const MAX_PROBES = 20

/** Build absolute well-known feed URLs for a page (origin + optional path directory). */
export function wellKnownFeedUrls(pageUrl: string): string[] {
  let url: URL
  try {
    url = new URL(pageUrl)
  } catch {
    return []
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return []

  const origin = `${url.protocol}//${url.host}`
  const bases = new Set<string>([origin])

  // e.g. https://example.com/blog/post → also probe https://example.com/blog
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length > 0) {
    bases.add(`${origin}/${parts[0]}`)
  }
  // trailing directory of current path (without filename)
  if (parts.length > 1) {
    bases.add(`${origin}/${parts.slice(0, -1).join('/')}`)
  }

  const out: string[] = []
  const seen = new Set<string>()
  for (const base of bases) {
    for (const suffix of WELL_KNOWN_FEED_SUFFIXES) {
      const href = base.endsWith('/')
        ? `${base}${suffix.slice(1)}`
        : `${base}${suffix}`
      const key = href.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(href)
      if (out.length >= MAX_PROBES) return out
    }
  }
  return out
}

/** Fetch a page and discover feeds via HTML alternates + well-known path probes. */
export async function discoverFeedsFromPage(pageUrl: string): Promise<DiscoverResult> {
  const fetched = await fetchHtml(pageUrl)
  let finalPage = pageUrl
  const candidates: DiscoveredFeed[] = []
  const seen = new Set<string>()

  if (!('reason' in fetched)) {
    finalPage = fetched.finalUrl
    for (const c of [
      ...parseAlternateFeedLinks(fetched.body, fetched.finalUrl),
      ...parseAnchorFeedLinks(fetched.body, fetched.finalUrl),
    ]) {
      const key = c.xmlUrl.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      candidates.push(c)
    }
  } else if (
    fetched.reason === 'blocked_url' ||
    fetched.reason === 'dns' ||
    fetched.reason === 'tls'
  ) {
    // Can't safely reach the host at all.
    return { ok: false, reason: fetched.reason }
  }
  // http_status / timeout / fetch_error / too_large: still try well-known probes on origin.
  const probed = await probeWellKnownFeeds(finalPage, seen)
  candidates.push(...probed)

  // WordPress-style feed directories (e.g. css-tricks.com/rss-feeds/) when homepage is thin or blocked.
  if (candidates.length === 0) {
    for (const indexUrl of feedIndexPageUrls(finalPage)) {
      const indexFetched = await fetchHtml(indexUrl)
      if ('reason' in indexFetched) continue
      for (const c of [
        ...parseAlternateFeedLinks(indexFetched.body, indexFetched.finalUrl),
        ...parseAnchorFeedLinks(indexFetched.body, indexFetched.finalUrl),
      ]) {
        const key = c.xmlUrl.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        candidates.push(c)
      }
      if (candidates.length > 0) break
    }
  }

  return {
    ok: true,
    pageUrl: finalPage,
    candidates: rankDiscoveredFeeds(candidates),
  }
}

/** Common publisher feed-directory pages relative to the site origin. */
export function feedIndexPageUrls(pageUrl: string): string[] {
  try {
    const origin = new URL(pageUrl).origin
    return [
      `${origin}/rss-feeds/`,
      `${origin}/rss-feeds`,
      `${origin}/feeds/`,
      `${origin}/feeds`,
    ]
  } catch {
    return []
  }
}

/** Prefer primary site feeds; demote WordPress-style comments feeds. */
export function rankDiscoveredFeeds(candidates: DiscoveredFeed[]): DiscoveredFeed[] {
  return [...candidates].sort((a, b) => {
    const ac = isCommentsFeed(a) ? 1 : 0
    const bc = isCommentsFeed(b) ? 1 : 0
    if (ac !== bc) return ac - bc
    return 0
  })
}

export function isCommentsFeed(c: DiscoveredFeed): boolean {
  const url = c.xmlUrl.toLowerCase()
  const title = (c.title ?? '').toLowerCase()
  return (
    /\/comments?\/feed\/?/i.test(url) ||
    url.includes('feed=comments') ||
    title.includes('comments feed') ||
    title.includes('comment feed') ||
    (title.includes('comments') && title.includes('feed'))
  )
}

export function parseAlternateFeedLinks(html: string, baseUrl: string): DiscoveredFeed[] {
  const out: DiscoveredFeed[] = []
  const seen = new Set<string>()
  const linkRe = /<link\b[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = linkRe.exec(html)) !== null) {
    const tag = m[0]!
    const attrs = parseHtmlAttributes(tag)
    const rel = (attrs.rel ?? '').toLowerCase().split(/\s+/).filter(Boolean)
    if (!rel.includes('alternate')) continue
    const type = (attrs.type ?? '').toLowerCase()
    if (!isFeedMime(type)) continue
    const href = attrs.href?.trim()
    if (!href) continue
    let absolute: string
    try {
      absolute = new URL(href, baseUrl).href
    } catch {
      continue
    }
    const key = absolute.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const title = attrs.title?.trim()
    out.push({
      xmlUrl: absolute,
      ...(title ? { title } : {}),
      ...(type ? { type } : {}),
    })
  }
  return out
}

/**
 * Sites like AppleInsider expose RSS only as a nav <a href> (no link rel=alternate).
 * Keep obvious feed URLs; skip comments feeds and asset paths.
 */
export function parseAnchorFeedLinks(html: string, baseUrl: string): DiscoveredFeed[] {
  const out: DiscoveredFeed[] = []
  const seen = new Set<string>()
  const aRe = /<a\b[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = aRe.exec(html)) !== null) {
    const attrs = parseHtmlAttributes(m[0]!)
    const href = attrs.href?.trim()
    if (!href) continue
    if (!looksLikeFeedAnchor(href, attrs.title)) continue
    let absolute: string
    try {
      absolute = new URL(href, baseUrl).href
    } catch {
      continue
    }
    const key = absolute.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const title = attrs.title?.trim() || attrs['aria-label']?.trim()
    out.push({
      xmlUrl: absolute,
      ...(title ? { title } : {}),
      type: 'anchor',
    })
  }
  return out
}

/** Heuristic for <a href> feed candidates (not a full feed MIME check). */
export function looksLikeFeedAnchor(href: string, title?: string): boolean {
  const label = (title ?? '').toLowerCase().trim()
  if (
    label === 'rss' ||
    label === 'atom' ||
    label === 'feed' ||
    label.includes('rss feed') ||
    label.includes('atom feed')
  ) {
    return true
  }
  let path: string
  try {
    path = new URL(href, 'https://example.invalid').pathname.toLowerCase()
  } catch {
    return false
  }
  if (/\/comments?\/feed/i.test(path)) return false
  if (/\.(css|js|png|jpe?g|gif|webp|svg|ico|woff2?)$/i.test(path)) return false
  return /(\/rss(\/|$)|\/atom(\/|$)|\/feeds?(\/|$)|\/index\.xml$|\.xml$|\.rss$|\.atom$)/i.test(
    path,
  )
}

/** Probe well-known paths; keep URLs whose body parses as RSS/Atom. */
export async function probeWellKnownFeeds(
  pageUrl: string,
  already: Set<string>,
): Promise<DiscoveredFeed[]> {
  const urls = wellKnownFeedUrls(pageUrl).filter((u) => !already.has(u.toLowerCase()))
  if (urls.length === 0) return []

  const results = await mapPool(urls, PROBE_CONCURRENCY, async (u) => {
    const hit = await probeFeedUrl(u)
    if (hit) already.add(hit.xmlUrl.toLowerCase())
    return hit
  })
  return results.filter((r): r is DiscoveredFeed => r != null)
}

export async function probeFeedUrl(xmlUrl: string): Promise<DiscoveredFeed | null> {
  const bodyOrErr = await fetchBody(xmlUrl, {
    Accept:
      'application/atom+xml, application/rss+xml, application/xml, text/xml, application/feed+json, application/json, */*',
  })
  if ('reason' in bodyOrErr) return null
  if (looksLikeHtml(bodyOrErr.body)) return null
  const feed = parseFeed(bodyOrErr.body)
  if (feed == null) return null
  const title = feed.title.trim() || 'Feed'
  return {
    xmlUrl: bodyOrErr.finalUrl,
    title,
    type: 'well-known',
  }
}

/** True when body is clearly an HTML document rather than a feed. */
export function looksLikeHtml(body: string): boolean {
  const head = body.slice(0, 256).trim().toLowerCase()
  return (
    head.startsWith('<!doctype html') ||
    head.startsWith('<html') ||
    /^[\s\S]{0,64}<html[\s>]/i.test(head)
  )
}

function isFeedMime(type: string): boolean {
  if (!type) return false
  return (
    type.includes('rss') ||
    type.includes('atom') ||
    type.includes('json') ||
    type === 'text/xml' ||
    type === 'application/xml'
  )
}

/** Minimal attribute parser for `<link ...>` / `<a ...>` tags. */
export function parseHtmlAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gi
  let m: RegExpExecArray | null
  const body = tag.replace(/^<\s*[a-z0-9:-]+\b/i, ' ')
  while ((m = re.exec(body)) !== null) {
    const name = m[1]!.toLowerCase()
    if (name === '/' || name.startsWith('<')) continue
    const value = m[2] ?? m[3] ?? m[4] ?? ''
    attrs[name] = value
  }
  return attrs
}

async function fetchHtml(
  pageUrl: string,
): Promise<{ body: string; finalUrl: string } | { reason: ReasonCode }> {
  return fetchBody(pageUrl, {
    Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
    'User-Agent': HTML_FETCH_USER_AGENT,
  })
}

async function fetchBody(
  pageUrl: string,
  headers: Record<string, string>,
): Promise<{ body: string; finalUrl: string } | { reason: ReasonCode }> {
  let current = pageUrl
  let redirects = 0

  while (true) {
    const safe = await assertSafeUrl(current)
    if (!safe.ok) return { reason: 'blocked_url' }

    let resp: Response
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
      try {
        resp = await fetch(safe.url.href, {
          method: 'GET',
          redirect: 'manual',
          headers: {
            'User-Agent': USER_AGENT,
            ...headers,
          },
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timer)
      }
    } catch (err) {
      return { reason: mapFetchError(err) }
    }

    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get('Location')
      if (!loc || redirects >= MAX_REDIRECTS) {
        return { reason: 'fetch_error' }
      }
      redirects++
      try {
        current = new URL(loc, current).href
      } catch {
        return { reason: 'blocked_url' }
      }
      continue
    }

    if (resp.status < 200 || resp.status >= 300) {
      return { reason: 'http_status' }
    }

    const read = await readBodyCapped(resp)
    if ('reason' in read) return read
    // Cloudflare interstitial — treat as unreachable HTML, still allow well-known probes.
    if (looksLikeBotChallenge(read.body)) {
      return { reason: 'http_status' }
    }
    return { body: read.body, finalUrl: current }
  }
}

/** Cloudflare / bot-management challenge pages (no real site markup). */
export function looksLikeBotChallenge(body: string): boolean {
  const head = body.slice(0, 2048).toLowerCase()
  return (
    head.includes('just a moment') ||
    head.includes('cf-browser-verification') ||
    head.includes('cdn-cgi/challenge') ||
    (head.includes('cloudflare') && head.includes('challenge-platform'))
  )
}

async function readBodyCapped(
  resp: Response,
): Promise<{ body: string } | { reason: ReasonCode }> {
  if (resp.body == null) return { body: '' }
  const reader = resp.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BODY_BYTES) {
        try {
          await reader.cancel()
        } catch {
          /* ignore */
        }
        return { reason: 'too_large' }
      }
      chunks.push(value)
    }
  } catch (err) {
    return { reason: mapFetchError(err) }
  }
  const merged = new Uint8Array(size)
  let offset = 0
  for (const c of chunks) {
    merged.set(c, offset)
    offset += c.byteLength
  }
  return { body: new TextDecoder('utf-8', { fatal: false }).decode(merged) }
}

function mapFetchError(err: unknown): ReasonCode {
  const msg = err instanceof Error ? err.message : String(err)
  const lower = msg.toLowerCase()
  if (
    lower.includes('timeout') ||
    lower.includes('aborted') ||
    lower.includes('deadline')
  ) {
    return 'timeout'
  }
  if (lower.includes('certificate') || lower.includes('tls') || lower.includes('ssl')) {
    return 'tls'
  }
  if (lower.includes('dns') || lower.includes('getaddrinfo') || lower.includes('name not resolved')) {
    return 'dns'
  }
  return 'fetch_error'
}
