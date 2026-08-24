import type { OpmlDocument, OpmlFeed, OpmlOutline } from './types'

/** Stable path of outline indices from root (e.g. [0, 2] = first folder's third child). */
export type OutlinePath = number[]

function atPath(outlines: OpmlOutline[], path: OutlinePath): OpmlOutline | undefined {
  let nodes = outlines
  let node: OpmlOutline | undefined
  for (let i = 0; i < path.length; i++) {
    const idx = path[i]
    if (idx === undefined) return undefined
    node = nodes[idx]
    if (!node) return undefined
    if (i < path.length - 1) {
      if (node.kind !== 'folder') return undefined
      nodes = node.children
    }
  }
  return node
}

function cloneOutlines(outlines: OpmlOutline[]): OpmlOutline[] {
  return structuredClone(outlines)
}

export function removeAtPath(doc: OpmlDocument, path: OutlinePath): OpmlDocument {
  if (path.length === 0) return doc
  const outlines = cloneOutlines(doc.outlines)
  const parentPath = path.slice(0, -1)
  const index = path[path.length - 1]!

  if (parentPath.length === 0) {
    outlines.splice(index, 1)
  } else {
    const parent = atPath(outlines, parentPath)
    if (!parent || parent.kind !== 'folder') return doc
    parent.children.splice(index, 1)
  }

  return { ...doc, outlines }
}

export function updateFeedText(
  doc: OpmlDocument,
  path: OutlinePath,
  text: string,
): OpmlDocument {
  const outlines = cloneOutlines(doc.outlines)
  const node = atPath(outlines, path)
  if (!node || node.kind !== 'feed') return doc
  node.text = text.trim()
  return { ...doc, outlines }
}

export function appendFeed(
  doc: OpmlDocument,
  feed: Pick<OpmlFeed, 'text' | 'xmlUrl'>,
): OpmlDocument {
  const text = feed.text.trim()
  const xmlUrl = feed.xmlUrl.trim()
  if (!text || !xmlUrl) return doc
  const outlines = cloneOutlines(doc.outlines)
  outlines.push({ kind: 'feed', text, xmlUrl })
  return { ...doc, outlines }
}

export function setDocumentTitle(doc: OpmlDocument, title: string): OpmlDocument {
  return { ...doc, title: title.trim() || doc.title }
}
