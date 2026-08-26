import { parseFeed } from './parse'
import { scoreParsedFeed, unhealthy } from './score'
import { assertSafeUrl } from './ssrf'
import type { ReasonCode, ScoreResult } from './types'
import {
  FETCH_TIMEOUT_MS,
  HTML_FETCH_USER_AGENT,
  MAX_BODY_BYTES,
  MAX_REDIRECTS,
  USER_AGENT,
} from './types'

export async function fetchAndScore(
  xmlUrl: string,
  now: Date = new Date(),
): Promise<ScoreResult> {
  const bodyOrErr = await fetchFeedBody(xmlUrl)
  if ('reason' in bodyOrErr) {
    return unhealthy(xmlUrl, bodyOrErr.reason, now, bodyOrErr.detail)
  }
  const feed = parseFeed(bodyOrErr.body)
  if (feed == null) {
    return unhealthy(xmlUrl, 'unparseable', now)
  }
  return scoreParsedFeed(xmlUrl, feed, now)
}

const FEED_ACCEPT =
  'application/atom+xml, application/rss+xml, application/xml, text/xml, */*'

async function fetchFeedBody(
  xmlUrl: string,
): Promise<{ body: string } | { reason: ReasonCode; detail?: string }> {
  const first = await fetchFeedBodyOnce(xmlUrl, {
    'User-Agent': USER_AGENT,
    Accept: FEED_ACCEPT,
  })
  if (!('reason' in first)) return first
  // Many publishers (Cloudflare) challenge or block datacenter bot UAs / IPs.
  // One retry with a browser-like UA recovers some false unhealthies.
  if (first.reason === 'http_status' && /HTTP (403|429|503)\b/.test(first.detail ?? '')) {
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
): Promise<{ body: string } | { reason: ReasonCode; detail?: string }> {
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
