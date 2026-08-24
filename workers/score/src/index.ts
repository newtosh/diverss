import { corsHeaders } from './cors'
import { fetchAndScore, mapPool } from './fetch'
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

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return json({ error: 'invalid_json' }, 400, cors ?? {})
    }

    const urls = extractUrls(body)
    if (urls == null) {
      return json({ error: 'invalid_body' }, 400, cors ?? {})
    }
    if (urls.length === 0) {
      return json({ error: 'empty_batch' }, 400, cors ?? {})
    }
    if (urls.length > MAX_BATCH) {
      return json({ error: 'batch_too_large' }, 400, cors ?? {})
    }

    const now = new Date()
    const results: ScoreResult[] = await mapPool(
      urls,
      CONCURRENCY,
      (url) => fetchAndScore(url, now),
    )

    // Never include upstream bodies — results are score records only.
    return json({ results }, 200, cors ?? {})
  },
}

function extractUrls(body: unknown): string[] | null {
  if (!body || typeof body !== 'object') return null
  const urls = (body as { urls?: unknown }).urls
  if (!Array.isArray(urls)) return null
  if (!urls.every((u) => typeof u === 'string')) return null
  return urls as string[]
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
export { parseFeed } from './parse'
export { checkUrlShape, assertSafeUrl, isPrivateOrMetadataIP } from './ssrf'
export { fetchAndScore, mapPool } from './fetch'
export type { Env, ScoreResult, ParsedFeed } from './types'
