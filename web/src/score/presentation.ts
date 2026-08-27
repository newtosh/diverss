import type { ReasonCode, ScoreResult } from '@/score/client'

/** Row tint for warning statuses (Unhealthy / Stale / fetch-blocked). */
export function rowWarningClass(s?: ScoreResult): string {
  if (!s) return ''
  if (isFetchBlocked(s)) {
    return 'bg-violet-50/90 border-l-4 border-l-violet-400'
  }
  if (s.health === 'unhealthy') {
    return 'bg-red-50/90 border-l-4 border-l-red-400'
  }
  if (s.health === 'stale') {
    return 'bg-amber-50/90 border-l-4 border-l-amber-400'
  }
  return ''
}

/** Human-readable Score / discover reason codes. */
export function reasonLabel(reason: string, detail?: string): string {
  switch (reason) {
    case 'ok':
      return 'OK'
    case 'stale':
      return detail ?? 'No dated posts in the last 90 days'
    case 'timeout':
      return 'Timed out fetching the feed'
    case 'dns':
      return 'Could not resolve the feed host'
    case 'tls':
      return 'TLS/SSL error fetching the feed'
    case 'http_status':
      if (isHostBlockDetail(detail)) {
        return `GardenRSS servers were blocked fetching this feed (${detail}). The site may still be fine — try your reader or Fix URL.`
      }
      return detail
        ? `Feed URL returned ${detail}`
        : 'Feed URL returned an HTTP error'
    case 'too_large':
      return 'Feed body is larger than the size limit'
    case 'blocked_url':
      return 'Feed URL was blocked for safety'
    case 'unparseable':
      return 'Response was not a readable RSS/Atom feed'
    case 'fetch_error':
      return 'Network error fetching the feed'
    case 'manual':
      return detail ?? 'Marked unhealthy by you'
    case 'empty_batch':
      return 'No URLs in the request'
    case 'batch_too_large':
      return 'Too many URLs in one request'
    case 'invalid_body':
      return 'Invalid request body'
    case 'invalid_json':
      return 'Invalid JSON request'
    default:
      return detail ? `${reason.replace(/_/g, ' ')} (${detail})` : reason.replace(/_/g, ' ')
  }
}

/** HTTP statuses that usually mean bot/IP filtering, not a dead feed. */
export function isHostBlockDetail(detail?: string): boolean {
  if (!detail) return false
  return /\bHTTP (401|403|429|503)\b/i.test(detail)
}

/** True when Score failed because the publisher blocked our fetch egress. */
export function isFetchBlocked(s?: ScoreResult): boolean {
  return Boolean(
    s &&
      s.health === 'unhealthy' &&
      s.reason === 'http_status' &&
      isHostBlockDetail(s.detail),
  )
}

/** Relative age from an ISO timestamp (e.g. "14d ago", "11mo ago"). */
export function lastPostAgeLabel(lastDatedAt?: string, now = Date.now()): string | null {
  if (!lastDatedAt) return null
  const t = Date.parse(lastDatedAt)
  if (Number.isNaN(t)) return null
  const days = Math.floor((now - t) / (24 * 60 * 60 * 1000))
  if (days < 1) return 'today'
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  if (days < 365) return months === 1 ? '1 month ago' : `${months} months ago`
  const years = Math.floor(days / 365)
  return years === 1 ? '1 year ago' : `${years} years ago`
}

/** Whole days since lastDatedAt, or null when missing/invalid. */
export function lastPostAgeDays(lastDatedAt?: string, now = Date.now()): number | null {
  if (!lastDatedAt) return null
  const t = Date.parse(lastDatedAt)
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((now - t) / (24 * 60 * 60 * 1000)))
}

/** Stale-age prune chips: minimum age thresholds (days). */
export type StaleAgeFilter = 'all' | '3m' | '6m' | '1y'

export const STALE_AGE_MIN_DAYS: Record<Exclude<StaleAgeFilter, 'all'>, number> = {
  '3m': 90,
  '6m': 180,
  '1y': 366,
}

export function matchesStaleAgeFilter(
  lastDatedAt: string | undefined,
  filter: StaleAgeFilter,
  now = Date.now(),
): boolean {
  if (filter === 'all') return true
  const days = lastPostAgeDays(lastDatedAt, now)
  if (days === null) return false
  return days >= STALE_AGE_MIN_DAYS[filter]
}

/** Prefer numeric age days when already computed on a prune row. */
export function matchesStaleAgeDays(
  ageDays: number | null | undefined,
  filter: StaleAgeFilter,
): boolean {
  if (filter === 'all') return true
  if (ageDays === null || ageDays === undefined) return false
  return ageDays >= STALE_AGE_MIN_DAYS[filter]
}

/** Absolute calendar date for tooltips (e.g. "Nov 11, 2024"). */
export function formatAbsoluteDate(iso?: string): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(t)
}

/** Relative + absolute, e.g. "11 months ago · Nov 11, 2024". */
export function formatFeedDate(iso?: string, now = Date.now()): string | null {
  const rel = lastPostAgeLabel(iso, now)
  if (!rel) return null
  const abs = formatAbsoluteDate(iso)
  return abs ? `${rel} · ${abs}` : rel
}

/** Tooltip text for a health pill. */
export function healthTooltip(s?: ScoreResult, now = Date.now()): string | undefined {
  if (!s) return undefined
  if (s.health === 'unhealthy') {
    return reasonLabel(s.reason, s.detail)
  }
  if (s.health === 'stale') {
    const when = formatFeedDate(s.lastDatedAt, now)
    if (when) return `Last dated post ${when}`
    return reasonLabel('stale', s.detail)
  }
  if (s.lastDatedAt) {
    const when = formatFeedDate(s.lastDatedAt, now)
    return when ? `Last dated post ${when}` : undefined
  }
  return undefined
}

/** Shared health chip for Workspace / Catalog / modals. */
export function healthPill(s?: ScoreResult): {
  label: string
  className: string
  title?: string
} {
  if (!s) {
    return {
      label: 'Unscored',
      className: 'bg-slate-100 text-slate-600 ring-slate-200',
    }
  }
  if (s.health === 'unhealthy') {
    if (isFetchBlocked(s)) {
      return {
        label: 'Blocked',
        className: 'bg-violet-50 text-violet-900 ring-violet-200',
        title: healthTooltip(s),
      }
    }
    return {
      label: 'Unhealthy',
      className: 'bg-red-50 text-red-800 ring-red-200',
      title: healthTooltip(s),
    }
  }
  if (s.health === 'stale') {
    const age = lastPostAgeLabel(s.lastDatedAt)
    return {
      label: age ? `Stale · ${age}` : 'Stale',
      className: 'bg-amber-50 text-amber-900 ring-amber-200',
      title: healthTooltip(s),
    }
  }
  return {
    label: 'Healthy',
    className: 'bg-teal-50 text-teal-800 ring-teal-200',
    title: healthTooltip(s),
  }
}
