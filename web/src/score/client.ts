export type HealthStatus = 'ok' | 'unhealthy'

export type ReasonCode =
  | 'ok'
  | 'timeout'
  | 'dns'
  | 'tls'
  | 'http_status'
  | 'too_large'
  | 'blocked_url'
  | 'unparseable'
  | 'fetch_error'

export interface ScoreResult {
  schemaVersion: number
  xmlUrl: string
  health: HealthStatus
  reason: ReasonCode
  velocityUnknown: boolean
  postsPerWeek?: number
  itemCountWindow?: number
  title?: string
  scoredAt: string
}

const MAX_BATCH = 25

export function scoreWorkerUrl(): string {
  return (import.meta.env.VITE_SCORE_URL as string | undefined)?.replace(/\/$/, '') ?? ''
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
  const unique = [...new Set(urls.filter(Boolean))]
  const out: ScoreResult[] = []
  for (let i = 0; i < unique.length; i += MAX_BATCH) {
    const chunk = unique.slice(i, i + MAX_BATCH)
    const res = await fetch(`${base}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: chunk }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Score Worker HTTP ${res.status}${text ? `: ${text}` : ''}`)
    }
    const body = (await res.json()) as { results?: ScoreResult[] } | ScoreResult[]
    const results = Array.isArray(body) ? body : (body.results ?? [])
    out.push(...results)
    onChunk?.(Math.min(i + chunk.length, unique.length), unique.length)
  }
  return out
}
