/** Community / awesome-list source registry (opt-in parse). */

export interface SourceEntrypoint {
  label: string
  /**
   * Absolute URL to an OPML document, or omit when `mergeSections` is true
   * (client merges every `role: "section"` pack on the same source).
   */
  url?: string
  suggestedCategory?: string
  /**
   * `collection` — full source pack (default browse list).
   * `section` — category/subset slice (Advanced only unless enabled).
   * Default when omitted: `collection` if it has a url, else `section`.
   */
  role?: 'collection' | 'section'
  /** When true, load by merging all section entrypoints on this source. */
  mergeSections?: boolean
}

export interface CommunitySource {
  id: string
  title: string
  kind: string
  homepage: string
  license?: string
  attribution: string
  entrypoints: SourceEntrypoint[]
  notes?: string
}

export interface SourcesFile {
  schemaVersion: number
  updatedAt?: string
  description?: string
  sources: CommunitySource[]
}

export interface ParsedSourceFeed {
  text: string
  xmlUrl: string
  htmlUrl?: string
  /** Folder path labels from the OPML, if any. */
  groups: string[]
  sourceId: string
  sourceTitle: string
  entrypointLabel: string
}
