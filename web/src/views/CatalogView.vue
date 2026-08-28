<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from 'vue'
import { onBeforeRouteUpdate, useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import FeedAvatar from '@/components/FeedAvatar.vue'
import FilterChipGroup from '@/components/FilterChipGroup.vue'
import ListFilterPanel from '@/components/ListFilterPanel.vue'
import PruneFeedsModal, {
  type PruneCandidate,
} from '@/components/PruneFeedsModal.vue'
import ScoringStatusPill from '@/components/ScoringStatusPill.vue'
import CommunitySourcesModal, {
  type CommunityAddPayload,
} from '@/components/CommunitySourcesModal.vue'
import { listSectionOptions } from '@/opml/mutate'
import type { OpmlDocument } from '@/opml/types'
import { emptyOpmlDocument, flattenFeeds } from '@/opml/types'
import { normalizeFeedUrl, feedMembershipKeys } from '@/opml/url'
import {
  loadLocalCatalog,
  mergeIntoLocalCatalog,
  pruneCatalogFeeds,
  saveCatalogScores,
  type LocalCatalogFeed,
} from '@/db/catalog'
import { revertCommunityFeedsFromWorkspace } from '@/db/revertCommunityWorkspace'
import { loadWorkspace, saveWorkspace, workspaceEpoch } from '@/db/workspace'
import {
  proposeDestination,
  isUrlInWorkspace as outboxUrlInWorkspace,
  workspaceMembershipKeys,
} from '@/outbox/propose'
import { isStaged, stageEntry, toggleStage } from '@/outbox/store'
import { useOutbox } from '@/outbox/useOutbox'
import SelectionActionBar from '@/components/SelectionActionBar.vue'
import {
  scoreUrls,
  scoreWorkerUrl,
  type ScoreResult,
  type ScoreTimeframe,
} from '@/score/client'
import {
  healthPill,
  isFetchBlocked,
  lastPostAgeDays,
  lastPostAgeLabel,
  reasonLabel,
  rowWarningClass,
} from '@/score/presentation'
import { pingBandClass, pingFrequencyFor, radarIcon } from '@/score/pingFrequency'
import type { ListHealthFilter } from '@/lib/listFilter'
import type { CommunitySource } from '@/sources/types'

interface DirectoryFeed {
  title: string
  xmlUrl: string
  htmlUrl?: string
  category?: string
}

interface CatalogListFeed extends DirectoryFeed {
  origin: 'curated' | 'community'
  sourceTitle?: string
  /** OPML folder path from community packs. */
  groups?: string[]
}

interface DirectoryCategory {
  id: string
  label: string
  description?: string
}

interface DirectoryFile {
  schemaVersion: number
  feeds: DirectoryFeed[]
}

interface CategoriesFile {
  schemaVersion: number
  categories: DirectoryCategory[]
}

const curated = ref<DirectoryFeed[]>([])
const communityFeeds = ref<LocalCatalogFeed[]>([])
/** Normalized URLs hidden after Catalog prune (curated stay dismissed). */
const dismissedUrls = ref<Set<string>>(new Set())
const categories = ref<DirectoryCategory[]>([])
const communitySources = ref<CommunitySource[]>([])
const workspace = ref<OpmlDocument>(emptyOpmlDocument())
const query = ref('')
const categoryFilter = ref<string>('all')
/** all | missing | present — membership vs current workspace OPML */
const membershipFilter = ref<'all' | 'missing' | 'present'>('all')
/** all | ok | stale | unhealthy | blocked | unscored */
const healthFilter = ref<ListHealthFilter>('all')
const timeframe = ref<ScoreTimeframe>('7d')
const scores = ref<Record<string, ScoreResult>>({})
const scoring = ref(false)
const scoreDone = ref(0)
const scoreTotal = ref(0)
/** URLs in the active Score run — drives row loading pills on re-score. */
const scoringUrls = ref<Record<string, true>>({})
const error = ref('')
const status = ref('')
const ready = ref(false)
const communityOpen = ref(false)
const pruneOpen = ref(false)
const pruneSelected = ref<Record<string, boolean>>({})
/** Collapsed OPML group sections in the Catalog list. */
const collapsedGroups = ref<Record<string, boolean>>({})
/** Keep row "In Deck" state reactive when the nav drawer clears/imports. */
const { count: outboxCount } = useOutbox()
const selectedUrls = ref<string[]>([])
const selectionAnchor = ref<string | null>(null)
const selectedCount = computed(() => selectedUrls.value.length)
const selectedSet = computed(() => new Set(selectedUrls.value))

function feedInOutbox(xmlUrl: string): boolean {
  void outboxCount.value
  return isStaged(xmlUrl)
}

function isSelected(xmlUrl: string): boolean {
  return selectedSet.value.has(xmlUrl)
}

const scorePercent = computed(() =>
  scoreTotal.value === 0
    ? 0
    : Math.round((100 * scoreDone.value) / scoreTotal.value),
)

const categoryLabel = computed(() => {
  const map = new Map(categories.value.map((c) => [c.id, c.label]))
  return (id?: string) => (id ? map.get(id) ?? id : '')
})

function groupLabel(groups?: string[]): string {
  return groups?.length ? groups.join(' › ') : 'Ungrouped'
}

/** Curated baseline + local community ingest (Catalog list), minus pruned URLs. */
const catalogFeeds = computed((): CatalogListFeed[] => {
  const seen = new Map<string, number>()
  const out: CatalogListFeed[] = []
  const dismissed = dismissedUrls.value

  for (const f of curated.value) {
    const key = normalizeFeedUrl(f.xmlUrl)
    if (!key || seen.has(key) || dismissed.has(key)) continue
    seen.set(key, out.length)
    out.push({ ...f, origin: 'curated' })
  }

  for (const f of communityFeeds.value) {
    const key = normalizeFeedUrl(f.xmlUrl)
    if (!key || dismissed.has(key)) continue
    const idx = seen.get(key)
    if (idx !== undefined) {
      // Same feed URL (normalized) — keep curated xmlUrl for workspace match;
      // adopt OPML groups so the row sits in the community section.
      const row = out[idx]!
      out[idx] = {
        ...row,
        groups: row.groups?.length ? row.groups : f.groups ? [...f.groups] : undefined,
        sourceTitle: row.sourceTitle ?? f.sourceTitle,
        origin:
          f.groups?.length || f.sourceTitle ? 'community' : row.origin,
      }
      continue
    }
    seen.set(key, out.length)
    out.push({
      title: f.title,
      xmlUrl: f.xmlUrl,
      htmlUrl: f.htmlUrl,
      category: f.category,
      groups: f.groups,
      origin: 'community',
      sourceTitle: f.sourceTitle,
    })
  }
  return out
})

const canScore = computed(
  () => Boolean(scoreWorkerUrl()) && catalogFeeds.value.length > 0,
)

function scoreFor(xmlUrl: string): ScoreResult | undefined {
  return scores.value[xmlUrl] ?? scores.value[normalizeFeedUrl(xmlUrl)]
}

const existingCatalogUrls = computed(
  () => new Set(catalogFeeds.value.map((f) => normalizeFeedUrl(f.xmlUrl))),
)

const existingWorkspaceKeys = computed(() => {
  const keys = new Set<string>()
  for (const f of flattenFeeds(workspace.value.outlines)) {
    for (const k of feedMembershipKeys(f.xmlUrl)) keys.add(k)
  }
  return keys
})

/** Workspace section labels + individual folder names (casefold) for group match. */
const workspaceGroupKeys = computed(() => {
  const keys = new Set<string>()
  for (const s of listSectionOptions(workspace.value.outlines)) {
    const full = s.label.trim().toLowerCase()
    if (full) keys.add(full)
    for (const part of s.label.split(' › ')) {
      const p = part.trim().toLowerCase()
      if (p) keys.add(p)
    }
  }
  return keys
})

function isInWorkspace(xmlUrl: string): boolean {
  return feedMembershipKeys(xmlUrl).some((k) =>
    existingWorkspaceKeys.value.has(k),
  )
}

/** existing = matches a workspace section; new = community group not in OPML yet. */
function groupPresence(label: string): 'existing' | 'new' | 'none' {
  if (label === 'Ungrouped') return 'none'
  const full = label.trim().toLowerCase()
  if (workspaceGroupKeys.value.has(full)) return 'existing'
  const last = label.split(' › ').pop()?.trim().toLowerCase()
  if (last && workspaceGroupKeys.value.has(last)) return 'existing'
  return 'new'
}

const catalogMembership = computed(() => {
  const feeds = catalogFeeds.value
  let present = 0
  for (const f of feeds) {
    if (isInWorkspace(f.xmlUrl)) present += 1
  }
  return { total: feeds.length, present, missing: feeds.length - present }
})

const filtered = computed(() => {
  const feeds = catalogFeeds.value
  const q = query.value.trim().toLowerCase()
  const cat = categoryFilter.value
  const mem = membershipFilter.value
  const health = healthFilter.value
  return feeds.filter((f) => {
    if (cat !== 'all' && f.category !== cat) return false
    const inWs = isInWorkspace(f.xmlUrl)
    if (mem === 'missing' && inWs) return false
    if (mem === 'present' && !inWs) return false
    if (health !== 'all') {
      const s = scoreFor(f.xmlUrl)
      if (health === 'unscored') {
        if (s) return false
      } else if (!s || s.health !== health) {
        return false
      }
    }
    if (!q) return true
    const g = groupLabel(f.groups).toLowerCase()
    return (
      f.title.toLowerCase().includes(q) ||
      f.xmlUrl.toLowerCase().includes(q) ||
      (f.category ?? '').toLowerCase().includes(q) ||
      categoryLabel.value(f.category).toLowerCase().includes(q) ||
      (f.sourceTitle ?? '').toLowerCase().includes(q) ||
      g.includes(q)
    )
  })
})

const groupedFiltered = computed(() => {
  const map = new Map<string, CatalogListFeed[]>()
  for (const f of filtered.value) {
    const g = groupLabel(f.groups)
    const list = map.get(g) ?? []
    list.push(f)
    map.set(g, list)
  }
  return [...map.entries()].sort(([a], [b]) => {
    if (a === 'Ungrouped') return 1
    if (b === 'Ungrouped') return -1
    return a.localeCompare(b)
  })
})

/** Display order for Shift+click ranges (respects filters + expanded groups). */
const visibleFeedUrls = computed(() =>
  groupedFiltered.value.flatMap(([group, list]) =>
    collapsedGroups.value[group] ? [] : list.map((f) => f.xmlUrl),
  ),
)

const feedsByUrl = computed(() => {
  const map = new Map<string, CatalogListFeed>()
  for (const f of catalogFeeds.value) map.set(f.xmlUrl, f)
  return map
})

function toggleGroupCollapsed(label: string) {
  collapsedGroups.value = {
    ...collapsedGroups.value,
    [label]: !collapsedGroups.value[label],
  }
}

function dataUrl(name: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/')
  return `${base}data/${name}`
}

function reloadLocalCatalog() {
  const snap = loadLocalCatalog()
  communityFeeds.value = snap.feeds
  dismissedUrls.value = new Set(snap.dismissedUrls ?? [])
  if (snap.scores) scores.value = snap.scores
  if (snap.timeframe) timeframe.value = snap.timeframe
}

async function refreshWorkspace() {
  workspace.value = await loadWorkspace()
}

watch(timeframe, (tf) => {
  saveCatalogScores(scores.value, tf)
})

async function runScore(urls?: string[]) {
  error.value = ''
  if (!scoreWorkerUrl()) {
    error.value =
      'Score Worker URL is not configured (VITE_SCORE_URL). Catalog browsing still works.'
    return
  }
  const list = urls ?? catalogFeeds.value.map((f) => f.xmlUrl)
  if (list.length === 0) return
  scoring.value = true
  scoreDone.value = 0
  scoreTotal.value = list.length
  scoringUrls.value = Object.fromEntries(list.map((u) => [u, true as const]))
  status.value = `Scoring ${list.length} catalog feed(s)…`
  try {
    const results = await scoreUrls(list, (done, total) => {
      scoreDone.value = done
      scoreTotal.value = total
    })
    const next: Record<string, ScoreResult> = { ...scores.value }
    for (const r of results) {
      next[r.xmlUrl] = r
      next[normalizeFeedUrl(r.xmlUrl)] = r
    }
    scores.value = next
    saveCatalogScores(next, timeframe.value)
    status.value = `Scored ${results.length} catalog feed(s).`
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Score failed.'
  } finally {
    scoring.value = false
    scoreDone.value = 0
    scoreTotal.value = 0
    scoringUrls.value = {}
  }
}

onMounted(async () => {
  try {
    await refreshWorkspace()
    reloadLocalCatalog()
    const [dirRes, catRes, srcRes] = await Promise.all([
      fetch(dataUrl('directory.json')),
      fetch(dataUrl('categories.json')),
      fetch(dataUrl('sources.json')),
    ])
    if (!dirRes.ok) throw new Error(`directory HTTP ${dirRes.status}`)
    const dirBody = (await dirRes.json()) as DirectoryFile
    curated.value = dirBody.feeds ?? []
    if (catRes.ok) {
      const body = (await catRes.json()) as CategoriesFile
      categories.value = body.categories ?? []
    }
    if (srcRes.ok) {
      const body = (await srcRes.json()) as { sources?: CommunitySource[] }
      communitySources.value = body.sources ?? []
    }

    const revert = await revertCommunityFeedsFromWorkspace(
      curated.value.map((f) => f.xmlUrl),
    )
    if (!revert.skipped && revert.removed > 0) {
      await refreshWorkspace()
      reloadLocalCatalog()
      status.value = `Moved ${revert.removed} community feed(s) out of your workspace into Catalog (${revert.moved} new Catalog rows). Stage them in the Deck when you want them back.`
    }
  } catch (e) {
    error.value =
      e instanceof Error
        ? `Could not load catalog (${e.message}).`
        : 'Could not load catalog.'
  } finally {
    ready.value = true
  }
})

const route = useRoute()
watch(
  () => route.fullPath,
  () => {
    if (route.name === 'catalog' || route.path.endsWith('/catalog')) {
      void refreshWorkspace()
      reloadLocalCatalog()
    }
  },
)

onBeforeRouteUpdate((to) => {
  if (to.name === 'catalog' || to.path.endsWith('/catalog')) {
    void refreshWorkspace()
    reloadLocalCatalog()
  }
})

watch(communityOpen, (open, wasOpen) => {
  if (wasOpen && !open) {
    void refreshWorkspace()
    reloadLocalCatalog()
  }
})

onActivated(() => {
  void refreshWorkspace()
  reloadLocalCatalog()
})

watch(workspaceEpoch, () => {
  if (!ready.value) return
  void refreshWorkspace()
})

async function toggleOutbox(feed: CatalogListFeed) {
  error.value = ''
  const membership = workspaceMembershipKeys(workspace.value)
  const already = outboxUrlInWorkspace(feed.xmlUrl, membership)
  toggleStage({
    xmlUrl: feed.xmlUrl,
    title: feed.title,
    htmlUrl: feed.htmlUrl,
    groups: feed.groups ? [...feed.groups] : [],
    destination: proposeDestination(feed.groups ?? [], workspace.value),
    alreadyInWorkspace: already,
  })
  status.value = feedInOutbox(feed.xmlUrl)
    ? `Staged “${feed.title}” in Deck.`
    : `Removed “${feed.title}” from Deck.`
}

function stageFeed(feed: CatalogListFeed) {
  const membership = workspaceMembershipKeys(workspace.value)
  stageEntry({
    xmlUrl: feed.xmlUrl,
    title: feed.title,
    htmlUrl: feed.htmlUrl,
    groups: feed.groups ? [...feed.groups] : [],
    destination: proposeDestination(feed.groups ?? [], workspace.value),
    alreadyInWorkspace: outboxUrlInWorkspace(feed.xmlUrl, membership),
  })
}

function toggleSelect(xmlUrl: string, shiftKey = false, _modKey = false) {
  const order = visibleFeedUrls.value
  const selected = new Set(selectedUrls.value)

  if (shiftKey && selectionAnchor.value) {
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
      const lo = Math.min(from, to)
      const hi = Math.max(from, to)
      for (let i = lo; i <= hi; i++) selected.add(order[i]!)
      selectedUrls.value = [...selected]
      return
    }
  }

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

function isSelectModifier(ev: MouseEvent): boolean {
  return ev.shiftKey || ev.ctrlKey || ev.metaKey
}

function isSelectControlTarget(t: EventTarget | null): boolean {
  return Boolean(
    (t as HTMLElement | null)?.closest(
      'a, button, [role="menu"], [role="menuitem"], [role="checkbox"]',
    ),
  )
}

function onFeedRowPointerDown(_xmlUrl: string, ev: MouseEvent) {
  if (!isSelectModifier(ev) || isSelectControlTarget(ev.target)) return
  ev.preventDefault()
}

function onFeedRowClick(xmlUrl: string, ev: MouseEvent) {
  if (!isSelectModifier(ev) || isSelectControlTarget(ev.target)) return
  ev.preventDefault()
  window.getSelection()?.removeAllRanges()
  toggleSelect(xmlUrl, ev.shiftKey, ev.ctrlKey || ev.metaKey)
}

function onSelectToggle(xmlUrl: string, ev: MouseEvent) {
  ev.preventDefault()
  ev.stopPropagation()
  toggleSelect(xmlUrl, ev.shiftKey, ev.ctrlKey || ev.metaKey)
}

function runScoreSelected() {
  void runScore([...selectedUrls.value])
}

function stageSelectedToOutbox() {
  const urls = [...selectedUrls.value]
  let n = 0
  for (const url of urls) {
    const feed = feedsByUrl.value.get(url)
    if (!feed) continue
    stageFeed(feed)
    n++
  }
  clearSelection()
  status.value =
    n === 0
      ? 'Nothing to stage.'
      : `Staged ${n} feed${n === 1 ? '' : 's'} in Deck.`
}

function removeSelectedFromCatalog() {
  const urls = [...selectedUrls.value]
  const n = urls.length
  if (n === 0) return
  if (
    !window.confirm(
      n === 1
        ? 'Remove 1 selected feed from Catalog?'
        : `Remove ${n} selected feeds from Catalog?`,
    )
  ) {
    return
  }
  const { dismissed, removedCommunity, snapshot } = pruneCatalogFeeds(urls)
  communityFeeds.value = snapshot.feeds
  dismissedUrls.value = new Set(snapshot.dismissedUrls ?? [])
  if (snapshot.scores) scores.value = snapshot.scores
  clearSelection()
  const parts: string[] = []
  if (dismissed) parts.push(`${dismissed} hidden`)
  if (removedCommunity) parts.push(`${removedCommunity} community row(s) removed`)
  status.value =
    parts.length > 0
      ? `Removed from Catalog — ${parts.join(' · ')}.`
      : 'No Catalog changes.'
}

const pruneCandidates = computed((): PruneCandidate[] => {
  const byUrl = new Map(
    catalogFeeds.value.map((f) => [f.xmlUrl, f] as const),
  )
  const byKey = new Map<string, PruneCandidate>()
  for (const s of Object.values(scores.value)) {
    if (s.health !== 'stale' && s.health !== 'unhealthy') continue
    // Host blocked Score egress — not a dead feed; keep out of prune defaults.
    if (isFetchBlocked(s)) continue
    const feed =
      byUrl.get(s.xmlUrl) ??
      byUrl.get(normalizeFeedUrl(s.xmlUrl)) ??
      catalogFeeds.value.find(
        (f) => normalizeFeedUrl(f.xmlUrl) === normalizeFeedUrl(s.xmlUrl),
      )
    if (!feed) continue
    const key = normalizeFeedUrl(feed.xmlUrl) || feed.xmlUrl
    let item: PruneCandidate
    if (s.health === 'unhealthy') {
      item = {
        xmlUrl: feed.xmlUrl,
        text: feed.title,
        health: 'unhealthy',
        badge: isFetchBlocked(s) ? 'Blocked' : 'Unhealthy',
        detail: reasonLabel(s.reason, s.detail),
        ageDays: null,
      }
    } else {
      const ageDays = lastPostAgeDays(s.lastDatedAt)
      const age = lastPostAgeLabel(s.lastDatedAt)
      item = {
        xmlUrl: feed.xmlUrl,
        text: feed.title,
        health: 'stale',
        badge: age ? `Stale · ${age}` : 'Stale',
        lastDatedAt: s.lastDatedAt,
        ageDays,
      }
    }
    const prev = byKey.get(key)
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

function openPrune() {
  const sel: Record<string, boolean> = {}
  for (const c of pruneCandidates.value) {
    // Default to unhealthy — the common Catalog cleanup pass.
    sel[c.xmlUrl] = c.health === 'unhealthy'
  }
  pruneSelected.value = sel
  pruneOpen.value = true
}

function confirmPrune() {
  const urls = pruneCandidates.value
    .filter((c) => pruneSelected.value[c.xmlUrl])
    .map((c) => c.xmlUrl)
  if (urls.length === 0) {
    pruneOpen.value = false
    return
  }
  const { dismissed, removedCommunity, snapshot } = pruneCatalogFeeds(urls)
  communityFeeds.value = snapshot.feeds
  dismissedUrls.value = new Set(snapshot.dismissedUrls ?? [])
  if (snapshot.scores) scores.value = snapshot.scores
  pruneOpen.value = false
  pruneSelected.value = {}
  const parts: string[] = []
  if (dismissed) parts.push(`${dismissed} hidden from Catalog`)
  if (removedCommunity) parts.push(`${removedCommunity} community row(s) removed`)
  status.value =
    parts.length > 0
      ? `Pruned: ${parts.join(', ')}. Re-add from Community sources to restore.`
      : 'Nothing to prune.'
}

function onCommunityAdd(payload: CommunityAddPayload) {
  error.value = ''
  const { added, updated } = mergeIntoLocalCatalog(
    payload.feeds.map((f) => ({
      title: f.text,
      xmlUrl: f.xmlUrl,
      htmlUrl: f.htmlUrl,
      category: f.suggestedCategory,
      groups: f.groups,
      sourceId: f.sourceId,
      sourceTitle: f.sourceTitle,
    })),
    { overwrite: true },
  )
  reloadLocalCatalog()
  if (!payload.keepOpen) {
    communityOpen.value = false
  }
  const via = payload.feeds[0]?.sourceTitle
  const parts: string[] = []
  if (added) parts.push(`${added} added`)
  if (updated) parts.push(`${updated} updated`)
  status.value =
    parts.length === 0
      ? 'No Catalog changes.'
      : `${parts.join(', ')} from ${via ?? 'community source'}. Stage feeds in the Deck when ready to import.`
}

function alternatives(feed: CatalogListFeed): CatalogListFeed[] {
  if (!feed.category) return []
  return catalogFeeds.value
    .filter((f) => f.category === feed.category && f.xmlUrl !== feed.xmlUrl)
    .slice(0, 3)
}
</script>

<template>
  <section v-if="ready" class="space-y-6">
    <div class="space-y-1">
      <h1 class="text-xl font-semibold">Catalog</h1>
      <p class="text-sm text-gr-text-muted">
        Curated directory plus opt-in community collections. Stage feeds into
        the Deck, then import into your Garden.
      </p>
    </div>

    <div class="flex w-full flex-wrap items-center gap-3">
      <button
        type="button"
        class="rounded-md border border-gr-accent-strong bg-gr-surface px-3 py-2 text-sm font-medium text-gr-accent-strong hover:bg-gr-accent/10 disabled:opacity-50"
        :disabled="!canScore || scoring"
        @click="runScore()"
      >
        {{ scoring ? 'Scoring…' : 'Score catalog' }}
      </button>
      <button
        v-if="communitySources.length"
        type="button"
        class="rounded-md border border-gr-border bg-gr-surface px-3 py-2 text-sm font-medium text-gr-text hover:bg-gr-surface-2"
        @click="communityOpen = true"
      >
        Community sources…
      </button>
      <span class="text-sm text-gr-text-muted">{{ catalogFeeds.length }} feed(s)</span>
      <p
        class="ml-auto min-h-5 min-w-0 flex-1 basis-40 text-right text-sm"
        :class="error ? 'text-red-700' : 'text-gr-accent-strong'"
        :role="error ? 'alert' : status ? 'status' : undefined"
      >
        <span v-if="error">{{ error }}</span>
        <span v-else-if="status">{{ status }}</span>
      </p>
    </div>

    <p v-if="!scoreWorkerUrl()" class="text-xs text-gr-text-muted">
      Set <code class="rounded bg-gr-surface-2 px-1">VITE_SCORE_URL</code> to enable
      Score (catalog browsing still works).
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
      <div class="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-gr-border">
        <div
          class="relative h-full overflow-hidden rounded-full bg-gr-accent transition-[width] duration-300 ease-out"
          :style="{ width: `${scorePercent}%` }"
        >
          <div
            class="animate-score-shimmer pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/35 to-transparent"
            aria-hidden="true"
          />
        </div>
      </div>
      <span class="shrink-0 text-sm tabular-nums text-gr-accent-strong">
        {{ scoreDone }}/{{ scoreTotal }}
      </span>
    </div>

    <ListFilterPanel
      v-model:query="query"
      v-model:health="healthFilter"
      v-model:timeframe="timeframe"
      search-placeholder="Title, URL, or category"
      search-aria-label="Filter catalog"
      health-label="Health"
      compact-chips
      :showing-label="
        catalogFeeds.length
          ? `Showing ${filtered.length} of ${catalogFeeds.length}`
          : undefined
      "
    >
      <template #extra>
        <div v-if="categories.length" class="space-y-1">
          <FilterChipGroup
            v-model="categoryFilter"
            :options="[
              { id: 'all', label: 'All' },
              ...categories.map((c) => ({
                id: c.id,
                label: c.label,
                title: c.description,
              })),
            ]"
            label="Category"
            group-aria-label="Category"
            compact
          />
          <p class="text-xs text-gr-text-muted">
            Curated directory topics — hover a chip for its scope.
          </p>
        </div>
        <div
          v-if="catalogMembership.total"
          class="flex flex-wrap items-center gap-2"
        >
          <span class="text-xs text-gr-text-muted">
            {{ catalogMembership.total }} in Catalog ·
            {{ catalogMembership.present }} already in workspace ·
            {{ communityFeeds.length }} from community collections
          </span>
          <FilterChipGroup
            v-model="membershipFilter"
            :options="[
              { id: 'all', label: 'All' },
              {
                id: 'missing',
                label: `Not in workspace (${catalogMembership.missing})`,
              },
              {
                id: 'present',
                label: `In workspace (${catalogMembership.present})`,
              },
            ]"
            group-aria-label="Workspace membership"
            tone="slate"
            compact
          />
        </div>
      </template>
      <template #actions>
        <button
          v-if="problemCount > 0"
          type="button"
          class="inline-flex items-center gap-2 rounded-md border border-amber-600 bg-amber-50 px-2.5 py-1 text-sm font-medium text-amber-900 hover:bg-amber-100"
          @click="openPrune"
        >
          Prune unhealthy…
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

    <div v-if="filtered.length === 0" class="text-sm text-gr-text-muted">
      No catalog feeds match.
    </div>

    <div v-else class="space-y-3">
      <p
        v-if="groupedFiltered.some(([g]) => g !== 'Ungrouped')"
        class="text-xs text-gr-text-muted"
      >
        Groups from community collections —
        <span class="text-gr-text">In workspace</span> matches a category you
        already have;
        <span class="text-gr-accent-strong">New group</span> is not in your OPML yet.
      </p>
      <section
        v-for="[group, list] in groupedFiltered"
        :key="group"
        class="overflow-hidden rounded-lg border border-gr-border/80 bg-gr-surface-2/70 shadow-sm"
      >
        <div class="flex items-center gap-2 px-3 py-2.5">
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium text-gr-text hover:text-gr-text"
            :aria-expanded="!collapsedGroups[group]"
            @click="toggleGroupCollapsed(group)"
          >
            <span
              class="inline-flex h-5 w-5 shrink-0 items-center justify-center text-gr-text-muted transition-transform duration-150"
              :class="collapsedGroups[group] ? '' : 'rotate-90'"
              aria-hidden="true"
            >
              ▸
            </span>
            <span class="min-w-0 flex-1 truncate">{{ group }}</span>
            <span
              v-if="groupPresence(group) === 'existing'"
              class="shrink-0 rounded bg-gr-border/90 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-gr-text uppercase"
            >
              In workspace
            </span>
            <span
              v-else-if="groupPresence(group) === 'new'"
              class="shrink-0 rounded bg-gr-accent/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-gr-accent-strong uppercase"
            >
              New group
            </span>
            <span
              class="shrink-0 rounded-full bg-gr-surface/90 px-2 py-0.5 text-xs font-normal tabular-nums text-gr-text-muted ring-1 ring-gr-border/80"
            >
              {{ list.length }}
            </span>
          </button>
        </div>

        <ul
          v-show="!collapsedGroups[group]"
          class="divide-y divide-gr-border border-t border-gr-border/60 bg-gr-surface"
        >
          <li
            v-for="feed in list"
            :key="feed.xmlUrl"
            class="flex flex-col space-y-2 px-3 py-3 transition-colors"
            :class="[
              isSelected(feed.xmlUrl)
                ? 'bg-gr-accent/10 shadow-[inset_0_3px_0_0_var(--color-gr-accent-strong)]'
                : isInWorkspace(feed.xmlUrl)
                  ? 'bg-gr-surface-2/80'
                  : undefined,
              rowWarningClass(scoreFor(feed.xmlUrl)),
            ]"
            @mousedown="onFeedRowPointerDown(feed.xmlUrl, $event)"
            @click="onFeedRowClick(feed.xmlUrl, $event)"
          >
            <div
              class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div class="flex min-w-0 flex-1 items-center gap-3">
                <button
                  type="button"
                  role="checkbox"
                  class="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors"
                  :class="
                    isSelected(feed.xmlUrl)
                      ? 'border-gr-accent-strong bg-gr-accent-strong text-white'
                      : 'border-gr-border bg-gr-surface text-transparent hover:border-gr-accent-strong'
                  "
                  :aria-checked="isSelected(feed.xmlUrl)"
                  :aria-label="`Select ${feed.title}`"
                  @click="onSelectToggle(feed.xmlUrl, $event)"
                >
                  <Icon
                    icon="tabler:check"
                    class="h-3 w-3"
                    aria-hidden="true"
                  />
                </button>
                <FeedAvatar
                  :text="feed.title"
                  :xml-url="feed.xmlUrl"
                  :html-url="feed.htmlUrl"
                />
                <div class="min-w-0 flex-1 space-y-1">
                  <div class="flex min-w-0 flex-wrap items-center gap-2">
                    <p class="truncate text-sm font-medium text-gr-text">
                      {{ feed.title }}
                    </p>
                    <span
                      v-if="isInWorkspace(feed.xmlUrl)"
                      class="shrink-0 rounded bg-gr-border/90 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-gr-text uppercase"
                    >
                      In workspace
                    </span>
                  </div>
                  <p class="truncate text-xs text-gr-text-muted">{{ feed.xmlUrl }}</p>
                  <div class="flex flex-wrap items-center gap-1.5">
                    <ScoringStatusPill v-if="scoringUrls[feed.xmlUrl]" />
                    <template v-else>
                      <span
                        class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
                        :class="healthPill(scoreFor(feed.xmlUrl)).className"
                        :title="healthPill(scoreFor(feed.xmlUrl)).title"
                      >
                        {{ healthPill(scoreFor(feed.xmlUrl)).label }}
                      </span>
                      <span
                        v-if="pingFrequencyFor(scoreFor(feed.xmlUrl), timeframe)"
                        class="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums ring-1 ring-inset"
                        :class="
                          pingBandClass(
                            pingFrequencyFor(scoreFor(feed.xmlUrl), timeframe)!.band,
                          )
                        "
                        :title="
                          pingFrequencyFor(scoreFor(feed.xmlUrl), timeframe)!.tooltip
                        "
                      >
                        <Icon
                          :icon="
                            radarIcon(
                              pingFrequencyFor(scoreFor(feed.xmlUrl), timeframe)!
                                .band,
                            )
                          "
                          class="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                        {{
                          pingFrequencyFor(scoreFor(feed.xmlUrl), timeframe)!.score
                        }}
                      </span>
                    </template>
                  </div>
                  <p class="text-xs text-gr-text-muted">
                    <span v-if="feed.category">{{
                      categoryLabel(feed.category)
                    }}</span>
                    <span
                      v-if="feed.category && feed.origin === 'community'"
                    >
                      ·
                    </span>
                    <span v-if="feed.origin === 'community'">
                      Community{{
                        feed.sourceTitle ? ` · ${feed.sourceTitle}` : ''
                      }}
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                class="shrink-0 self-start rounded-md border px-3 py-1.5 text-sm sm:self-center"
                :class="
                  feedInOutbox(feed.xmlUrl)
                    ? 'border-gr-accent-strong bg-gr-accent/10 text-gr-accent-strong'
                    : 'border-gr-accent-strong text-gr-accent-strong hover:bg-gr-accent/10'
                "
                @click="toggleOutbox(feed)"
              >
                {{ feedInOutbox(feed.xmlUrl) ? 'In Deck' : 'Add to Deck' }}
              </button>
            </div>
            <p
              v-if="alternatives(feed).length"
              class="text-xs text-gr-text-muted"
            >
              Alternatives:
              {{ alternatives(feed).map((a) => a.title).join(' · ') }}
            </p>
          </li>
        </ul>
      </section>
    </div>

    <CommunitySourcesModal
      :open="communityOpen"
      :sources="communitySources"
      :existing-urls="existingCatalogUrls"
      @cancel="communityOpen = false"
      @confirm="onCommunityAdd"
    />
    <PruneFeedsModal
      :open="pruneOpen"
      :candidates="pruneCandidates"
      v-model:selected="pruneSelected"
      :show-remove-empty-sections="false"
      title="Prune Catalog feeds"
      description="Hide Stale and Unhealthy feeds from Catalog so they are harder to import. Community rows are removed; curated directory feeds stay dismissed until you re-add them from Community sources."
      initial-filter="unhealthy"
      @cancel="pruneOpen = false"
      @confirm="confirmPrune"
    />
    <SelectionActionBar
      variant="catalog"
      :count="selectedCount"
      :can-score="Boolean(scoreWorkerUrl()) && selectedCount > 0"
      :scoring="scoring"
      :score-done="scoreDone"
      :score-total="scoreTotal"
      @score="runScoreSelected"
      @outbox="stageSelectedToOutbox"
      @delete="removeSelectedFromCatalog"
      @clear="clearSelection"
    />
  </section>
  <p v-else class="text-sm text-gr-text-muted">Loading catalog…</p>
</template>
