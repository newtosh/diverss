<script setup lang="ts">
import { computed, onActivated, onDeactivated, onMounted, ref, watch } from 'vue'
import { theme } from '@/lib/theme'
import Button from '@/components/ui/Button.vue'
import OutlineList from '@/components/OutlineList.vue'
import ListFilterPanel from '@/components/ListFilterPanel.vue'
import PruneFeedsModal, {
  type PruneCandidate,
} from '@/components/PruneFeedsModal.vue'
import AddFeedModal, { type AddFeedPayload } from '@/components/AddFeedModal.vue'
import AddCategoryModal, {
  type AddCategoryPayload,
} from '@/components/AddCategoryModal.vue'
import MoveFeedModal from '@/components/MoveFeedModal.vue'
import SelectionActionBar from '@/components/SelectionActionBar.vue'
import ExportOpmlModal from '@/components/ExportOpmlModal.vue'
import { parseOpml, OpmlParseError } from '@/opml/parse'
import { serializeOpml } from '@/opml/serialize'
import { opmlDownloadFilename } from '@/opml/filename'
import {
  appendFeed,
  appendFolder,
  listSectionOptions,
  moveFeed,
  moveFeedsByUrls,
  outlineAtPath,
  removeAtPath,
  removeEmptyFolders,
  removeFeedsByXmlUrls,
  setDocumentTitle,
  updateFeedText,
  updateFolderText,
  updateFeedXmlUrl,
  type OutlinePath,
} from '@/opml/mutate'
import type { OpmlDocument } from '@/opml/types'
import {
  collectFolderKeys,
  countFeeds,
  emptyOpmlDocument,
  flattenFeeds,
} from '@/opml/types'
import {
  loadWorkspaceSnapshot,
  saveWorkspaceSnapshot,
  workspaceEpoch,
  type WorkspaceSnapshot,
} from '@/db/workspace'
import {
  discoverFeeds,
  scanUrls,
  scanWorkerUrl,
  type ScanResult,
  type ScanTimeframe,
} from '@/scan/client'
import { feedMirrorsFor } from '@/scan/mirrors'
import { lastPostAgeDays, lastPostAgeLabel, reasonLabel, isFetchBlocked } from '@/scan/presentation'
import {
  feedMatchesListFilter,
  listFilterActive,
  type ListHealthFilter,
} from '@/lib/listFilter'
import {
  dedupeSuggestions,
  discoverPageForFeed,
  proxyUnwrap,
  type FeedSuggestion,
} from '@/suggest/proxyUnwrap'

const workspace = ref<OpmlDocument>(emptyOpmlDocument())
const ready = ref(false)
const error = ref('')
const status = ref('')
const editingPath = ref<string | null>(null)
const editDraft = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const scores = ref<Record<string, ScanResult>>({})
const scanning = ref(false)
const scanDone = ref(0)
const scanTotal = ref(0)
/** URLs in the active Scan run — drives row loading pills on re-scan. */
const scanningUrls = ref<Record<string, true>>({})
/** pathKey → true when collapsed */
const collapsed = ref<Record<string, boolean>>({})
const timeframe = ref<ScanTimeframe>('7d')
const listQuery = ref('')
const listHealth = ref<ListHealthFilter>('all')
const addFeedOpen = ref(false)
const addCategoryOpen = ref(false)
const exportOpen = ref(false)
const moveFeedPath = ref<OutlinePath | null>(null)
const bulkMoveOpen = ref(false)
const selectedUrls = ref<string[]>([])
/** Last feed toggled without Shift — anchor for Shift+click ranges. */
const selectionAnchor = ref<string | null>(null)
const selectedCount = computed(() => selectedUrls.value.length)
const moveFeedTitle = computed(() => {
  if (bulkMoveOpen.value) {
    const n = selectedCount.value
    return `${n} feed${n === 1 ? '' : 's'}`
  }
  if (!moveFeedPath.value) return ''
  const node = outlineAtPath(workspace.value.outlines, moveFeedPath.value)
  return node?.kind === 'feed' ? node.text : ''
})
const moveFeedCurrentFolder = computed(
  () => moveFeedPath.value?.slice(0, -1) ?? [],
)

const feedCount = computed(() => flattenFeeds(workspace.value.outlines).length)
const folderKeys = computed(() => collectFolderKeys(workspace.value.outlines))
const hasFolders = computed(() => folderKeys.value.length > 0)
const sectionOptions = computed(() => listSectionOptions(workspace.value.outlines))
const existingFeedUrls = computed(
  () => new Set(flattenFeeds(workspace.value.outlines).map((f) => f.xmlUrl)),
)
const pruneOpen = ref(false)
const pruneSelected = ref<Record<string, boolean>>({})
const pruneRemoveEmptySections = ref(true)
/** Extra suggestions from Worker autodiscovery, keyed by current xmlUrl. */
const discoveredByUrl = ref<Record<string, FeedSuggestion[]>>({})
const discoverErrorByUrl = ref<Record<string, string>>({})
const discoveringUrl = ref<string | null>(null)
/** Scan results for suggested URLs (not necessarily in the OPML). */
const suggestionScores = ref<Record<string, ScanResult>>({})
/** True while scanning the current suggestion list. */
const scanningSuggestions = ref(false)
/** xmlUrl currently being re-scanned after Fix URL. */
const rescanningUrl = ref<string | null>(null)
/** Suggestion URLs already tried (failed or replaced); hide from the list. */
const rejectedSuggestionUrls = ref<Record<string, true>>({})
/** After a bad re-scan, force the Fix URL panel open on this xmlUrl. */
const reopenFixUrl = ref<string | null>(null)

const suggestionsByUrl = computed(() => {
  const out: Record<string, FeedSuggestion[]> = {}
  for (const feed of flattenFeeds(workspace.value.outlines)) {
    const scan = scores.value[feed.xmlUrl]
    if (scan?.health !== 'unhealthy' && scan?.health !== 'stale') continue
    const mirrors: FeedSuggestion[] = feedMirrorsFor(feed.xmlUrl).map((xmlUrl) => ({
      xmlUrl,
      label: 'Known mirror',
      source: 'autodiscover' as const,
    }))
    const local = proxyUnwrap(feed.xmlUrl).suggestions
    const remote = discoveredByUrl.value[feed.xmlUrl] ?? []
    const merged = dedupeSuggestions([...mirrors, ...local, ...remote]).filter(
      (s) =>
        s.xmlUrl !== feed.xmlUrl && !rejectedSuggestionUrls.value[s.xmlUrl],
    )
    out[feed.xmlUrl] = merged
  }
  return out
})

function markRejectedSuggestion(...urls: string[]) {
  const next = { ...rejectedSuggestionUrls.value }
  for (const u of urls) {
    const t = u.trim()
    if (t) next[t] = true
  }
  rejectedSuggestionUrls.value = next
}

function clearRejectedSuggestions(urls: string[]) {
  const next = { ...rejectedSuggestionUrls.value }
  for (const u of urls) delete next[u]
  rejectedSuggestionUrls.value = next
}

/** Scan suggested feed URLs so Fix URL can show health + signal. */
async function scanSuggestionUrls(urls: string[]) {
  if (!scanWorkerUrl()) return
  const need = [...new Set(urls.map((u) => u.trim()).filter(Boolean))].filter(
    (u) => !suggestionScores.value[u],
  )
  if (need.length === 0) return
  scanningSuggestions.value = true
  try {
    const results = await scanUrls(need)
    const next = { ...suggestionScores.value }
    for (const r of results) next[r.xmlUrl] = r
    suggestionScores.value = next
  } catch {
    // Leave unscanned; user can still try Use this URL.
  } finally {
    scanningSuggestions.value = false
  }
}

watch(
  suggestionsByUrl,
  (map) => {
    const urls: string[] = []
    for (const list of Object.values(map)) {
      for (const s of list) urls.push(s.xmlUrl)
    }
    void scanSuggestionUrls(urls)
  },
  { deep: true },
)

const pruneCandidates = computed((): PruneCandidate[] => {
  const byUrl = new Map(
    flattenFeeds(workspace.value.outlines).map((f) => [f.xmlUrl, f] as const),
  )
  const byKey = new Map<string, PruneCandidate>()
  for (const s of Object.values(scores.value)) {
    if (s.health !== 'stale' && s.health !== 'unhealthy') continue
    // Host blocked Scan egress — not a dead feed; keep out of prune defaults.
    if (isFetchBlocked(s)) continue
    const feed = byUrl.get(s.xmlUrl)
    if (!feed) continue
    const key = feed.xmlUrl
    let item: PruneCandidate
    if (s.health === 'unhealthy') {
      item = {
        xmlUrl: s.xmlUrl,
        text: feed.text,
        health: 'unhealthy',
        badge: isFetchBlocked(s) ? 'Blocked' : 'Unhealthy',
        detail: reasonLabel(s.reason, s.detail),
        ageDays: null,
      }
    } else {
      const ageDays = lastPostAgeDays(s.lastDatedAt)
      const age = lastPostAgeLabel(s.lastDatedAt)
      item = {
        xmlUrl: s.xmlUrl,
        text: feed.text,
        health: 'stale',
        badge: age ? `Stale · ${age}` : 'Stale',
        lastDatedAt: s.lastDatedAt,
        ageDays,
      }
    }
    const prev = byKey.get(key)
    // Prefer unhealthy over stale; for stale keep the older last-post.
    if (!prev) {
      byKey.set(key, item)
    } else if (item.health === 'unhealthy' && prev.health !== 'unhealthy') {
      byKey.set(key, item)
    } else if (
      item.health === 'stale' &&
      prev.health === 'stale' &&
      (item.ageDays ?? -1) > (prev.ageDays ?? -1)
    ) {
      byKey.set(key, item)
    }
  }
  const items = [...byKey.values()]
  items.sort((a, b) => {
    if (a.health !== b.health) return a.health === 'unhealthy' ? -1 : 1
    return a.text.localeCompare(b.text)
  })
  return items
})

const problemCount = computed(() => pruneCandidates.value.length)
const listFilterOn = computed(() =>
  listFilterActive(listQuery.value, listHealth.value),
)
const visibleFeedCount = computed(() =>
  flattenFeeds(workspace.value.outlines).filter((f) =>
    feedMatchesListFilter(f, scores.value, listQuery.value, listHealth.value),
  ).length,
)

const visibleFeedUrls = computed(() =>
  flattenFeeds(workspace.value.outlines)
    .filter((f) =>
      feedMatchesListFilter(f, scores.value, listQuery.value, listHealth.value),
    )
    .map((f) => f.xmlUrl),
)
const canScan = computed(() => Boolean(scanWorkerUrl()) && feedCount.value > 0)
const scanPercent = computed(() =>
  scanTotal.value > 0 ? Math.min(100, Math.round((scanDone.value / scanTotal.value) * 100)) : 0,
)

function toggleFolder(key: string) {
  collapsed.value = { ...collapsed.value, [key]: !collapsed.value[key] }
}

function expandAll() {
  collapsed.value = {}
}

function collapseAll() {
  const next: Record<string, boolean> = {}
  for (const k of folderKeys.value) next[k] = true
  collapsed.value = next
}

let persistTimer: ReturnType<typeof setTimeout> | null = null
/** Skip deep-watch persist while applying a snapshot loaded from disk. */
let suppressPersist = false
/** updatedAt of the snapshot last applied or successfully written by this view. */
let loadedUpdatedAt = 0

function applySnapshot(snap: WorkspaceSnapshot) {
  suppressPersist = true
  workspace.value = snap.document
  scores.value = snap.scores
  timeframe.value = snap.timeframe
  loadedUpdatedAt = snap.updatedAt
  suppressPersist = false
}

async function reloadFromDisk() {
  const snap = await loadWorkspaceSnapshot()
  applySnapshot(snap)
  return snap
}

async function persistNow() {
  if (suppressPersist) return
  const disk = await loadWorkspaceSnapshot()
  if (disk.updatedAt > loadedUpdatedAt) {
    // Outbox (or another tab/view) wrote newer data — do not clobber it.
    applySnapshot(disk)
    return
  }
  const saved = await saveWorkspaceSnapshot({
    document: workspace.value,
    scores: scores.value,
    timeframe: timeframe.value,
  })
  loadedUpdatedAt = saved.updatedAt
}

function schedulePersist() {
  if (!ready.value || suppressPersist) return
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    void persistNow()
  }, 200)
}

function cancelPersistTimer() {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
}

onMounted(async () => {
  try {
    const snap = await reloadFromDisk()
    if (flattenFeeds(snap.document.outlines).length > 0) {
      status.value = 'Restored workspace from this browser.'
    }
  } catch {
    error.value = 'Could not load saved workspace.'
  } finally {
    ready.value = true
  }

  window.addEventListener('pagehide', () => {
    cancelPersistTimer()
    void persistNow()
  })
})

onActivated(() => {
  if (!ready.value) return
  void (async () => {
    const snap = await loadWorkspaceSnapshot()
    if (snap.updatedAt > loadedUpdatedAt) {
      applySnapshot(snap)
      const n = flattenFeeds(snap.document.outlines).length
      status.value = `Garden synced (${n} feed${n === 1 ? '' : 's'}).`
    }
  })()
})

onDeactivated(() => {
  cancelPersistTimer()
  void persistNow()
})

watch(workspaceEpoch, () => {
  if (!ready.value) return
  void (async () => {
    const snap = await loadWorkspaceSnapshot()
    if (snap.updatedAt > loadedUpdatedAt) {
      applySnapshot(snap)
    }
  })()
})

watch(
  workspace,
  () => {
    schedulePersist()
  },
  { deep: true },
)

watch(scores, () => {
  schedulePersist()
}, { deep: true })

watch(timeframe, () => {
  schedulePersist()
})

function pathKey(path: OutlinePath): string {
  return path.join('.')
}

async function onFileSelected(ev: Event) {
  error.value = ''
  status.value = ''
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    workspace.value = parseOpml(text)
    scores.value = {}
    collapsed.value = {}
    status.value = `Imported ${flattenFeeds(workspace.value.outlines).length} feed(s).`
  } catch (e) {
    error.value =
      e instanceof OpmlParseError ? e.message : 'Failed to import OPML.'
  } finally {
    input.value = ''
  }
}

function startEdit(path: OutlinePath, current: string) {
  editingPath.value = pathKey(path)
  editDraft.value = current
}

function commitEdit(path: OutlinePath) {
  const next = editDraft.value.trim()
  if (next) {
    const node = outlineAtPath(workspace.value.outlines, path)
    if (node?.kind === 'folder') {
      workspace.value = updateFolderText(workspace.value, path, next)
    } else {
      workspace.value = updateFeedText(workspace.value, path, next)
    }
  }
  editingPath.value = null
  editDraft.value = ''
}

function cancelEdit() {
  editingPath.value = null
  editDraft.value = ''
}

async function useSuggestedUrl(path: OutlinePath, nextUrl: string) {
  const node = outlineAtPath(workspace.value.outlines, path)
  if (!node || node.kind !== 'feed') return
  const prev = node.xmlUrl
  const carried = dedupeSuggestions([
    ...(discoveredByUrl.value[prev] ?? []),
    ...proxyUnwrap(prev).suggestions,
    ...(discoveredByUrl.value[nextUrl] ?? []),
  ]).filter(
    (s) =>
      s.xmlUrl !== nextUrl &&
      s.xmlUrl !== prev &&
      !rejectedSuggestionUrls.value[s.xmlUrl],
  )

  markRejectedSuggestion(prev)
  workspace.value = updateFeedXmlUrl(workspace.value, path, nextUrl)

  const nextScores = { ...scores.value }
  delete nextScores[prev]
  scores.value = nextScores

  const nextDisc = { ...discoveredByUrl.value }
  delete nextDisc[prev]
  nextDisc[nextUrl] = carried
  discoveredByUrl.value = nextDisc

  const nextErr = { ...discoverErrorByUrl.value }
  delete nextErr[prev]
  delete nextErr[nextUrl]
  discoverErrorByUrl.value = nextErr

  status.value = 'Feed URL updated.'
  if (!scanWorkerUrl()) return

  rescanningUrl.value = nextUrl
  try {
    const results = await scanUrls([nextUrl])
    const scored = { ...scores.value }
    for (const r of results) scored[r.xmlUrl] = r
    scores.value = scored
    const health = results[0]?.health
    if (health === 'ok') {
      const cleared = { ...discoveredByUrl.value }
      delete cleared[nextUrl]
      discoveredByUrl.value = cleared
      clearRejectedSuggestions([prev, nextUrl])
      reopenFixUrl.value = null
      status.value = 'Feed URL updated and scanned healthy.'
      return
    }

    // Still stale/unhealthy — keep other choices and re-run site discovery.
    markRejectedSuggestion(nextUrl)
    const stillCarried = (discoveredByUrl.value[nextUrl] ?? []).filter(
      (s) => s.xmlUrl !== nextUrl && !rejectedSuggestionUrls.value[s.xmlUrl],
    )
    discoveredByUrl.value = {
      ...discoveredByUrl.value,
      [nextUrl]: stillCarried,
    }
    reopenFixUrl.value = nextUrl
    status.value =
      health === 'stale'
        ? 'Still stale — pick another suggested URL or search again.'
        : 'Still unhealthy — pick another suggested URL or search again.'
    await onDiscoverFeeds(path)
  } catch {
    reopenFixUrl.value = nextUrl
    status.value = 'Feed URL updated (re-scan failed). Try another suggestion.'
  } finally {
    rescanningUrl.value = null
  }
}

async function onDiscoverFeeds(path: OutlinePath) {
  const node = outlineAtPath(workspace.value.outlines, path)
  if (!node || node.kind !== 'feed') return
  if (!scanWorkerUrl()) {
    error.value = 'Scan Worker URL is not configured (VITE_SCAN_URL).'
    return
  }
  const page = discoverPageForFeed({
    xmlUrl: node.xmlUrl,
    htmlUrl: node.htmlUrl,
  })
  if (!page) {
    discoverErrorByUrl.value = {
      ...discoverErrorByUrl.value,
      [node.xmlUrl]: 'No site URL to search.',
    }
    return
  }
  discoveringUrl.value = node.xmlUrl
  const errNext = { ...discoverErrorByUrl.value }
  delete errNext[node.xmlUrl]
  discoverErrorByUrl.value = errNext
  try {
    const res = await discoverFeeds(page)
    if (!res.ok) {
      discoverErrorByUrl.value = {
        ...discoverErrorByUrl.value,
        [node.xmlUrl]: `Discover failed: ${reasonLabel(res.reason)}.`,
      }
      return
    }
    const fresh = res.candidates.map((c) => ({
      xmlUrl: c.xmlUrl,
      label: decodeBasicEntities(c.title?.trim() || 'Discovered feed'),
      source: 'autodiscover' as const,
    }))
    const merged = dedupeSuggestions([
      ...(discoveredByUrl.value[node.xmlUrl] ?? []),
      ...fresh,
    ]).filter(
      (s) =>
        s.xmlUrl !== node.xmlUrl && !rejectedSuggestionUrls.value[s.xmlUrl],
    )
    if (merged.length === 0 && fresh.length === 0) {
      discoverErrorByUrl.value = {
        ...discoverErrorByUrl.value,
        [node.xmlUrl]: 'No feeds found on that page.',
      }
      return
    }
    discoveredByUrl.value = {
      ...discoveredByUrl.value,
      [node.xmlUrl]: merged,
    }
    status.value = `Found ${merged.length} feed suggestion(s).`
    await scanSuggestionUrls(merged.map((s) => s.xmlUrl))
  } catch (e) {
    discoverErrorByUrl.value = {
      ...discoverErrorByUrl.value,
      [node.xmlUrl]: e instanceof Error ? e.message : 'Discover failed.',
    }
  } finally {
    discoveringUrl.value = null
  }
}

function decodeBasicEntities(s: string): string {
  return s
    .replace(/&raquo;/gi, '»')
    .replace(/&laquo;/gi, '«')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
}

/** Owner override: Stale → Unhealthy for prune triage (survives until re-Scan). */
function markFeedUnhealthy(path: OutlinePath) {
  const node = outlineAtPath(workspace.value.outlines, path)
  if (!node || node.kind !== 'feed') return
  const prev = scores.value[node.xmlUrl]
  if (!prev || prev.health !== 'stale') return

  scores.value = {
    ...scores.value,
    [node.xmlUrl]: {
      ...prev,
      health: 'unhealthy',
      reason: 'manual',
      detail: 'Marked unhealthy by you',
      velocityUnknown: true,
      scannedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    },
  }

  const nextDisc = { ...discoveredByUrl.value }
  delete nextDisc[node.xmlUrl]
  discoveredByUrl.value = nextDisc

  if (reopenFixUrl.value === node.xmlUrl) reopenFixUrl.value = null
  status.value = 'Marked as Unhealthy — use Prune feeds when ready.'
}

function prune(path: OutlinePath) {
  const node = outlineAtPath(workspace.value.outlines, path)
  if (!node) return

  if (node.kind === 'folder') {
    const n = countFeeds(node)
    const label = node.text || 'Untitled'
    if (
      !window.confirm(
        n === 1
          ? `Remove category “${label}” and its 1 feed?`
          : `Remove category “${label}” and its ${n} feeds?`,
      )
    ) {
      return
    }
    const urls = flattenFeeds([node]).map((f) => f.xmlUrl)
    workspace.value = removeAtPath(workspace.value, path)
    if (urls.length > 0) {
      const nextScores = { ...scores.value }
      for (const u of urls) delete nextScores[u]
      scores.value = nextScores
    }
    const key = pathKey(path)
    if (collapsed.value[key] !== undefined) {
      const nextCollapsed = { ...collapsed.value }
      delete nextCollapsed[key]
      collapsed.value = nextCollapsed
    }
    status.value =
      n === 0 ? 'Category removed.' : `Category removed (${n} feed${n === 1 ? '' : 's'}).`
    return
  }

  if (
    !window.confirm(
      `Delete “${node.text || 'Untitled'}”? This removes it from your workspace.`,
    )
  ) {
    return
  }

  workspace.value = removeAtPath(workspace.value, path)
  if (scores.value[node.xmlUrl]) {
    const nextScores = { ...scores.value }
    delete nextScores[node.xmlUrl]
    scores.value = nextScores
  }
  if (selectedUrls.value.includes(node.xmlUrl)) {
    selectedUrls.value = selectedUrls.value.filter((u) => u !== node.xmlUrl)
  }
  status.value = 'Feed deleted.'
}

function openMoveFeed(path: OutlinePath) {
  const node = outlineAtPath(workspace.value.outlines, path)
  if (!node || node.kind !== 'feed') return
  bulkMoveOpen.value = false
  moveFeedPath.value = path
}

function cancelMoveFeed() {
  moveFeedPath.value = null
  bulkMoveOpen.value = false
}

function confirmMoveFeed(folderPath: OutlinePath | null) {
  if (bulkMoveOpen.value) {
    const urls = [...selectedUrls.value]
    const n = urls.length
    if (n === 0) {
      bulkMoveOpen.value = false
      return
    }
    const label =
      folderPath === null
        ? 'Ungrouped'
        : sectionOptions.value.find((s) => s.path.join('.') === folderPath.join('.'))
            ?.label ?? 'category'
    workspace.value = moveFeedsByUrls(workspace.value, urls, folderPath)
    clearSelection()
    bulkMoveOpen.value = false
    status.value = `Moved ${n} feed${n === 1 ? '' : 's'} to ${label}.`
    return
  }

  const path = moveFeedPath.value
  if (!path) return
  const node = outlineAtPath(workspace.value.outlines, path)
  const label =
    folderPath === null
      ? 'Ungrouped'
      : sectionOptions.value.find((s) => s.path.join('.') === folderPath.join('.'))
          ?.label ?? 'category'
  workspace.value = moveFeed(workspace.value, path, folderPath)
  moveFeedPath.value = null
  status.value =
    node?.kind === 'feed' ? `Moved “${node.text}” to ${label}.` : 'Feed moved.'
}

function toggleSelect(xmlUrl: string, shiftKey = false, _modKey = false) {
  const order = visibleFeedUrls.value
  const selected = new Set(selectedUrls.value)

  if (shiftKey && selectionAnchor.value) {
    // Shift+click an already-selected row → remove it from the selection.
    if (selected.has(xmlUrl)) {
      selected.delete(xmlUrl)
      selectedUrls.value = [...selected]
      if (selectionAnchor.value === xmlUrl) {
        selectionAnchor.value =
          selectedUrls.value[selectedUrls.value.length - 1] ?? null
      }
      return
    }

    const from = order.indexOf(selectionAnchor.value)
    const to = order.indexOf(xmlUrl)
    if (from >= 0 && to >= 0) {
      // Unselected target → additive range from anchor → target.
      const lo = Math.min(from, to)
      const hi = Math.max(from, to)
      for (let i = lo; i <= hi; i++) selected.add(order[i]!)
      selectedUrls.value = [...selected]
      return
    }
  }

  // Plain click, Ctrl/Cmd+click, or Shift without a usable anchor: toggle one.
  if (selected.has(xmlUrl)) {
    selected.delete(xmlUrl)
    selectedUrls.value = [...selected]
    if (selectionAnchor.value === xmlUrl) {
      selectionAnchor.value =
        selectedUrls.value[selectedUrls.value.length - 1] ?? null
    }
    return
  }

  selected.add(xmlUrl)
  selectedUrls.value = [...selected]
  selectionAnchor.value = xmlUrl
}

function clearSelection() {
  selectedUrls.value = []
  selectionAnchor.value = null
}

function openBulkMove() {
  if (selectedUrls.value.length === 0) return
  moveFeedPath.value = null
  bulkMoveOpen.value = true
}

function bulkDeleteSelected() {
  const urls = [...selectedUrls.value]
  const n = urls.length
  if (n === 0) return
  if (
    !window.confirm(
      n === 1
        ? 'Delete 1 selected feed from your workspace?'
        : `Delete ${n} selected feeds from your workspace?`,
    )
  ) {
    return
  }
  workspace.value = removeFeedsByXmlUrls(workspace.value, urls)
  const nextScores = { ...scores.value }
  for (const u of urls) delete nextScores[u]
  scores.value = nextScores
  clearSelection()
  status.value = `Deleted ${n} feed${n === 1 ? '' : 's'}.`
}

function openPrune() {
  const sel: Record<string, boolean> = {}
  for (const c of pruneCandidates.value) sel[c.xmlUrl] = true
  pruneSelected.value = sel
  pruneRemoveEmptySections.value = true
  pruneOpen.value = true
}

function cancelPrune() {
  pruneOpen.value = false
}

function confirmPrune() {
  const urls = pruneCandidates.value
    .filter((c) => pruneSelected.value[c.xmlUrl])
    .map((c) => c.xmlUrl)
  let nextDoc = workspace.value
  if (urls.length > 0) {
    nextDoc = removeFeedsByXmlUrls(nextDoc, urls)
    const nextScores = { ...scores.value }
    for (const u of urls) delete nextScores[u]
    scores.value = nextScores
  }
  let emptyRemoved = 0
  if (pruneRemoveEmptySections.value) {
    const cleaned = removeEmptyFolders(nextDoc)
    nextDoc = cleaned.document
    emptyRemoved = cleaned.removed
  }
  if (urls.length === 0 && emptyRemoved === 0) return
  workspace.value = nextDoc
  pruneOpen.value = false
  const parts: string[] = []
  if (urls.length > 0) parts.push(`${urls.length} feed(s)`)
  if (emptyRemoved > 0) parts.push(`${emptyRemoved} empty categor${emptyRemoved === 1 ? 'y' : 'ies'}`)
  status.value = `Removed ${parts.join(' and ')}.`
}

function onAddFeed(payload: AddFeedPayload) {
  error.value = ''
  workspace.value = appendFeed(
    workspace.value,
    { text: payload.text, xmlUrl: payload.xmlUrl, htmlUrl: payload.htmlUrl },
    payload.sectionPath ?? undefined,
  )
  if (payload.scan) {
    scores.value = { ...scores.value, [payload.scan.xmlUrl]: payload.scan }
  }
  addFeedOpen.value = false
  status.value = payload.sectionPath?.length
    ? 'Feed added to category.'
    : 'Feed added.'
}

function onAddCategory(payload: AddCategoryPayload) {
  error.value = ''
  const result = appendFolder(
    workspace.value,
    payload.text,
    payload.parentPath ?? undefined,
  )
  if (!result) {
    error.value = 'Could not add category.'
    return
  }
  workspace.value = result.document
  // Keep new category expanded.
  const key = result.path.join('.')
  const next = { ...collapsed.value }
  delete next[key]
  collapsed.value = next
  addCategoryOpen.value = false
  status.value = `Category “${payload.text.trim()}” added.`
}

function confirmExport(title: string) {
  error.value = ''
  workspace.value = setDocumentTitle(workspace.value, title)
  exportOpen.value = false
  const xml = serializeOpml(workspace.value)
  const blob = new Blob([xml], { type: 'text/xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = window.document.createElement('a')
  a.href = url
  a.download = opmlDownloadFilename(title)
  a.click()
  URL.revokeObjectURL(url)
  status.value = 'Exported OPML (Scan not required).'
}

async function runScan(urls?: string[]) {
  error.value = ''
  if (!scanWorkerUrl()) {
    error.value = 'Scan Worker URL is not configured (VITE_SCAN_URL). Export still works.'
    return
  }
  const list =
    urls ?? flattenFeeds(workspace.value.outlines).map((f) => f.xmlUrl)
  if (list.length === 0) return
  scanning.value = true
  scanDone.value = 0
  scanTotal.value = list.length
  scanningUrls.value = Object.fromEntries(list.map((u) => [u, true as const]))
  status.value = `Scanning ${list.length} feed(s)…`
  try {
    const results = await scanUrls(list, (done, total) => {
      scanDone.value = done
      scanTotal.value = total
    })
    const next: Record<string, ScanResult> = { ...scores.value }
    for (const r of results) {
      next[r.xmlUrl] = r
    }
    scores.value = next
    status.value = `Scanned ${results.length} feed(s).`
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Scan failed.'
    status.value = 'Scan failed — you can still export.'
  } finally {
    scanning.value = false
    scanDone.value = 0
    scanTotal.value = 0
    scanningUrls.value = {}
  }
}

function runScanSelected() {
  void runScan([...selectedUrls.value])
}
</script>

<template>
  <section v-if="ready" class="space-y-6">
    <div class="space-y-1">
      <h1 class="text-xl font-semibold">Garden</h1>
      <p class="text-sm text-gr-text-muted">
        Import, optionally Scan, prune, and export OPML for your reader. GardenRSS
        is an RSS feed manager — not a feed reader.
      </p>
    </div>

    <div class="flex w-full flex-wrap items-center gap-3">
      <input
        ref="fileInput"
        type="file"
        accept=".opml,.xml,text/xml,application/xml"
        class="sr-only"
        @change="onFileSelected"
      />
      <Button variant="primary" @click="fileInput?.click()">Import OPML</Button>
      <Button variant="secondary" :disabled="!canScan || scanning" @click="runScan()">
        {{ scanning ? 'Scanning…' : 'Scan feeds' }}
      </Button>
      <Button variant="secondary" @click="exportOpen = true">Export OPML…</Button>
      <span class="text-sm text-gr-text-muted">{{ feedCount }} feed(s)</span>
      <p
        class="ml-auto min-h-5 min-w-0 flex-1 basis-40 text-right text-sm"
        :class="error ? 'text-red-700' : 'text-gr-accent-strong'"
        :role="error ? 'alert' : status ? 'status' : undefined"
      >
        <span v-if="error">{{ error }}</span>
        <span v-else-if="scanning">
          Scanning {{ scanDone }}/{{ scanTotal }}…
        </span>
        <span v-else-if="status">{{ status }}</span>
      </p>
    </div>

    <p v-if="!scanWorkerUrl()" class="text-xs text-gr-text-muted">
      Set <code class="rounded bg-gr-surface-2 px-1">VITE_SCAN_URL</code> to enable Scan (export works without it).
    </p>

    <div
      v-if="scanning"
      class="flex w-full items-center gap-3"
      role="status"
      aria-live="polite"
      :aria-valuenow="scanDone"
      :aria-valuemin="0"
      :aria-valuemax="scanTotal"
      aria-label="Scanning progress"
    >
      <div class="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-gr-border">
        <div
          class="relative h-full overflow-hidden rounded-full bg-gr-accent transition-[width] duration-300 ease-out"
          :style="{ width: `${scanPercent}%` }"
        >
          <div
            class="animate-scan-shimmer pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/35 to-transparent"
            aria-hidden="true"
          />
        </div>
      </div>
      <span class="shrink-0 text-sm tabular-nums text-gr-accent-strong">
        {{ scanDone }}/{{ scanTotal }}
      </span>
    </div>

    <div v-if="workspace.outlines.length === 0" class="space-y-4 text-center">
      <img
        :src="theme === 'dark' ? '/brand/hero-window-planter-dark.svg' : '/brand/hero-window-planter-light.svg'"
        alt=""
        class="mx-auto w-full max-w-md rounded-xl border border-gr-border"
      />
      <div class="space-y-1">
        <p class="text-base font-semibold text-gr-text">Your garden is empty</p>
        <p class="text-sm text-gr-text-muted">
          Add your first feed to start growing your list.
        </p>
      </div>
      <div class="flex flex-wrap justify-center gap-2">
        <Button variant="secondary" size="sm" @click="addFeedOpen = true">Add a feed…</Button>
        <Button variant="secondary" size="sm" @click="addCategoryOpen = true">
          Add a category…
        </Button>
      </div>
    </div>

    <div v-else class="space-y-3">
      <ListFilterPanel
        v-model:query="listQuery"
        v-model:health="listHealth"
        v-model:timeframe="timeframe"
        :showing-label="`Showing ${visibleFeedCount} of ${feedCount}`"
      >
        <template v-if="hasFolders" #tools>
          <div
            class="flex items-center gap-1"
            role="group"
            aria-label="Categories"
          >
            <span class="mr-1 text-xs font-medium text-gr-text-muted">Categories</span>
            <Button variant="ghost" size="sm" @click="expandAll">Expand all</Button>
            <Button variant="ghost" size="sm" @click="collapseAll">Collapse all</Button>
          </div>
        </template>
        <template #actions>
          <Button variant="secondary" size="sm" @click="addFeedOpen = true">Add a feed…</Button>
          <Button variant="secondary" size="sm" @click="addCategoryOpen = true">
            Add a category…
          </Button>
          <button
            v-if="problemCount > 0"
            type="button"
            class="inline-flex items-center gap-2 rounded-md border border-amber-600 bg-amber-50 px-2.5 py-1 text-sm font-medium text-amber-900 hover:bg-amber-100"
            @click="openPrune"
          >
            Prune feeds…
            <span
              class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-700 px-1.5 text-xs font-semibold tabular-nums text-white"
              aria-hidden="true"
            >
              {{ problemCount }}
            </span>
            <span class="sr-only">({{ problemCount }})</span>
          </button>
        </template>
      </ListFilterPanel>

      <p
        v-if="listFilterOn && visibleFeedCount === 0"
        class="text-sm text-gr-text-muted"
      >
        No feeds match this filter.
      </p>

      <OutlineList
        v-else
        :outlines="workspace.outlines"
        :path="[]"
        :editing-path="editingPath"
        :edit-draft="editDraft"
        :scores="scores"
        :collapsed="collapsed"
        :timeframe="timeframe"
        :filter-query="listQuery"
        :filter-health="listHealth"
        :suggestions-by-url="suggestionsByUrl"
        :suggestion-scores="suggestionScores"
        :scanning-suggestions="scanningSuggestions"
        :discovering-url="discoveringUrl"
        :rescanning-url="rescanningUrl"
        :reopen-fix-url="reopenFixUrl"
        :discover-error-by-url="discoverErrorByUrl"
        :can-discover="Boolean(scanWorkerUrl())"
        :selected-urls="selectedUrls"
        :scanning-urls="scanningUrls"
        @update:edit-draft="editDraft = $event"
        @start-edit="startEdit"
        @commit-edit="commitEdit"
        @cancel-edit="cancelEdit"
        @prune="prune"
        @move-feed="openMoveFeed"
        @toggle-select="toggleSelect"
        @toggle-folder="toggleFolder"
        @use-suggested-url="useSuggestedUrl"
        @discover-feeds="onDiscoverFeeds"
        @mark-unhealthy="markFeedUnhealthy"
      />

      <SelectionActionBar
        :count="selectedCount"
        :can-scan="Boolean(scanWorkerUrl()) && selectedCount > 0"
        :scanning="scanning"
        :scan-done="scanDone"
        :scan-total="scanTotal"
        @scan="runScanSelected"
        @move="openBulkMove"
        @delete="bulkDeleteSelected"
        @clear="clearSelection"
      />

      <PruneFeedsModal
        :open="pruneOpen"
        :candidates="pruneCandidates"
        v-model:selected="pruneSelected"
        v-model:remove-empty-sections="pruneRemoveEmptySections"
        @cancel="cancelPrune"
        @confirm="confirmPrune"
      />
    </div>

    <AddFeedModal
      :open="addFeedOpen"
      :sections="sectionOptions"
      :existing-urls="existingFeedUrls"
      :timeframe="timeframe"
      :can-verify="Boolean(scanWorkerUrl())"
      @cancel="addFeedOpen = false"
      @confirm="onAddFeed"
    />
    <AddCategoryModal
      :open="addCategoryOpen"
      :sections="sectionOptions"
      @cancel="addCategoryOpen = false"
      @confirm="onAddCategory"
    />
    <MoveFeedModal
      :open="moveFeedPath !== null || bulkMoveOpen"
      :feed-title="moveFeedTitle"
      :current-folder-path="moveFeedCurrentFolder"
      :sections="sectionOptions"
      :bulk="bulkMoveOpen"
      @cancel="cancelMoveFeed"
      @confirm="confirmMoveFeed"
    />
    <ExportOpmlModal
      :open="exportOpen"
      :initial-title="workspace.title"
      @cancel="exportOpen = false"
      @confirm="confirmExport"
    />
  </section>
  <p v-else class="text-sm text-gr-text-muted">Loading workspace…</p>
</template>
