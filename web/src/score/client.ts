export type HealthStatus = 'ok' | 'stale' | 'unhealthy'

export type ReasonCode =
  | 'ok'
  | 'stale'
  | 'timeout'
  | 'dns'
  | 'tls'
  | 'http_status'
  | 'too_large'
  | 'blocked_url'
  | 'unparseable'
  | 'fetch_error'
  /** Local override — owner marked a Stale feed Unhealthy for prune triage. */
  | 'manual'

export type ScoreTimeframe = '1d' | '7d' | '30d'

export interface ScoreResult {
  schemaVersion: number
  xmlUrl: string
  health: HealthStatus
  reason: ReasonCode
  velocityUnknown: boolean
  posts1d?: number
  posts7d?: number
  posts30d?: number
  avgWords?: number
  lastDatedAt?: string
  /** @deprecated schema v1 */
  postsPerWeek?: number
  title?: string
  /** Extra detail for unhealthy rows (e.g. "HTTP 404"). */
  detail?: string
  scoredAt: string
}

const MAX_BATCH = 25

export function scoreWorkerUrl(): string {
  return (import.meta.env.VITE_SCORE_URL as string | undefined)?.replace(/\/$/, '') ?? ''
}

export interface DiscoveredFeed {
  xmlUrl: string
  title?: string
  type?: string
}

export type DiscoverResponse =
  | { ok: true; pageUrl: string; candidates: DiscoveredFeed[] }
  | { ok: false; reason: string }

/** Ask Score Worker to autodiscover feeds from an HTML page URL. */
export async function discoverFeeds(pageUrl: string): Promise<DiscoverResponse> {
  const base = scoreWorkerUrl()
  if (!base) {
    throw new Error('VITE_SCORE_URL is not configured')
  }
  const res = await fetch(`${base}/discover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: pageUrl }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Discover HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  const body = (await res.json()) as {
    error?: string
    pageUrl?: string
    candidates?: DiscoveredFeed[]
  }
  if (body.error) {
    return { ok: false, reason: body.error }
  }
  return {
    ok: true,
    pageUrl: body.pageUrl ?? pageUrl,
    candidates: body.candidates ?? [],
  }
}

/** Chunk URLs and POST to Score Worker. */
export async function scoreUrls(
  urls: string[],
  onChunk?: (done: number, total: number) => void,
): Promise<ScoreResult[]> {
  const base = scoreWorkerUrl()
  if (!base) {
    throw new Error('VITE_SCORE_URL is not configured')
  }
  const out: ScoreResult[] = []
  for (let i = 0; i < urls.length; i += MAX_BATCH) {
    const chunk = urls.slice(i, i + MAX_BATCH)
    const res = await fetch(`${base}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: chunk }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Score Worker HTTP ${res.status}: ${text.slice(0, 200)}`)
    }
    const body = (await res.json()) as { results?: ScoreResult[] } | ScoreResult[]
    const results = Array.isArray(body) ? body : (body.results ?? [])
    out.push(...results)
    onChunk?.(Math.min(i + chunk.length, urls.length), urls.length)
  }
  return out
}
