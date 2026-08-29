import { discoverFeedsFromPage } from './discover'
import { fetchAndScan, mapPool } from './fetch'
import { forwardProxyRequest, parseProxyBody } from './proxy'
import type { Env, ScanResult } from './types'
import { CONCURRENCY, MAX_BATCH } from './types'
import { corsHeaders } from './cors'

export function normalizeApiPath(pathname: string): string {
  let p = pathname
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  if (p === '/api/scan') return '/scan'
  if (p === '/api/discover') return '/discover'
  if (p === '/api/proxy') return '/proxy'
  // Legacy Worker roots
  if (p === '/' || p === '') return '/scan'
  if (p === '/discover') return '/discover'
  if (p === '/proxy') return '/proxy'
  return p || '/scan'
}

export function jsonResponse(
  data: unknown,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  })
}

function extractUrls(body: unknown): string[] | null {
  if (!body || typeof body !== 'object') return null
  const urls = (body as { urls?: unknown }).urls
  if (!Array.isArray(urls)) return null
  if (!urls.every((u) => typeof u === 'string')) return null
  return urls as string[]
}

/** A real RSSHub connection is a handful of bases; cap generously to bound
 * per-request fetch fan-out. Without a cap, a caller could pair a bogus
 * `urls` host with a long `rsshubBases` list and turn resolveFeedBody's
 * candidate loop into an open fetch proxy against arbitrary hosts. */
export const MAX_RSSHUB_BASES = 5

/** Optional user-configured RSSHub bases. Malformed/absent -> []. Never rejects the batch. */
export function extractRsshubBases(body: unknown): string[] {
  if (!body || typeof body !== 'object') return []
  const bases = (body as { rsshubBases?: unknown }).rsshubBases
  if (!Array.isArray(bases) || !bases.every((b) => typeof b === 'string')) return []
  return (bases as string[]).slice(0, MAX_RSSHUB_BASES)
}

function extractDiscoverUrl(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const url = (body as { url?: unknown }).url
  if (typeof url !== 'string' || !url.trim()) return null
  return url.trim()
}

export async function handleScanPost(
  request: Request,
  cors: Record<string, string>,
): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400, cors)
  }

  const urls = extractUrls(body)
  if (urls == null) return jsonResponse({ error: 'invalid_body' }, 400, cors)
  if (urls.length === 0) return jsonResponse({ error: 'empty_batch' }, 400, cors)
  if (urls.length > MAX_BATCH) {
    return jsonResponse({ error: 'batch_too_large' }, 400, cors)
  }

  const rsshubBases = extractRsshubBases(body)
  const now = new Date()
  const results: ScanResult[] = await mapPool(urls, CONCURRENCY, (u) =>
    fetchAndScan(u, now, { rsshubBases }),
  )
  return jsonResponse({ results }, 200, cors)
}

export async function handleDiscoverPost(
  request: Request,
  cors: Record<string, string>,
): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400, cors)
  }

  const url = extractDiscoverUrl(body)
  if (url == null) return jsonResponse({ error: 'invalid_body' }, 400, cors)

  const result = await discoverFeedsFromPage(url)
  if (!result.ok) {
    return jsonResponse({ error: result.reason, candidates: [] }, 200, cors)
  }
  return jsonResponse(
    { pageUrl: result.pageUrl, candidates: result.candidates },
    200,
    cors,
  )
}

export async function handleProxyPost(
  request: Request,
  cors: Record<string, string>,
): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400, cors)
  }

  const parsed = parseProxyBody(body)
  if (!parsed) return jsonResponse({ error: 'invalid_body' }, 400, cors)

  const result = await forwardProxyRequest(parsed)
  if (!result.ok) {
    return jsonResponse({ error: result.error }, result.status, cors)
  }
  return jsonResponse(
    {
      status: result.status,
      bodyText: result.bodyText,
      headers: result.headers,
    },
    200,
    cors,
  )
}

/** Shared entry for Worker and Vercel — CORS + method + route. */
export async function handleApiRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  const cors = corsHeaders(request, env)

  if (request.method === 'OPTIONS') {
    if (cors == null) return new Response(null, { status: 403 })
    return new Response(null, { status: 204, headers: cors })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405, cors ?? {})
  }

  if (cors == null && request.headers.get('Origin')) {
    return jsonResponse({ error: 'origin_not_allowed' }, 403, {})
  }

  const headers = cors ?? {}
  const path = normalizeApiPath(new URL(request.url).pathname)

  if (path === '/discover') return handleDiscoverPost(request, headers)
  if (path === '/proxy') return handleProxyPost(request, headers)
  if (path === '/scan') return handleScanPost(request, headers)

  return jsonResponse({ error: 'not_found' }, 404, headers)
}
