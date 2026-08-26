import { corsHeaders } from './cors'
import { discoverFeedsFromPage } from './discover'
import { fetchAndScore, mapPool } from './fetch'
import { forwardProxyRequest, parseProxyBody } from './proxy'
import type { Env, ScoreResult } from './types'
import { CONCURRENCY, MAX_BATCH } from './types'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env)

    if (request.method === 'OPTIONS') {
      if (cors == null) {
        return new Response(null, { status: 403 })
      }
      return new Response(null, { status: 204, headers: cors })
    }

    if (request.method !== 'POST') {
      return json(
        { error: 'method_not_allowed' },
        405,
        cors ?? {},
      )
    }

    if (cors == null && request.headers.get('Origin')) {
      return json({ error: 'origin_not_allowed' }, 403, {})
    }

    const path = normalizePath(new URL(request.url).pathname)
    if (path === '/discover') {
      return handleDiscover(request, cors ?? {})
    }
    if (path === '/proxy') {
      return handleProxy(request, cors ?? {})
    }

    return handleScore(request, cors ?? {})
  },
}

async function handleProxy(
  request: Request,
  cors: Record<string, string>,
): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid_json' }, 400, cors)
  }

  const parsed = parseProxyBody(body)
  if (!parsed) {
    return json({ error: 'invalid_body' }, 400, cors)
  }

  const result = await forwardProxyRequest(parsed)
  if (!result.ok) {
    return json({ error: result.error }, result.status, cors)
  }
  return json(
    {
      status: result.status,
      bodyText: result.bodyText,
      headers: result.headers,
    },
    200,
    cors,
  )
}

async function handleDiscover(
  request: Request,
  cors: Record<string, string>,
): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid_json' }, 400, cors)
  }

  const url = extractDiscoverUrl(body)
  if (url == null) {
    return json({ error: 'invalid_body' }, 400, cors)
  }

  const result = await discoverFeedsFromPage(url)
  if (!result.ok) {
    return json({ error: result.reason, candidates: [] }, 200, cors)
  }
  return json(
    { pageUrl: result.pageUrl, candidates: result.candidates },
    200,
    cors,
  )
}

async function handleScore(
  request: Request,
  cors: Record<string, string>,
): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid_json' }, 400, cors)
  }

  const urls = extractUrls(body)
  if (urls == null) {
    return json({ error: 'invalid_body' }, 400, cors)
  }
  if (urls.length === 0) {
    return json({ error: 'empty_batch' }, 400, cors)
  }
  if (urls.length > MAX_BATCH) {
    return json({ error: 'batch_too_large' }, 400, cors)
  }

  const now = new Date()
  const results: ScoreResult[] = await mapPool(
    urls,
    CONCURRENCY,
    (u) => fetchAndScore(u, now),
  )

  // Never include upstream bodies — results are score records only.
  return json({ results }, 200, cors)
}

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }
  return pathname || '/'
}

function extractUrls(body: unknown): string[] | null {
  if (!body || typeof body !== 'object') return null
  const urls = (body as { urls?: unknown }).urls
  if (!Array.isArray(urls)) return null
  if (!urls.every((u) => typeof u === 'string')) return null
  return urls as string[]
}

function extractDiscoverUrl(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const url = (body as { url?: unknown }).url
  if (typeof url !== 'string' || !url.trim()) return null
  return url.trim()
}

function json(
  data: unknown,
  status: number,
  headers: Record<string, string>,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  })
}

export { scoreParsedFeed, unhealthy } from './score'
export { parseFeed, inferDateFromPermalink } from './parse'
export { checkUrlShape, assertSafeUrl, isPrivateOrMetadataIP } from './ssrf'
export { fetchAndScore, mapPool } from './fetch'
export { discoverFeedsFromPage, parseAlternateFeedLinks, wellKnownFeedUrls } from './discover'
export type { Env, ScoreResult, ParsedFeed } from './types'
export type { DiscoveredFeed } from './discover'
