import { loadConnections } from '@/tools/connections'

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

export type ScanTimeframe = '1d' | '7d' | '30d'

export interface ScanResult {
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
  scannedAt: string
}

const MAX_BATCH = 25

export function scanApiBase(): string {
  const fromEnv = (import.meta.env.VITE_SCAN_URL as string | undefined)?.replace(
    /\/$/,
    '',
  )
  if (fromEnv) return fromEnv
  // Production on Vercel: same-origin /api/*
  return ''
}

/** True when Scan/Tools API is expected to be reachable. */
export function scanApiConfigured(): boolean {
  if (import.meta.env.VITE_SCAN_URL) return true
  // Vite-only local without Worker: not configured. Deployed builds use /api.
  return !import.meta.env.DEV
}

/** @deprecated Prefer scanApiBase — kept for call-site greps. */
export function scanWorkerUrl(): string {
  return scanApiConfigured() ? scanApiBase() || 'same-origin' : ''
}

function apiPath(path: '/api/scan' | '/api/discover' | '/api/proxy'): string {
  const base = scanApiBase()
  return `${base}${path}`
}

export interface DiscoveredFeed {
  xmlUrl: string
  title?: string
  type?: string
}

export type DiscoverResponse =
  | { ok: true; pageUrl: string; candidates: DiscoveredFeed[] }
  | { ok: false; reason: string }

/** Ask Scan Worker to autodiscover feeds from an HTML page URL. */
export async function discoverFeeds(pageUrl: string): Promise<DiscoverResponse> {
  const base = scanApiBase()
  // Empty base is valid (same-origin /api on Vercel).
  void base
  const res = await fetch(apiPath('/api/discover'), {
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

/** Chunk URLs and POST to Scan Worker. */
export async function scanUrls(
  urls: string[],
  onChunk?: (done: number, total: number) => void,
  opts?: { rsshubBases?: string[] },
): Promise<ScanResult[]> {
  const base = scanApiBase()
  void base
  // `opts.rsshubBases` (even []) overrides the connections-store default — a
  // caller testing one specific base (e.g. rebuildScan's per-base pass) needs
  // to suppress the Worker's fallback-to-other-configured-bases behavior, or
  // a candidate can score "ok" via a different base than the one being
  // tested and produce a misleading per-base result.
  const rsshubBases = opts ? opts.rsshubBases : loadConnections().rsshub?.bases
  const out: ScanResult[] = []
  for (let i = 0; i < urls.length; i += MAX_BATCH) {
    const chunk = urls.slice(i, i + MAX_BATCH)
    const res = await fetch(apiPath('/api/scan'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        rsshubBases?.length ? { urls: chunk, rsshubBases } : { urls: chunk },
      ),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Scan HTTP ${res.status}: ${text.slice(0, 200)}`)
    }
    const body = (await res.json()) as { results?: ScanResult[] } | ScanResult[]
    const results = Array.isArray(body) ? body : (body.results ?? [])
    out.push(...results)
    onChunk?.(Math.min(i + chunk.length, urls.length), urls.length)
  }
  return out
}
