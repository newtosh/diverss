import type {
  ConnectionsState,
  FreshRssConnection,
  LiveReaderId,
  MinifluxConnection,
  RsshubConnection,
} from './types'

/** Public RSSHub instance — pre-seeded as a zero-config safety net (KD6). */
export const DEFAULT_RSSHUB_BASE = 'https://rsshub.app'

/** Unsaved-draft default for a fresh RSSHub connection. Never auto-persisted — see U1. */
export function defaultRsshubConnection(): RsshubConnection {
  return { bases: [DEFAULT_RSSHUB_BASE] }
}

export const CONNECTIONS_KEY = 'gardenrss-reader-connections-v1'

export function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '')
}

function isMiniflux(v: unknown): v is MinifluxConnection {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return typeof o.baseUrl === 'string' && typeof o.token === 'string'
}

function isFreshRss(v: unknown): v is FreshRssConnection {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o.baseUrl === 'string' &&
    typeof o.username === 'string' &&
    typeof o.apiPassword === 'string'
  )
}

function isRsshub(v: unknown): v is RsshubConnection {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return Array.isArray(o.bases) && o.bases.every((b) => typeof b === 'string')
}

function normalizeRsshubBases(bases: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const b of bases) {
    const n = normalizeBaseUrl(b)
    if (!n || seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out
}

function normalizeState(raw: unknown): ConnectionsState {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  const next: ConnectionsState = {}
  if (isMiniflux(o.miniflux)) {
    next.miniflux = {
      baseUrl: normalizeBaseUrl(o.miniflux.baseUrl),
      token: o.miniflux.token.trim(),
    }
  }
  if (isFreshRss(o.freshrss)) {
    next.freshrss = {
      baseUrl: normalizeBaseUrl(o.freshrss.baseUrl),
      username: o.freshrss.username.trim(),
      apiPassword: o.freshrss.apiPassword,
    }
  }
  if (isRsshub(o.rsshub)) {
    const bases = normalizeRsshubBases(o.rsshub.bases)
    if (bases.length) next.rsshub = { bases }
  }
  return next
}

export function loadConnections(): ConnectionsState {
  try {
    const raw = localStorage.getItem(CONNECTIONS_KEY)
    if (!raw) return {}
    return normalizeState(JSON.parse(raw) as unknown)
  } catch {
    return {}
  }
}

function write(state: ConnectionsState): void {
  try {
    const empty = !state.miniflux && !state.freshrss && !state.rsshub
    if (empty) localStorage.removeItem(CONNECTIONS_KEY)
    else localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(state))
  } catch {
    /* private mode / quota */
  }
}

export function saveConnection(
  id: 'miniflux',
  record: MinifluxConnection,
): ConnectionsState
export function saveConnection(
  id: 'freshrss',
  record: FreshRssConnection,
): ConnectionsState
export function saveConnection(
  id: LiveReaderId,
  record: MinifluxConnection | FreshRssConnection,
): ConnectionsState {
  const state = loadConnections()
  if (id === 'miniflux') {
    const r = record as MinifluxConnection
    state.miniflux = {
      baseUrl: normalizeBaseUrl(r.baseUrl),
      token: r.token.trim(),
    }
  } else {
    const r = record as FreshRssConnection
    state.freshrss = {
      baseUrl: normalizeBaseUrl(r.baseUrl),
      username: r.username.trim(),
      apiPassword: r.apiPassword,
    }
  }
  write(state)
  return state
}

/** RSSHub has no ReaderAdapter (no push/pull/wipe), so it stays off LiveReaderId. */
export function saveRsshubConnection(bases: string[]): ConnectionsState {
  const state = loadConnections()
  const normalized = normalizeRsshubBases(bases)
  if (normalized.length) state.rsshub = { bases: normalized }
  else delete state.rsshub
  write(state)
  return state
}

export function clearRsshubConnection(): ConnectionsState {
  const state = loadConnections()
  delete state.rsshub
  write(state)
  return state
}

export function clearConnection(id: LiveReaderId): ConnectionsState {
  const state = loadConnections()
  if (id === 'miniflux') delete state.miniflux
  else delete state.freshrss
  write(state)
  return state
}
