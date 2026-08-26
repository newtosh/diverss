import { parseFeed } from './parse'
import { scoreParsedFeed, unhealthy } from './score'
import { assertSafeUrl } from './ssrf'
import { isHostBlockHttpDetail } from './block'
import { feedMirrorsFor } from './mirrors'
import type { ReasonCode, ScoreResult } from './types'
import {
  FETCH_TIMEOUT_MS,
  HTML_FETCH_USER_AGENT,
  MAX_BODY_BYTES,
  MAX_REDIRECTS,
  USER_AGENT,
} from './types'

export type FeedBodyOk = { body: string; fetchUrl: string }
export type FeedBodyErr = { reason: ReasonCode; detail?: string }

/**
 * Fetch a feed body with UA retry and known publisher mirrors.
 * `fetchUrl` is the URL that actually returned the body (origin or mirror).
 */
export async function resolveFeedBody(xmlUrl: string): Promise<FeedBodyOk | FeedBodyErr> {
  const primary = await fetchFeedBodyWithUaRetry(xmlUrl)
  if (!('reason' in primary)) {
    return { body: primary.body, fetchUrl: xmlUrl }
  }
  if (
    primary.reason === 'http_status' &&
    isHostBlockHttpDetail(primary.detail)
  ) {
    for (const mirror of feedMirrorsFor(xmlUrl)) {
      const mirrored = await fetchFeedBodyWithUaRetry(mirror)
      if ('reason' in mirrored) continue
      return { body: mirrored.body, fetchUrl: mirror }
    }
  }
  return primary
}

export async function fetchAndScore(
  xmlUrl: string,
  now: Date = new Date(),
): Promise<ScoreResult> {
  const bodyOrErr = await resolveFeedBody(xmlUrl)
  if ('reason' in bodyOrErr) {
    return unhealthy(xmlUrl, bodyOrErr.reason, now, bodyOrErr.detail)
  }
  const feed = parseFeed(bodyOrErr.body)
  if (feed == null) {
    return unhealthy(xmlUrl, 'unparseable', now)
  }
  // Keep the OPML/request URL; mirrors are only an egress path.
  return scoreParsedFeed(xmlUrl, feed, now)
}

const FEED_ACCEPT =
  'application/atom+xml, application/rss+xml, application/xml, text/xml, */*'

async function fetchFeedBodyWithUaRetry(
  xmlUrl: string,
): Promise<{ body: string } | FeedBodyErr> {
  const first = await fetchFeedBodyOnce(xmlUrl, {
    'User-Agent': USER_AGENT,
    Accept: FEED_ACCEPT,
  })
  if (!('reason' in first)) return first
  // Many publishers (Cloudflare) challenge or block datacenter bot UAs / IPs.
  if (first.reason === 'http_status' && isHostBlockHttpDetail(first.detail)) {
    const retry = await fetchFeedBodyOnce(xmlUrl, {
      'User-Agent': HTML_FETCH_USER_AGENT,
      Accept: FEED_ACCEPT,
      'Accept-Language': 'en-US,en;q=0.9',
    })
    if (!('reason' in retry)) return retry
    return first.detail ? first : retry
  }
  return first
}

async function fetchFeedBodyOnce(
  xmlUrl: string,
  headers: Record<string, string>,
): Promise<{ body: string } | FeedBodyErr> {
  let current = xmlUrl
  let redirects = 0

  while (true) {
    const safe = await assertSafeUrl(current)
    if (!safe.ok) {
      return { reason: 'blocked_url' }
    }

    let resp: Response
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
      try {
        resp = await fetch(safe.url.href, {
          method: 'GET',
          redirect: 'manual',
          headers,
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
      return { reason: 'http_status', detail: `HTTP ${resp.status}` }
    }

    const read = await readBodyCapped(resp)
    if ('reason' in read) return read
    return { body: read.body }
  }
}

async function readBodyCapped(
  resp: Response,
): Promise<{ body: string } | { reason: ReasonCode }> {
  if (resp.body == null) {
    return { body: '' }
  }
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

/** Run async work over items with a fixed concurrency pool. */
export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(items.length, 1)) },
    async () => {
      while (true) {
        const i = next++
        if (i >= items.length) return
        results[i] = await fn(items[i], i)
      }
    },
  )
  await Promise.all(workers)
  return results
}
