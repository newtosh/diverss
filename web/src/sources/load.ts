import { parseOpml, OpmlParseError } from '@/opml/parse'
import type { OpmlOutline } from '@/opml/types'
import type {
  CommunitySource,
  ParsedSourceFeed,
  SourceEntrypoint,
  SourcesFile,
} from './types'

export async function loadSourcesFile(url: string): Promise<SourcesFile> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`sources HTTP ${res.status}`)
  const body = (await res.json()) as SourcesFile
  if (!Array.isArray(body.sources)) {
    throw new Error('sources.json missing sources array')
  }
  return body
}

export function entrypointRole(ep: SourceEntrypoint): 'collection' | 'section' {
  if (ep.role === 'collection' || ep.role === 'section') return ep.role
  // Legacy: merge or any URL without role = full collection pack.
  if (ep.mergeSections || ep.url) return 'collection'
  return 'section'
}

/** URLs to fetch for an entrypoint (single URL or all section packs when merging). */
export function resolveEntrypointUrls(
  source: CommunitySource,
  ep: SourceEntrypoint,
): string[] {
  if (ep.mergeSections) {
    return source.entrypoints
      .filter((e) => entrypointRole(e) === 'section' && e.url)
      .map((e) => e.url!)
  }
  if (ep.url) return [ep.url]
  return []
}

/** Fetch OPML URL(s) and flatten feeds (GitHub raw allows browser CORS). */
export async function fetchAndParseSourceOpml(opts: {
  urls: string[]
  sourceId: string
  sourceTitle: string
  entrypointLabel: string
}): Promise<ParsedSourceFeed[]> {
  if (opts.urls.length === 0) {
    throw new Error('No OPML URLs to load for this collection')
  }

  const chunks = await Promise.all(
    opts.urls.map(async (url) => {
      const res = await fetch(url, {
        headers: { Accept: 'application/xml, text/xml, */*' },
      })
      if (!res.ok) {
        throw new Error(`Could not fetch OPML (HTTP ${res.status}): ${url}`)
      }
      const xml = await res.text()
      if (!xml.trim() || xml.trim().startsWith('404')) {
        throw new Error(`OPML URL returned empty or not found: ${url}`)
      }
      let doc
      try {
        doc = parseOpml(xml)
      } catch (e) {
        if (e instanceof OpmlParseError) {
          throw new Error(`Could not parse OPML (${url}): ${e.message}`)
        }
        throw e
      }
      return collectFeeds(doc.outlines, [], {
        sourceId: opts.sourceId,
        sourceTitle: opts.sourceTitle,
        entrypointLabel: opts.entrypointLabel,
      })
    }),
  )

  return dedupeSourceFeeds(chunks.flat())
}

function collectFeeds(
  outlines: OpmlOutline[],
  groups: string[],
  meta: {
    sourceId: string
    sourceTitle: string
    entrypointLabel: string
  },
): ParsedSourceFeed[] {
  const out: ParsedSourceFeed[] = []
  for (const node of outlines) {
    if (node.kind === 'feed') {
      out.push({
        text: node.text,
        xmlUrl: node.xmlUrl,
        htmlUrl: node.htmlUrl,
        groups: [...groups],
        sourceId: meta.sourceId,
        sourceTitle: meta.sourceTitle,
        entrypointLabel: meta.entrypointLabel,
      })
      continue
    }
    out.push(...collectFeeds(node.children, [...groups, node.text], meta))
  }
  return out
}

/** Dedupe by xmlUrl (first wins). */
export function dedupeSourceFeeds(feeds: ParsedSourceFeed[]): ParsedSourceFeed[] {
  const seen = new Set<string>()
  const out: ParsedSourceFeed[] = []
  for (const f of feeds) {
    const key = f.xmlUrl.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(f)
  }
  return out
}
