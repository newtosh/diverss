import type { OpmlDocument, OpmlFeed, OpmlOutline } from './types'
import { flattenFeeds } from './types'
import { normalizeFeedUrl } from './url'

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

/** Resolve an outline node by index path from the document root. */
export function outlineAtPath(
  outlines: OpmlOutline[],
  path: OutlinePath,
): OpmlOutline | undefined {
  return atPath(outlines, path)
}

/** Deep-clone outlines. Avoid structuredClone — Vue reactive proxies throw DataCloneError. */
function cloneOutlines(outlines: OpmlOutline[]): OpmlOutline[] {
  return JSON.parse(JSON.stringify(outlines)) as OpmlOutline[]
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

/**
 * After removing `removedPath`, adjust another path that may share the same
 * parent and sit at a higher sibling index.
 */
export function pathAfterSiblingRemove(
  path: OutlinePath,
  removedPath: OutlinePath,
): OutlinePath {
  if (removedPath.length === 0 || path.length < removedPath.length) return path
  const parent = removedPath.slice(0, -1)
  const removedIdx = removedPath[removedPath.length - 1]!
  if (!parent.every((v, i) => path[i] === v)) return path
  const at = path[parent.length]
  if (at === undefined || at <= removedIdx) return path
  const next = [...path]
  next[parent.length] = at - 1
  return next
}

/** Move a feed to another category (`null` / `[]` = document root). */
export function moveFeed(
  doc: OpmlDocument,
  fromPath: OutlinePath,
  toFolderPath: OutlinePath | null,
): OpmlDocument {
  const node = outlineAtPath(doc.outlines, fromPath)
  if (!node || node.kind !== 'feed') return doc

  const parentPath = fromPath.slice(0, -1)
  const destKey = toFolderPath?.join('.') ?? ''
  const parentKey = parentPath.join('.')
  if (destKey === parentKey) return doc

  const feed: OpmlFeed = {
    kind: 'feed',
    text: node.text,
    xmlUrl: node.xmlUrl,
  }
  if (node.htmlUrl) feed.htmlUrl = node.htmlUrl

  const removed = removeAtPath(doc, fromPath)
  const folderPath =
    !toFolderPath || toFolderPath.length === 0
      ? undefined
      : pathAfterSiblingRemove(toFolderPath, fromPath)

  return appendFeed(removed, feed, folderPath)
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

export function updateFolderText(
  doc: OpmlDocument,
  path: OutlinePath,
  text: string,
): OpmlDocument {
  const name = text.trim()
  if (!name) return doc
  const outlines = cloneOutlines(doc.outlines)
  const node = atPath(outlines, path)
  if (!node || node.kind !== 'folder') return doc
  node.text = name
  return { ...doc, outlines }
}

export function updateFeedXmlUrl(
  doc: OpmlDocument,
  path: OutlinePath,
  xmlUrl: string,
): OpmlDocument {
  const outlines = cloneOutlines(doc.outlines)
  const node = atPath(outlines, path)
  if (!node || node.kind !== 'feed') return doc
  const next = xmlUrl.trim()
  if (!next) return doc
  try {
    const parsed = new URL(next)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return doc
  } catch {
    return doc
  }
  node.xmlUrl = next
  return { ...doc, outlines }
}

export function appendFeed(
  doc: OpmlDocument,
  feed: Pick<OpmlFeed, 'text' | 'xmlUrl' | 'htmlUrl'>,
  /** Folder path; omit or `[]` to append at document root. */
  folderPath?: OutlinePath,
): OpmlDocument {
  const text = feed.text.trim()
  const xmlUrl = feed.xmlUrl.trim()
  const htmlUrl = feed.htmlUrl?.trim()
  if (!text || !xmlUrl) return doc
  const outlines = cloneOutlines(doc.outlines)
  const next: OpmlFeed = { kind: 'feed', text, xmlUrl }
  if (htmlUrl) next.htmlUrl = htmlUrl

  if (!folderPath || folderPath.length === 0) {
    outlines.push(next)
    return { ...doc, outlines }
  }

  const folder = outlineAtPath(outlines, folderPath)
  if (!folder || folder.kind !== 'folder') return doc
  folder.children = [...folder.children, next]
  return { ...doc, outlines }
}

/** Flat list of sections for pickers (nested labels use ›). */
export function listSectionOptions(
  outlines: OpmlOutline[],
): { path: OutlinePath; label: string }[] {
  const out: { path: OutlinePath; label: string }[] = []

  function walk(nodes: OpmlOutline[], path: OutlinePath, parts: string[]) {
    nodes.forEach((node, i) => {
      if (node.kind !== 'folder') return
      const nextPath = [...path, i]
      const nextParts = [...parts, node.text]
      out.push({ path: nextPath, label: nextParts.join(' › ') })
      walk(node.children, nextPath, nextParts)
    })
  }

  walk(outlines, [], [])
  return out
}

/** Append an empty category/section folder at root or under `parentPath`. */
export function appendFolder(
  doc: OpmlDocument,
  text: string,
  parentPath?: OutlinePath,
): { document: OpmlDocument; path: OutlinePath } | null {
  const name = text.trim()
  if (!name) return null
  const outlines = cloneOutlines(doc.outlines)
  const next: OpmlOutline = { kind: 'folder', text: name, children: [] }

  if (!parentPath || parentPath.length === 0) {
    outlines.push(next)
    return { document: { ...doc, outlines }, path: [outlines.length - 1] }
  }

  const parent = outlineAtPath(outlines, parentPath)
  if (!parent || parent.kind !== 'folder') return null
  parent.children = [...parent.children, next]
  return {
    document: { ...doc, outlines },
    path: [...parentPath, parent.children.length - 1],
  }
}

/**
 * Walk/create folder segments under the document root.
 * Reuses an existing child folder when the name matches case-insensitively.
 * Empty `segments` returns the document unchanged with an empty path (root).
 */
export function ensureCategoryPath(
  doc: OpmlDocument,
  segments: string[],
): { document: OpmlDocument; path: OutlinePath } {
  let document = doc
  let path: OutlinePath = []

  for (const raw of segments) {
    const name = raw.trim()
    if (!name) continue

    const children =
      path.length === 0
        ? document.outlines
        : (() => {
            const node = outlineAtPath(document.outlines, path)
            return node?.kind === 'folder' ? node.children : []
          })()

    const idx = children.findIndex(
      (n) =>
        n.kind === 'folder' &&
        n.text.trim().toLowerCase() === name.toLowerCase(),
    )
    if (idx >= 0) {
      path = [...path, idx]
      continue
    }

    const created = appendFolder(
      document,
      name,
      path.length > 0 ? path : undefined,
    )
    if (!created) return { document, path }
    document = created.document
    path = created.path
  }

  return { document, path }
}

export function setDocumentTitle(doc: OpmlDocument, title: string): OpmlDocument {
  return { ...doc, title: title.trim() || doc.title }
}

/** Rewrite one feed's xmlUrl, found by its current URL rather than an OutlinePath. No-op if not found. */
export function updateFeedXmlUrlByOldUrl(
  doc: OpmlDocument,
  oldUrl: string,
  newUrl: string,
): OpmlDocument {
  const target = normalizeFeedUrl(oldUrl)
  const next = newUrl.trim()
  if (!target || !next) return doc
  try {
    const parsed = new URL(next)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return doc
  } catch {
    return doc
  }

  let changed = false
  function walk(nodes: OpmlOutline[]): OpmlOutline[] {
    return nodes.map((node) => {
      if (node.kind === 'feed') {
        if (!changed && normalizeFeedUrl(node.xmlUrl) === target) {
          changed = true
          return { ...node, xmlUrl: next }
        }
        return node
      }
      return { ...node, children: walk(node.children) }
    })
  }

  const outlines = walk(cloneOutlines(doc.outlines))
  return changed ? { ...doc, outlines } : doc
}

/** Remove all feeds whose xmlUrl is in the set (stable tree walk; no index shift bugs). */
export function removeFeedsByXmlUrls(
  doc: OpmlDocument,
  urls: Iterable<string>,
): OpmlDocument {
  const drop = new Set(
    [...urls].map((u) => normalizeFeedUrl(u)).filter(Boolean),
  )
  if (drop.size === 0) return doc

  function filterNodes(nodes: OpmlOutline[]): OpmlOutline[] {
    const out: OpmlOutline[] = []
    for (const node of nodes) {
      if (node.kind === 'feed') {
        if (!drop.has(normalizeFeedUrl(node.xmlUrl))) out.push(node)
        continue
      }
      const children = filterNodes(node.children)
      out.push({ ...node, children })
    }
    return out
  }

  return { ...doc, outlines: filterNodes(cloneOutlines(doc.outlines)) }
}

/**
 * Relocate feeds by URL into `toFolderPath` (null/`[]` = document root).
 * Preserves document order of the moved set.
 */
export function moveFeedsByUrls(
  doc: OpmlDocument,
  urls: Iterable<string>,
  toFolderPath: OutlinePath | null,
): OpmlDocument {
  const drop = new Set(
    [...urls].map((u) => normalizeFeedUrl(u)).filter(Boolean),
  )
  if (drop.size === 0) return doc

  const moving: OpmlFeed[] = []
  for (const f of flattenFeeds(doc.outlines)) {
    if (drop.has(normalizeFeedUrl(f.xmlUrl))) {
      const copy: OpmlFeed = {
        kind: 'feed',
        text: f.text,
        xmlUrl: f.xmlUrl,
      }
      if (f.htmlUrl) copy.htmlUrl = f.htmlUrl
      moving.push(copy)
    }
  }
  if (moving.length === 0) return doc

  let next = removeFeedsByXmlUrls(doc, urls)
  const folder =
    !toFolderPath || toFolderPath.length === 0 ? undefined : toFolderPath
  for (const feed of moving) {
    next = appendFeed(next, feed, folder)
  }
  return next
}

/**
 * Drop folders that contain no feeds (and no non-empty nested folders).
 * Walks bottom-up so nested empties collapse in one pass.
 */
export function removeEmptyFolders(doc: OpmlDocument): {
  document: OpmlDocument
  removed: number
} {
  let removed = 0

  function filterNodes(nodes: OpmlOutline[]): OpmlOutline[] {
    const out: OpmlOutline[] = []
    for (const node of nodes) {
      if (node.kind === 'feed') {
        out.push(node)
        continue
      }
      const children = filterNodes(node.children)
      if (children.length === 0) {
        removed++
        continue
      }
      out.push({ ...node, children })
    }
    return out
  }

  return {
    document: { ...doc, outlines: filterNodes(cloneOutlines(doc.outlines)) },
    removed,
  }
}
