import { handleApiRequest } from './http'
import type { Env } from './types'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleApiRequest(request, env)
  },
}

export { scanParsedFeed, unhealthy } from './scan'
export { parseFeed, inferDateFromPermalink } from './parse'
export { checkUrlShape, assertSafeUrl, isPrivateOrMetadataIP } from './ssrf'
export { fetchAndScan, mapPool, resolveFeedBody } from './fetch'
export { feedMirrorsFor } from './mirrors'
export { isHostBlockHttpDetail } from './block'
export {
  discoverFeedsFromPage,
  parseAlternateFeedLinks,
  wellKnownFeedUrls,
} from './discover'
export type { Env, ScanResult, ParsedFeed } from './types'
export type { DiscoveredFeed } from './discover'
