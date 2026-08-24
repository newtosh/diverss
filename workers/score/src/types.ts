export const SCHEMA_VERSION = 1
export const VELOCITY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
export const MAX_BATCH = 25
export const CONCURRENCY = 4
export const MAX_BODY_BYTES = 2 * 1024 * 1024 // 2 MiB
export const MAX_REDIRECTS = 3
export const FETCH_TIMEOUT_MS = 15_000
export const USER_AGENT =
  'DiveRSS/0.1 (+https://github.com/jonn/diverss; feed-health)'

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

export interface ParsedItem {
  published: Date | null
}

export interface ParsedFeed {
  title: string
  items: ParsedItem[]
}

export interface Env {
  ALLOWED_ORIGINS?: string
}
