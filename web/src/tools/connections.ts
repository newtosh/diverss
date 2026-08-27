import type {
  ConnectionsState,
  FreshRssConnection,
  LiveReaderId,
  MinifluxConnection,
} from './types'

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
    const empty = !state.miniflux && !state.freshrss
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

export function clearConnection(id: LiveReaderId): ConnectionsState {
  const state = loadConnections()
  if (id === 'miniflux') delete state.miniflux
  else delete state.freshrss
  write(state)
  return state
}
