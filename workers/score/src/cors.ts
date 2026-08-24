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
  if (!allowedOrigins(env).includes(origin)) {
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
