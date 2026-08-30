import { XMLParser } from 'fast-xml-parser'
import type { ParsedFeed, ParsedItem } from './types'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true,
  isArray: (name) => name === 'item' || name === 'entry' || name === 'link',
})

/** Parse RSS 2.0 or Atom XML into a minimal feed model. */
export function parseFeed(xml: string): ParsedFeed | null {
  if (!xml || !xml.trim()) return null
  let doc: unknown
  try {
    doc = parser.parse(xml)
  } catch {
    return null
  }
  if (!doc || typeof doc !== 'object') return null

  const root = doc as Record<string, unknown>

  if (root.rss != null) {
    return parseRss(root.rss)
  }
  if (root.feed != null) {
    return parseAtom(root.feed)
  }
  // Some feeds omit wrappers oddly; reject.
  return null
}

function parseRss(rss: unknown): ParsedFeed | null {
  if (!rss || typeof rss !== 'object') return null
  const channel = (rss as Record<string, unknown>).channel
  if (!channel || typeof channel !== 'object') return null
  const ch = channel as Record<string, unknown>
  const title = textValue(ch.title) ?? ''
  const rawItems = ch.item
  const items: ParsedItem[] = []
  if (Array.isArray(rawItems)) {
    for (const it of rawItems) {
      items.push(parseRssItem(it))
    }
  }
  return { title, items }
}

function parseRssItem(it: unknown): ParsedItem {
  if (!it || typeof it !== 'object') return { published: null }
  const item = it as Record<string, unknown>
  const pub =
    parseDate(textValue(item.pubDate)) ??
    parseDate(textValue(item.published)) ??
    parseDate(textValue(item['dc:date']))
  const link = rssLinkHref(item.link)
  const content =
    textValue(item['content:encoded']) ?? textValue(item.content) ?? undefined
  const description = textValue(item.description) ?? undefined
  return {
    published: pub ?? inferDateFromPermalink(link),
    ...(link ? { link } : {}),
    content,
    description,
  }
}

function parseAtom(feed: unknown): ParsedFeed | null {
  if (!feed || typeof feed !== 'object') return null
  const f = feed as Record<string, unknown>
  const title = textValue(f.title) ?? ''
  const rawEntries = f.entry
  const items: ParsedItem[] = []
  if (Array.isArray(rawEntries)) {
    for (const en of rawEntries) {
      items.push(parseAtomEntry(en))
    }
  }
  return { title, items }
}

function parseAtomEntry(en: unknown): ParsedItem {
  if (!en || typeof en !== 'object') return { published: null }
  const entry = en as Record<string, unknown>
  const pub =
    parseDate(textValue(entry.published)) ?? parseDate(textValue(entry.updated))
  const link = atomLinkHref(entry.link)
  const content = textValue(entry.content) ?? undefined
  const description = textValue(entry.summary) ?? undefined
  return {
    published: pub ?? inferDateFromPermalink(link),
    ...(link ? { link } : {}),
    content,
    description,
  }
}

/** RSS <link> may be a string or array (parser forces link → array). */
function rssLinkHref(v: unknown): string | undefined {
  if (typeof v === 'string') return v
  if (Array.isArray(v)) {
    for (const entry of v) {
      if (typeof entry === 'string' && entry.trim()) return entry.trim()
      const href = linkFromHref(entry)
      if (href) return href
    }
  }
  return linkFromHref(v) ?? textValue(v)
}

function linkFromHref(v: unknown): string | undefined {
  if (!v || typeof v !== 'object') return undefined
  const href = (v as Record<string, unknown>)['@_href']
  return typeof href === 'string' ? href : undefined
}

function atomLinkHref(v: unknown): string | undefined {
  if (typeof v === 'string') return v
  if (Array.isArray(v)) {
    for (const entry of v) {
      if (!entry || typeof entry !== 'object') continue
      const o = entry as Record<string, unknown>
      const rel = String(o['@_rel'] ?? 'alternate')
      const href = o['@_href']
      if ((rel === 'alternate' || rel === '') && typeof href === 'string') return href
    }
    for (const entry of v) {
      const href = linkFromHref(entry)
      if (href) return href
    }
    return undefined
  }
  return linkFromHref(v)
}

/**
 * Infer a publish date from common permalink shapes:
 * /2025/04/18/slug, /2025-04-18/, ?p= date-like paths.
 */
export function inferDateFromPermalink(link?: string): Date | null {
  if (!link) return null
  let path: string
  try {
    path = new URL(link).pathname
  } catch {
    path = link
  }
  const m =
    path.match(/\/(20\d{2})\/([01]?\d)\/([0-3]?\d)(?:\/|$)/) ??
    path.match(/\/(20\d{2})-([01]?\d)-([0-3]?\d)(?:\/|$)/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (Number.isNaN(dt.getTime())) return null
  // Reject impossible calendar rollovers (e.g. Feb 31 → Mar).
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return null
  }
  return dt
}

function textValue(v: unknown): string | undefined {
  if (v == null) return undefined
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (typeof o['#text'] === 'string') return o['#text']
  }
  return undefined
}

function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return d
}
