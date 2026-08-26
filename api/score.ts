import { handleApiRequest } from '../workers/score/src/http'
import type { Env } from '../workers/score/src/types'

export const config = {
  // Web Request handlers require Edge; Node broke Score with FUNCTION_INVOCATION_FAILED.
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
  url.pathname = '/api/score'
  return handleApiRequest(new Request(url.toString(), request), envFromProcess())
}
