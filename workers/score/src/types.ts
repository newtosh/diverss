export const SCHEMA_VERSION = 2
export const WINDOW_1D_MS = 24 * 60 * 60 * 1000
export const WINDOW_7D_MS = 7 * 24 * 60 * 60 * 1000
export const WINDOW_30D_MS = 30 * 24 * 60 * 60 * 1000
export const WINDOW_90D_MS = 90 * 24 * 60 * 60 * 1000
export const MAX_BATCH = 25
export const CONCURRENCY = 4
export const MAX_BODY_BYTES = 5 * 1024 * 1024 // 5 MiB
export const MAX_REDIRECTS = 3
export const FETCH_TIMEOUT_MS = 15_000
export const USER_AGENT =
  'DiveRSS/0.1 (+https://github.com/newtosh/diverss; feed-health)'

/** Prefer a browser-like UA for HTML page fetches (Cloudflare often challenges bot UAs). */
export const HTML_FETCH_USER_AGENT =
  'Mozilla/5.0 (compatible; DiveRSS/0.1; +https://github.com/newtosh/diverss)'

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
  title?: string
  /** Extra human detail (e.g. "HTTP 404") for unhealthy results. */
  detail?: string
  scoredAt: string
}

export interface ParsedItem {
  published: Date | null
  link?: string
  content?: string
  description?: string
}

export interface ParsedFeed {
  title: string
  items: ParsedItem[]
}

export interface Env {
  ALLOWED_ORIGINS?: string
}
