import { appendFeed } from '@/opml/mutate'
import { parseOpml } from '@/opml/parse'
import { serializeOpml } from '@/opml/serialize'
import type { OpmlDocument, OpmlOutline } from '@/opml/types'
import { emptyOpmlDocument, flattenFeeds } from '@/opml/types'
import { feedMembershipKeys } from '@/opml/url'
import { proposeDestination } from '@/outbox/propose'
import { stageEntry } from '@/outbox/store'
import type { ReaderAdapter } from './types'

export class WipeGuardError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WipeGuardError'
  }
}

export interface WipeOptions {
  backupCompleted: boolean
  confirmed: boolean
  /** Called after each successful delete (and once at 0/total before deletes). */
  onProgress?: (done: number, total: number) => void
}

/** Outcome of a guarded wipe, including a post-delete list check. */
export interface WipeResult {
  /** Feed count before deletes started. */
  before: number
  /** Feed count after deletes (+ one retry pass on leftovers). */
  remaining: number
  /** True when the reader lists zero feeds after wipe. */
  verified: boolean
}

export class WipeIncompleteError extends Error {
  constructor(
    readonly before: number,
    readonly remaining: number,
  ) {
    super(
      `Wipe incomplete: ${remaining} of ${before} feed(s) still on the reader after delete.`,
    )
    this.name = 'WipeIncompleteError'
  }
}

export interface PushSummary {
  mode: 'replace' | 'merge'
  wiped: number
  imported: boolean
}

export interface PullSummary {
  mode: 'replace' | 'merge' | 'stage'
  feedCount: number
  added?: number
  skipped?: number
  staged?: number
  document?: OpmlDocument
}

function feedsWithGroups(
  outlines: OpmlOutline[],
  pathLabels: string[] = [],
): { title: string; xmlUrl: string; htmlUrl?: string; groups: string[] }[] {
  const out: {
    title: string
    xmlUrl: string
    htmlUrl?: string
    groups: string[]
  }[] = []
  for (const node of outlines) {
    if (node.kind === 'feed') {
      out.push({
        title: node.text,
        xmlUrl: node.xmlUrl,
        htmlUrl: node.htmlUrl,
        groups: [...pathLabels],
      })
    } else {
      out.push(
        ...feedsWithGroups(node.children, [...pathLabels, node.text.trim()]),
      )
    }
  }
  return out
}

export async function wipeFeeds(
  adapter: ReaderAdapter,
  opts: WipeOptions,
): Promise<WipeResult> {
  if (!opts.backupCompleted) {
    throw new WipeGuardError('Backup required before wipe.')
  }
  if (!opts.confirmed) {
    throw new WipeGuardError('Explicit confirm required before wipe.')
  }
  const feeds = await adapter.listFeeds()
  const before = feeds.length
  opts.onProgress?.(0, before)
  if (before === 0) {
    return { before: 0, remaining: 0, verified: true }
  }

  await deleteFeedBatch(adapter, feeds, opts.onProgress)

  // Confirm deletes stuck — re-list and retry leftovers once.
  let remainingFeeds = await adapter.listFeeds()
  if (remainingFeeds.length > 0) {
    opts.onProgress?.(before - remainingFeeds.length, before)
    await deleteFeedBatch(adapter, remainingFeeds, (done) => {
      opts.onProgress?.(before - remainingFeeds.length + done, before)
    })
    remainingFeeds = await adapter.listFeeds()
  }

  const remaining = remainingFeeds.length
  const result: WipeResult = {
    before,
    remaining,
    verified: remaining === 0,
  }
  if (!result.verified) {
    throw new WipeIncompleteError(before, remaining)
  }
  return result
}

async function deleteFeedBatch(
  adapter: ReaderAdapter,
  feeds: { id: string }[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const total = feeds.length
  if (total === 0) return
  const concurrency = Math.min(5, total)
  let next = 0
  let done = 0
  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const i = next++
      if (i >= total) return
      const id = feeds[i]!.id
      if (!id) {
        throw new Error('Reader returned a feed without an id — cannot delete.')
      }
      await adapter.deleteFeed(id)
      done++
      onProgress?.(done, total)
    }
  })
  await Promise.all(workers)
}

export async function pushToReader(
  adapter: ReaderAdapter,
  workspace: OpmlDocument,
  mode: 'replace' | 'merge',
  wipeOpts?: WipeOptions,
): Promise<PushSummary> {
  let wiped = 0
  if (mode === 'replace') {
    if (!wipeOpts) {
      throw new WipeGuardError('Replace push requires backup and confirm.')
    }
    const wipe = await wipeFeeds(adapter, wipeOpts)
    wiped = wipe.before
  }
  const opml = serializeOpml(workspace)
  await adapter.importOpml(opml)
  return { mode, wiped, imported: true }
}

export async function pullFromReader(
  adapter: ReaderAdapter,
  workspace: OpmlDocument,
  mode: 'replace' | 'merge' | 'stage',
): Promise<PullSummary> {
  const opml = await adapter.exportOpml()
  const imported = parseOpml(opml)
  const feeds = feedsWithGroups(imported.outlines)

  if (mode === 'replace') {
    return {
      mode,
      feedCount: feeds.length,
      document: {
        title: workspace.title || imported.title || emptyOpmlDocument().title,
        outlines: imported.outlines,
      },
    }
  }

  if (mode === 'merge') {
    const membership = new Set<string>()
    for (const f of flattenFeeds(workspace.outlines)) {
      for (const k of feedMembershipKeys(f.xmlUrl)) membership.add(k)
    }
    let doc = workspace
    let added = 0
    let skipped = 0
    for (const f of feeds) {
      if (feedMembershipKeys(f.xmlUrl).some((k) => membership.has(k))) {
        skipped++
        continue
      }
      doc = appendFeed(doc, {
        text: f.title,
        xmlUrl: f.xmlUrl,
        htmlUrl: f.htmlUrl,
      })
      for (const k of feedMembershipKeys(f.xmlUrl)) membership.add(k)
      added++
    }
    return { mode, feedCount: feeds.length, added, skipped, document: doc }
  }

  // stage
  let staged = 0
  for (const f of feeds) {
    const membership = new Set<string>()
    for (const w of flattenFeeds(workspace.outlines)) {
      for (const k of feedMembershipKeys(w.xmlUrl)) membership.add(k)
    }
    stageEntry({
      xmlUrl: f.xmlUrl,
      title: f.title,
      htmlUrl: f.htmlUrl,
      groups: f.groups,
      destination: proposeDestination(f.groups, workspace),
      alreadyInWorkspace: feedMembershipKeys(f.xmlUrl).some((k) =>
        membership.has(k),
      ),
    })
    staged++
  }
  return { mode, feedCount: feeds.length, staged }
}

export async function deleteEmptyCategories(
  adapter: ReaderAdapter,
): Promise<{ deleted: number; skipped: number; errors: string[] }> {
  const cats = await adapter.listCategories()
  let deleted = 0
  let skipped = 0
  const errors: string[] = []
  for (const c of cats) {
    if (c.feedCount > 0) {
      skipped++
      continue
    }
    try {
      await adapter.deleteCategory(c.id)
      deleted++
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e))
    }
  }
  return { deleted, skipped, errors }
}
