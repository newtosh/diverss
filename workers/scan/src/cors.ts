import type { Env } from './types'

const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173']

export function allowedOrigins(env: Env): string[] {
  const raw = env.ALLOWED_ORIGINS?.trim()
  if (!raw) return [...DEFAULT_ORIGINS]
  const fromEnv = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const set = new Set([...fromEnv, ...DEFAULT_ORIGINS])
  return [...set]
}

/** Local Vite may bump past 5173; allow any localhost / 127.0.0.1 http(s) origin. */
export function isLocalDevOrigin(origin: string): boolean {
  try {
    const u = new URL(origin)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1'
  } catch {
    return false
  }
}

/** Vercel production + preview deployments (*.vercel.app). */
export function isVercelDeploymentOrigin(origin: string): boolean {
  try {
    const u = new URL(origin)
    if (u.protocol !== 'https:') return false
    return u.hostname === 'vercel.app' || u.hostname.endsWith('.vercel.app')
  } catch {
    return false
  }
}

/** SPA + API on the same host (e.g. custom domain on Vercel). */
export function isSameOriginRequest(request: Request, origin: string): boolean {
  try {
    return new URL(request.url).origin === origin
  } catch {
    return false
  }
}

export function originAllowed(
  origin: string,
  env: Env,
  request?: Request,
): boolean {
  return (
    allowedOrigins(env).includes(origin) ||
    isLocalDevOrigin(origin) ||
    isVercelDeploymentOrigin(origin) ||
    (request != null && isSameOriginRequest(request, origin))
  )
}

export function corsHeaders(
  request: Request,
  env: Env,
): Record<string, string> | null {
  const origin = request.headers.get('Origin')
  if (!origin) {
    // Non-browser clients: no ACAO needed; still allow the response.
    return {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    }
  }
  if (!originAllowed(origin, env, request)) {
    return null
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}
