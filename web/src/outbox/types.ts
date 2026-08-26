/** Staging destination relative to the current workspace outline. */
export type OutboxDestination =
  | { kind: 'existing'; path: number[]; label: string }
  | { kind: 'new'; label: string }
  | { kind: 'ungrouped' }

export interface OutboxEntry {
  id: string
  xmlUrl: string
  title: string
  htmlUrl?: string
  /** Community group labels used when the entry was staged. */
  groups: string[]
  destination: OutboxDestination
  alreadyInWorkspace: boolean
  stagedAt: number
}

export interface OutboxImportResult {
  document: import('@/opml/types').OpmlDocument
  added: number
  skippedAlreadyPresent: number
  createdCategories: string[]
  /** Entry ids that were appended (for store cleanup). */
  addedIds: string[]
}
