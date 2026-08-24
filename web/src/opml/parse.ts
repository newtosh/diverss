import type { OpmlDocument, OpmlOutline } from './types'
import { emptyOpmlDocument } from './types'

export class OpmlParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OpmlParseError'
  }
}

function attr(el: Element, name: string): string {
  return (el.getAttribute(name) ?? '').trim()
}

function parseOutline(el: Element): OpmlOutline {
  const text = attr(el, 'text') || attr(el, 'title')
  const xmlUrl = attr(el, 'xmlUrl') || attr(el, 'xmlurl')
  const childElements = [...el.children].filter(
    (c) => c.localName.toLowerCase() === 'outline',
  )

  if (xmlUrl) {
    if (!text) {
      throw new OpmlParseError(
        `Feed outline with xmlUrl requires a text attribute (${xmlUrl})`,
      )
    }
    const htmlUrl = attr(el, 'htmlUrl') || attr(el, 'htmlurl') || undefined
    return {
      kind: 'feed',
      text,
      xmlUrl,
      ...(htmlUrl ? { htmlUrl } : {}),
    }
  }

  // No xmlUrl: must be a folder/group, not a silent feed.
  if (childElements.length === 0 && !text) {
    throw new OpmlParseError('Empty outline without text or xmlUrl')
  }

  if (childElements.length === 0) {
    // Leaf without xmlUrl — not a valid feed; reject rather than keep as feed.
    throw new OpmlParseError(
      `Outline "${text}" is missing xmlUrl (not kept as a feed)`,
    )
  }

  return {
    kind: 'folder',
    text: text || 'Untitled folder',
    children: childElements.map(parseOutline),
  }
}

/**
 * Parse OPML XML into a document model.
 * Feed outlines require non-empty `text` + `xmlUrl`. Folders are preserved as groups.
 */
export function parseOpml(xml: string): OpmlDocument {
  const trimmed = xml.trim()
  if (!trimmed) {
    throw new OpmlParseError('Empty OPML input')
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(trimmed, 'application/xml')
  const err = doc.querySelector('parsererror')
  if (err) {
    throw new OpmlParseError('Malformed XML')
  }

  const root =
    doc.documentElement &&
    doc.documentElement.localName.toLowerCase() === 'opml'
      ? doc.documentElement
      : null
  if (!root) {
    throw new OpmlParseError('Root element must be <opml>')
  }

  const head = [...root.children].find((c) => c.localName.toLowerCase() === 'head')
  const body = [...root.children].find((c) => c.localName.toLowerCase() === 'body')
  if (!body) {
    throw new OpmlParseError('OPML missing <body>')
  }

  let title = emptyOpmlDocument().title
  if (head) {
    const titleEl = [...head.children].find(
      (c) => c.localName.toLowerCase() === 'title',
    )
    const t = titleEl?.textContent?.trim()
    if (t) title = t
  }

  const outlineEls = [...body.children].filter(
    (c) => c.localName.toLowerCase() === 'outline',
  )
  const outlines = outlineEls.map(parseOutline)

  return { title, outlines }
}
