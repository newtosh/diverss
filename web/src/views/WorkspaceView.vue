<script setup lang="ts">
import { computed, onActivated, onDeactivated, onMounted, ref, watch } from 'vue'
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
  scoreUrls,
  scoreWorkerUrl,
  type ScoreResult,
  type ScoreTimeframe,
} from '@/score/client'
import { lastPostAgeDays, lastPostAgeLabel, reasonLabel } from '@/score/presentation'
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
const scores = ref<Record<string, ScoreResult>>({})
const scoring = ref(false)
const scoreDone = ref(0)
const scoreTotal = ref(0)
/** pathKey → true when collapsed */
const collapsed = ref<Record<string, boolean>>({})
const timeframe = ref<ScoreTimeframe>('7d')
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
/** Score results for suggested URLs (not necessarily in the OPML). */
const suggestionScores = ref<Record<string, ScoreResult>>({})
/** True while scoring the current suggestion list. */
const scoringSuggestions = ref(false)
/** xmlUrl currently being re-scored after Fix URL. */
const rescoringUrl = ref<string | null>(null)
/** Suggestion URLs already tried (failed or replaced); hide from the list. */
const rejectedSuggestionUrls = ref<Record<string, true>>({})
/** After a bad re-score, force the Fix URL panel open on this xmlUrl. */
const reopenFixUrl = ref<string | null>(null)

const suggestionsByUrl = computed(() => {
  const out: Record<string, FeedSuggestion[]> = {}
  for (const feed of flattenFeeds(workspace.value.outlines)) {
    const score = scores.value[feed.xmlUrl]
    if (score?.health !== 'unhealthy' && score?.health !== 'stale') continue
    const local = proxyUnwrap(feed.xmlUrl).suggestions
    const remote = discoveredByUrl.value[feed.xmlUrl] ?? []
    const merged = dedupeSuggestions([...local, ...remote]).filter(
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

/** Score suggested feed URLs so Fix URL can show health + signal. */
async function scoreSuggestionUrls(urls: string[]) {
  if (!scoreWorkerUrl()) return
  const need = [...new Set(urls.map((u) => u.trim()).filter(Boolean))].filter(
    (u) => !suggestionScores.value[u],
  )
  if (need.length === 0) return
  scoringSuggestions.value = true
  try {
    const results = await scoreUrls(need)
    const next = { ...suggestionScores.value }
    for (const r of results) next[r.xmlUrl] = r
    suggestionScores.value = next
  } catch {
    // Leave unscored; user can still try Use this URL.
  } finally {
    scoringSuggestions.value = false
  }
}

watch(
  suggestionsByUrl,
  (map) => {
    const urls: string[] = []
    for (const list of Object.values(map)) {
      for (const s of list) urls.push(s.xmlUrl)
    }
    void scoreSuggestionUrls(urls)
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
    const feed = byUrl.get(s.xmlUrl)
    if (!feed) continue
    const key = feed.xmlUrl
    let item: PruneCandidate
    if (s.health === 'unhealthy') {
      item = {
        xmlUrl: s.xmlUrl,
        text: feed.text,
        health: 'unhealthy',
        badge: 'Unhealthy',
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
const canScore = computed(() => Boolean(scoreWorkerUrl()) && feedCount.value > 0)
const scorePercent = computed(() =>
  scoreTotal.value > 0 ? Math.min(100, Math.round((scoreDone.value / scoreTotal.value) * 100)) : 0,
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
      status.value = `Workspace synced (${n} feed${n === 1 ? '' : 's'}).`
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
  if (!scoreWorkerUrl()) return

  rescoringUrl.value = nextUrl
  try {
    const results = await scoreUrls([nextUrl])
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
      status.value = 'Feed URL updated and scored healthy.'
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
    status.value = 'Feed URL updated (re-score failed). Try another suggestion.'
  } finally {
    rescoringUrl.value = null
  }
}

async function onDiscoverFeeds(path: OutlinePath) {
  const node = outlineAtPath(workspace.value.outlines, path)
  if (!node || node.kind !== 'feed') return
  if (!scoreWorkerUrl()) {
    error.value = 'Score Worker URL is not configured (VITE_SCORE_URL).'
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
    await scoreSuggestionUrls(merged.map((s) => s.xmlUrl))
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

/** Owner override: Stale → Unhealthy for prune triage (survives until re-Score). */
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
      scoredAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
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
  if (payload.score) {
    scores.value = { ...scores.value, [payload.score.xmlUrl]: payload.score }
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
  status.value = 'Exported OPML (Score not required).'
}

async function runScore(urls?: string[]) {
  error.value = ''
  if (!scoreWorkerUrl()) {
    error.value = 'Score Worker URL is not configured (VITE_SCORE_URL). Export still works.'
    return
  }
  const list =
    urls ?? flattenFeeds(workspace.value.outlines).map((f) => f.xmlUrl)
  if (list.length === 0) return
  scoring.value = true
  scoreDone.value = 0
  scoreTotal.value = list.length
  status.value = ''
  try {
    const results = await scoreUrls(list, (done, total) => {
      scoreDone.value = done
      scoreTotal.value = total
    })
    const next: Record<string, ScoreResult> = { ...scores.value }
    for (const r of results) {
      next[r.xmlUrl] = r
    }
    scores.value = next
    status.value = `Scored ${results.length} feed(s).`
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Score failed.'
    status.value = 'Score failed — you can still export.'
  } finally {
    scoring.value = false
    scoreDone.value = 0
    scoreTotal.value = 0
  }
}

function runScoreSelected() {
  void runScore([...selectedUrls.value])
}
</script>

<template>
  <section v-if="ready" class="space-y-6">
    <div class="space-y-1">
      <h1 class="text-xl font-semibold">Workspace</h1>
      <p class="text-sm text-slate-600">
        Import, optionally Score, prune, and export OPML for your reader. DiveRSS is not a feed reader.
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
      <button
        type="button"
        class="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
        @click="fileInput?.click()"
      >
        Import OPML
      </button>
      <button
        type="button"
        class="rounded-md border border-teal-700 bg-white px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-50"
        :disabled="!canScore || scoring"
        @click="runScore()"
      >
        {{ scoring ? 'Scoring…' : 'Score feeds' }}
      </button>
      <button
        type="button"
        class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
        @click="exportOpen = true"
      >
        Export OPML…
      </button>
      <span class="text-sm text-slate-500">{{ feedCount }} feed(s)</span>
      <p
        class="ml-auto min-h-5 min-w-0 flex-1 basis-40 text-right text-sm"
        :class="error ? 'text-red-700' : 'text-teal-800'"
        :role="error ? 'alert' : status && !scoring ? 'status' : undefined"
      >
        <span v-if="error">{{ error }}</span>
        <span v-else-if="status && !scoring">{{ status }}</span>
      </p>
    </div>

    <p v-if="!scoreWorkerUrl()" class="text-xs text-slate-500">
      Set <code class="rounded bg-slate-100 px-1">VITE_SCORE_URL</code> to enable Score (export works without it).
    </p>

    <div
      v-if="scoring"
      class="flex w-full items-center gap-3"
      role="status"
      aria-live="polite"
      :aria-valuenow="scoreDone"
      :aria-valuemin="0"
      :aria-valuemax="scoreTotal"
      aria-label="Scoring progress"
    >
      <div class="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200">
        <div
          class="relative h-full overflow-hidden rounded-full bg-teal-600 transition-[width] duration-300 ease-out"
          :style="{ width: `${scorePercent}%` }"
        >
          <div
            class="animate-score-shimmer pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/35 to-transparent"
            aria-hidden="true"
          />
        </div>
      </div>
      <span class="shrink-0 text-sm tabular-nums text-teal-800">
        {{ scoreDone }}/{{ scoreTotal }}
      </span>
    </div>

    <div v-if="workspace.outlines.length === 0" class="space-y-3 text-sm text-slate-500">
      <p>No feeds yet. Import an OPML file or add a feed / category.</p>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-md border border-teal-700 bg-white px-2.5 py-1 text-sm font-medium text-teal-800 hover:bg-teal-50"
          @click="addFeedOpen = true"
        >
          Add a feed…
        </button>
        <button
          type="button"
          class="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm font-medium text-slate-800 hover:bg-slate-50"
          @click="addCategoryOpen = true"
        >
          Add a category…
        </button>
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
            <span class="mr-1 text-xs font-medium text-slate-500">Categories</span>
            <button
              type="button"
              class="rounded bg-white px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
              @click="expandAll"
            >
              Expand all
            </button>
            <button
              type="button"
              class="rounded bg-white px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
              @click="collapseAll"
            >
              Collapse all
            </button>
          </div>
        </template>
        <template #actions>
          <button
            type="button"
            class="rounded-md border border-teal-700 bg-white px-2.5 py-1 text-sm font-medium text-teal-800 hover:bg-teal-50"
            @click="addFeedOpen = true"
          >
            Add a feed…
          </button>
          <button
            type="button"
            class="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm font-medium text-slate-800 hover:bg-slate-50"
            @click="addCategoryOpen = true"
          >
            Add a category…
          </button>
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
        class="text-sm text-slate-500"
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
        :scoring-suggestions="scoringSuggestions"
        :discovering-url="discoveringUrl"
        :rescoring-url="rescoringUrl"
        :reopen-fix-url="reopenFixUrl"
        :discover-error-by-url="discoverErrorByUrl"
        :can-discover="Boolean(scoreWorkerUrl())"
        :selected-urls="selectedUrls"
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
        :can-score="Boolean(scoreWorkerUrl()) && selectedCount > 0"
        :scoring="scoring"
        @score="runScoreSelected"
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
      :can-verify="Boolean(scoreWorkerUrl())"
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
  <p v-else class="text-sm text-slate-500">Loading workspace…</p>
</template>
