import { normalizeFeedUrl } from '@/opml/url'
import { flattenFeeds, type OpmlDocument } from '@/opml/types'
import { removeEmptyFolders, removeFeedsByXmlUrls } from '@/opml/mutate'
import { loadWorkspace, saveWorkspace } from '@/db/workspace'
import {
  mergeIntoLocalCatalog,
  type LocalCatalogFeed,
} from '@/db/catalog'

export const COMMUNITY_WORKSPACE_REVERT_KEY =
  'diverss-community-workspace-revert-v1'

/**
 * One-shot: move non-curated workspace feeds into the local Catalog, then
 * remove them from the OPML (undoes community→workspace bulk adds).
 */
export async function revertCommunityFeedsFromWorkspace(
  curatedUrls: Iterable<string>,
): Promise<{ moved: number; removed: number; skipped: boolean }> {
  try {
    if (localStorage.getItem(COMMUNITY_WORKSPACE_REVERT_KEY) === '1') {
      return { moved: 0, removed: 0, skipped: true }
    }
  } catch {
    /* private mode */
  }

  const keep = new Set(
    [...curatedUrls].map((u) => normalizeFeedUrl(u)).filter(Boolean),
  )
  const doc = await loadWorkspace()
  const workspaceFeeds = flattenFeeds(doc.outlines)
  const toMove: Omit<LocalCatalogFeed, 'addedAt'>[] = []
  const dropUrls: string[] = []

  for (const f of workspaceFeeds) {
    const key = normalizeFeedUrl(f.xmlUrl)
    if (!key || keep.has(key)) continue
    dropUrls.push(f.xmlUrl)
    toMove.push({
      title: f.text,
      xmlUrl: f.xmlUrl,
      htmlUrl: f.htmlUrl,
      sourceTitle: 'Recovered from workspace',
    })
  }

  if (dropUrls.length === 0) {
    try {
      localStorage.setItem(COMMUNITY_WORKSPACE_REVERT_KEY, '1')
    } catch {
      /* ignore */
    }
    return { moved: 0, removed: 0, skipped: false }
  }

  const { added: moved } = mergeIntoLocalCatalog(toMove)
  let next: OpmlDocument = removeFeedsByXmlUrls(doc, dropUrls)
  next = removeEmptyFolders(next).document
  await saveWorkspace(next)

  try {
    localStorage.setItem(COMMUNITY_WORKSPACE_REVERT_KEY, '1')
  } catch {
    /* ignore */
  }

  return { moved, removed: dropUrls.length, skipped: false }
}
