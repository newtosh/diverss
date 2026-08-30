/**
 * SSRF guards: scheme, userinfo, private/metadata/link-local IPs,
 * and re-validation hooks for redirect hops.
 */

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata',
])

export type UrlCheck =
  | { ok: true; url: URL }
  | { ok: false; reason: 'blocked_url' }

/** Synchronous URL shape + literal-IP / hostname denylist checks (no DNS). */
export function checkUrlShape(raw: string): UrlCheck {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, reason: 'blocked_url' }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'blocked_url' }
  }

  if (url.username !== '' || url.password !== '') {
    return { ok: false, reason: 'blocked_url' }
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')

  if (BLOCKED_HOSTNAMES.has(host)) {
    return { ok: false, reason: 'blocked_url' }
  }
  if (host.endsWith('.localhost') || host.endsWith('.local')) {
    return { ok: false, reason: 'blocked_url' }
  }

  if (isIPAddress(host) && isPrivateOrMetadataIP(host)) {
    return { ok: false, reason: 'blocked_url' }
  }

  return { ok: true, url }
}

/**
 * Full safety check including DNS resolution for non-literal hostnames.
 * `resolve` is injectable for tests.
 */
export async function assertSafeUrl(
  raw: string,
  resolve: (hostname: string) => Promise<string[]> = resolveHostnameDoH,
): Promise<UrlCheck> {
  const shape = checkUrlShape(raw)
  if (!shape.ok) return shape

  const host = shape.url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (isIPAddress(host)) {
    return shape
  }

  let addrs: string[]
  try {
    addrs = await resolve(host)
  } catch {
    return { ok: false, reason: 'blocked_url' }
  }
  if (addrs.length === 0) {
    return { ok: false, reason: 'blocked_url' }
  }
  for (const addr of addrs) {
    if (isPrivateOrMetadataIP(addr)) {
      return { ok: false, reason: 'blocked_url' }
    }
  }
  return shape
}

export function isIPAddress(host: string): boolean {
  return isIPv4(host) || isIPv6(host)
}

export function isPrivateOrMetadataIP(ip: string): boolean {
  const h = ip.toLowerCase().replace(/^\[|\]$/g, '')

  if (isIPv4(h)) {
    return isPrivateIPv4(h)
  }
  if (isIPv6(h)) {
    return isPrivateIPv6(h)
  }
  return true // unknown form → fail closed
}

function isIPv4(host: string): boolean {
  const parts = host.split('.')
  if (parts.length !== 4) return false
  return parts.every((p) => {
    if (!/^\d{1,3}$/.test(p)) return false
    const n = Number(p)
    return n >= 0 && n <= 255
  })
}

function isIPv6(host: string): boolean {
  // Loose check: contains ':' and valid hex/compress form.
  if (!host.includes(':')) return false
  return /^[0-9a-f:]+$/i.test(host)
}

function isPrivateIPv4(ip: string): boolean {
  const [a, b, c] = ip.split('.').map(Number)
  if (a === 0) return true
  if (a === 10) return true
  if (a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a === 192 && b === 0 && c === 0) return true
  if (a === 198 && (b === 18 || b === 19)) return true
  if (a === 255 && b === 255 && c === 255) return true
  return false
}

function isPrivateIPv6(ip: string): boolean {
  const h = ip.toLowerCase()
  if (h === '::1' || h === '::') return true
  // IPv4-mapped ::ffff:x.x.x.x
  const v4mapped = h.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (v4mapped) return isPrivateIPv4(v4mapped[1])
  // ULA fc00::/7
  if (h.startsWith('fc') || h.startsWith('fd')) return true
  // link-local fe80::/10
  if (/^fe[89ab][0-9a-f]:/i.test(h) || h.startsWith('fe80:')) return true
  return false
}

/** Resolve A/AAAA via Cloudflare DNS-over-HTTPS. */
export async function resolveHostnameDoH(hostname: string): Promise<string[]> {
  const addrs: string[] = []
  for (const type of ['A', 'AAAA'] as const) {
    const u = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`
    const resp = await fetch(u, {
      headers: { Accept: 'application/dns-json' },
    })
    if (!resp.ok) continue
    const data = (await resp.json()) as {
      Answer?: Array<{ type: number; data: string }>
    }
    for (const ans of data.Answer ?? []) {
      // 1 = A, 28 = AAAA
      if (type === 'A' && ans.type === 1) addrs.push(ans.data)
      if (type === 'AAAA' && ans.type === 28) addrs.push(ans.data)
    }
  }
  return addrs
}
