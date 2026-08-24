/** A subscription feed outline (requires text + xmlUrl). */
export interface OpmlFeed {
  kind: 'feed'
  text: string
  xmlUrl: string
  htmlUrl?: string
}

/** A folder/group outline; children may be feeds or nested folders. */
export interface OpmlFolder {
  kind: 'folder'
  text: string
  children: OpmlOutline[]
}

export type OpmlOutline = OpmlFeed | OpmlFolder

export interface OpmlDocument {
  title: string
  outlines: OpmlOutline[]
}

export function emptyOpmlDocument(title = 'DiveRSS workspace'): OpmlDocument {
  return { title, outlines: [] }
}

/** Flatten feeds in document order (folders skipped as nodes, children walked). */
export function flattenFeeds(outlines: OpmlOutline[]): OpmlFeed[] {
  const feeds: OpmlFeed[] = []
  const walk = (nodes: OpmlOutline[]) => {
    for (const node of nodes) {
      if (node.kind === 'feed') feeds.push(node)
      else walk(node.children)
    }
  }
  walk(outlines)
  return feeds
}
