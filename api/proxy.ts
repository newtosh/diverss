import { handleApiRequest } from '../workers/scan/src/http'
import type { Env } from '../workers/scan/src/types'

export const config = {
  runtime: 'edge',
  maxDuration: 60,
}

function envFromProcess(): Env {
  return {
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
  }
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  url.pathname = '/api/proxy'
  return handleApiRequest(new Request(url.toString(), request), envFromProcess())
}
