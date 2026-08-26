import type { OpmlDocument } from '@/opml/types'
import { flattenFeeds } from '@/opml/types'
import { listSectionOptions } from '@/opml/mutate'
import { feedMembershipKeys } from '@/opml/url'
import type { OutboxDestination } from './types'

function casefold(s: string): string {
  return s.trim().toLowerCase()
}

function leafOf(label: string): string {
  const parts = label.split(' › ')
  return parts[parts.length - 1]?.trim() ?? label.trim()
}

/**
 * Propose an Outbox destination from community groups against the workspace.
 * Prefers an existing matching category; otherwise stages a new category from
 * the joined group path; with no groups, stages Ungrouped.
 *
 * Matching mirrors Catalog `groupPresence` / KTD1: casefold full `›` label,
 * else unique leaf folder name.
 */
export function proposeDestination(
  groups: string[],
  document: OpmlDocument,
): OutboxDestination {
  const trimmed = groups.map((g) => g.trim()).filter(Boolean)
  if (trimmed.length === 0) return { kind: 'ungrouped' }

  const label = trimmed.join(' › ')
  const sections = listSectionOptions(document.outlines)

  const exact = sections.find((s) => casefold(s.label) === casefold(label))
  if (exact) {
    return { kind: 'existing', path: exact.path, label: exact.label }
  }

  const leaf = leafOf(label)
  const leafMatches = sections.filter(
    (s) => casefold(leafOf(s.label)) === casefold(leaf),
  )
  if (leafMatches.length === 1) {
    return {
      kind: 'existing',
      path: leafMatches[0]!.path,
      label: leafMatches[0]!.label,
    }
  }

  return { kind: 'new', label }
}

/** Presence chip for a destination. */
export function categoryPresence(
  destination: OutboxDestination,
): 'existing' | 'new' | 'ungrouped' {
  if (destination.kind === 'ungrouped') return 'ungrouped'
  if (destination.kind === 'existing') return 'existing'
  return 'new'
}

export function isUrlInWorkspace(
  xmlUrl: string,
  membershipKeys: ReadonlySet<string>,
): boolean {
  return feedMembershipKeys(xmlUrl).some((k) => membershipKeys.has(k))
}

export function workspaceMembershipKeys(document: OpmlDocument): Set<string> {
  const keys = new Set<string>()
  for (const f of flattenFeeds(document.outlines)) {
    for (const k of feedMembershipKeys(f.xmlUrl)) keys.add(k)
  }
  return keys
}

/** Stable key for grouping Outbox rows that share a destination. */
export function destinationGroupKey(destination: OutboxDestination): string {
  if (destination.kind === 'ungrouped') return 'ungrouped'
  if (destination.kind === 'existing') {
    return `existing:${destination.path.join('.')}`
  }
  return `new:${destination.label}`
}

export function destinationDisplayLabel(destination: OutboxDestination): string {
  if (destination.kind === 'ungrouped') return 'Ungrouped'
  return destination.label
}
