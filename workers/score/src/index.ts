/**
 * Score Worker stub — full implementation in U4.
 */
export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) })
    }
    return Response.json(
      { error: 'not_implemented', message: 'Score Worker lands in U4' },
      { status: 501, headers: corsHeaders(request) },
    )
  },
}

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('Origin') ?? '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}
