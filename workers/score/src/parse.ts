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
  return { published: pub }
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
  return { published: pub }
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
