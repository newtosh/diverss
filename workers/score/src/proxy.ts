/**
 * Tools reader API relay — browser-direct first, Worker when CORS blocks.
 * Does not persist credentials; forwards Authorization headers for one request.
 */

export interface ProxyRequestBody {
  url: string
  method: string
  headers: Record<string, string>
  body: string | null
}

export type ProxyResult =
  | { ok: true; status: number; bodyText: string; headers: Record<string, string> }
  | { ok: false; error: string; status: number }

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
])

export function parseProxyBody(raw: unknown): ProxyRequestBody | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.url !== 'string' || !o.url.trim()) return null
  const method =
    typeof o.method === 'string' && o.method.trim()
      ? o.method.trim().toUpperCase()
      : 'GET'
  const headers: Record<string, string> = {}
  if (o.headers && typeof o.headers === 'object' && !Array.isArray(o.headers)) {
    for (const [k, v] of Object.entries(o.headers as Record<string, unknown>)) {
      if (typeof v === 'string') headers[k] = v
    }
  }
  const body =
    o.body === null || o.body === undefined
      ? null
      : typeof o.body === 'string'
        ? o.body
        : null
  if (o.body != null && typeof o.body !== 'string') return null
  return { url: o.url.trim(), method, headers, body }
}

/** Allow only http(s); self-hosted private IPs are intentional for Tools. */
export function assertProxyTargetUrl(raw: string): URL | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (url.username || url.password) return null
  return url
}

export async function forwardProxyRequest(
  parsed: ProxyRequestBody,
  fetchImpl: typeof fetch = fetch,
): Promise<ProxyResult> {
  const target = assertProxyTargetUrl(parsed.url)
  if (!target) {
    return { ok: false, error: 'invalid_url', status: 400 }
  }

  const headers = new Headers()
  for (const [k, v] of Object.entries(parsed.headers)) {
    if (HOP_BY_HOP.has(k.toLowerCase())) continue
    headers.set(k, v)
  }

  try {
    const res = await fetchImpl(target.toString(), {
      method: parsed.method,
      headers,
      body:
        parsed.method === 'GET' || parsed.method === 'HEAD'
          ? undefined
          : (parsed.body ?? undefined),
      redirect: 'follow',
    })
    const bodyText = await res.text()
    const outHeaders: Record<string, string> = {}
    res.headers.forEach((value, key) => {
      const lower = key.toLowerCase()
      if (lower === 'set-cookie') return
      outHeaders[key] = value
    })
    return {
      ok: true,
      status: res.status,
      bodyText,
      headers: outHeaders,
    }
  } catch {
    return { ok: false, error: 'upstream_fetch_failed', status: 502 }
  }
}
