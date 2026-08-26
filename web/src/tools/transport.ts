import { scoreWorkerUrl } from '@/score/client'

export interface ReaderFetchInit {
  method?: string
  headers?: Record<string, string>
  body?: string | null
}

export interface ReaderFetchResult {
  status: number
  bodyText: string
  via: 'direct' | 'proxy'
}

export class ReaderTransportError extends Error {
  constructor(
    message: string,
    readonly directError?: string,
    readonly proxyError?: string,
  ) {
    super(message)
    this.name = 'ReaderTransportError'
  }
}

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>

async function proxyFetch(
  url: string,
  init: ReaderFetchInit,
  fetchImpl: FetchLike,
): Promise<ReaderFetchResult> {
  const base = scoreWorkerUrl()
  if (!base) {
    throw new ReaderTransportError(
      'Direct request failed and VITE_SCORE_URL is not configured for the Tools proxy.',
    )
  }

  const res = await fetchImpl(`${base}/proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      method: init.method ?? 'GET',
      headers: init.headers ?? {},
      body: init.body ?? null,
    }),
  })

  let payload: unknown
  try {
    payload = await res.json()
  } catch {
    throw new ReaderTransportError(
      `Tools proxy returned HTTP ${res.status} with a non-JSON body.`,
    )
  }

  if (!res.ok) {
    const err =
      payload &&
      typeof payload === 'object' &&
      typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : `proxy_http_${res.status}`
    throw new ReaderTransportError(`Tools proxy failed (${err}).`, undefined, err)
  }

  const status = (payload as { status?: unknown }).status
  const bodyText = (payload as { bodyText?: unknown }).bodyText
  if (typeof status !== 'number' || typeof bodyText !== 'string') {
    throw new ReaderTransportError('Tools proxy returned an unexpected payload.')
  }
  return { status, bodyText, via: 'proxy' }
}

/**
 * Prefer a browser-direct fetch; on network/CORS failure, relay via Score Worker `/proxy`.
 */
export async function readerFetch(
  url: string,
  init: ReaderFetchInit = {},
  fetchImpl: FetchLike = fetch,
): Promise<ReaderFetchResult> {
  try {
    const res = await fetchImpl(url, {
      method: init.method ?? 'GET',
      headers: init.headers,
      body: init.body ?? undefined,
    })
    return {
      status: res.status,
      bodyText: await res.text(),
      via: 'direct',
    }
  } catch (directErr) {
    const directMsg =
      directErr instanceof Error ? directErr.message : 'direct fetch failed'
    try {
      return await proxyFetch(url, init, fetchImpl)
    } catch (proxyErr) {
      if (proxyErr instanceof ReaderTransportError) {
        throw new ReaderTransportError(
          `${proxyErr.message} (direct: ${directMsg})`,
          directMsg,
          proxyErr.proxyError,
        )
      }
      const proxyMsg =
        proxyErr instanceof Error ? proxyErr.message : 'proxy failed'
      throw new ReaderTransportError(
        `Direct and proxy requests both failed (direct: ${directMsg}; proxy: ${proxyMsg}).`,
        directMsg,
        proxyMsg,
      )
    }
  }
}
