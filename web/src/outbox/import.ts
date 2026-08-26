import {
  appendFeed,
  ensureCategoryPath,
  listSectionOptions,
  outlineAtPath,
  type OutlinePath,
} from '@/opml/mutate'
import type { OpmlDocument } from '@/opml/types'
import { feedMembershipKeys } from '@/opml/url'
import { workspaceMembershipKeys } from './propose'
import type { OutboxDestination, OutboxEntry, OutboxImportResult } from './types'

function segmentsFor(destination: OutboxDestination): string[] {
  if (destination.kind === 'ungrouped') return []
  return destination.label
    .split(' › ')
    .map((s) => s.trim())
    .filter(Boolean)
}

function resolveFolder(
  doc: OpmlDocument,
  destination: OutboxDestination,
): {
  document: OpmlDocument
  folderPath: OutlinePath | undefined
  createdLabels: string[]
} {
  if (destination.kind === 'ungrouped') {
    return { document: doc, folderPath: undefined, createdLabels: [] }
  }

  if (destination.kind === 'existing') {
    const node = outlineAtPath(doc.outlines, destination.path)
    if (node?.kind === 'folder') {
      return {
        document: doc,
        folderPath: destination.path,
        createdLabels: [],
      }
    }
  }

  const before = new Set(listSectionOptions(doc.outlines).map((s) => s.label))
  const ensured = ensureCategoryPath(doc, segmentsFor(destination))
  const createdLabels = listSectionOptions(ensured.document.outlines)
    .map((s) => s.label)
    .filter((label) => !before.has(label))
  return {
    document: ensured.document,
    folderPath: ensured.path.length > 0 ? ensured.path : undefined,
    createdLabels,
  }
}

/**
 * Append non-duplicate Outbox entries into the workspace document.
 * Skips rows that are already present (flag or membership). Does not mutate
 * the Outbox store — caller removes `addedIds`.
 */
export function importOutbox(
  doc: OpmlDocument,
  entries: readonly OutboxEntry[],
): OutboxImportResult {
  let document = doc
  let added = 0
  let skippedAlreadyPresent = 0
  const createdCategories: string[] = []
  const addedIds: string[] = []
  const membership = workspaceMembershipKeys(document)

  for (const entry of entries) {
    if (
      entry.alreadyInWorkspace ||
      feedMembershipKeys(entry.xmlUrl).some((k) => membership.has(k))
    ) {
      skippedAlreadyPresent++
      continue
    }

    const resolved = resolveFolder(document, entry.destination)
    document = resolved.document
    for (const label of resolved.createdLabels) {
      if (!createdCategories.includes(label)) createdCategories.push(label)
    }

    document = appendFeed(
      document,
      {
        text: entry.title,
        xmlUrl: entry.xmlUrl,
        htmlUrl: entry.htmlUrl,
      },
      resolved.folderPath,
    )

    for (const k of feedMembershipKeys(entry.xmlUrl)) membership.add(k)
    added++
    addedIds.push(entry.id)
  }

  return {
    document,
    added,
    skippedAlreadyPresent,
    createdCategories,
    addedIds,
  }
}
