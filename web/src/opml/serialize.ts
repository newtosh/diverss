import type { OpmlDocument, OpmlOutline } from './types'

function appendOutline(parent: Element, node: OpmlOutline, doc: XMLDocument): void {
  const el = doc.createElement('outline')
  el.setAttribute('text', node.text)

  if (node.kind === 'feed') {
    el.setAttribute('type', 'rss')
    el.setAttribute('xmlUrl', node.xmlUrl)
    if (node.htmlUrl) el.setAttribute('htmlUrl', node.htmlUrl)
  } else {
    for (const child of node.children) {
      appendOutline(el, child, doc)
    }
  }

  parent.appendChild(el)
}

/** Build a well-formed OPML 2.0 document string from the workspace model. */
export function serializeOpml(document: OpmlDocument): string {
  const doc = new DOMParser().parseFromString(
    '<opml version="2.0"></opml>',
    'application/xml',
  )
  const root = doc.documentElement

  const head = doc.createElement('head')
  const title = doc.createElement('title')
  title.textContent = document.title
  head.appendChild(title)
  root.appendChild(head)

  const body = doc.createElement('body')
  for (const outline of document.outlines) {
    appendOutline(body, outline, doc)
  }
  root.appendChild(body)

  const xml = new XMLSerializer().serializeToString(doc)
  return `<?xml version="1.0" encoding="UTF-8"?>\n${xml}\n`
}
