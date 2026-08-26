<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { scoreUrls, scoreWorkerUrl, type ScoreResult } from '@/score/client'
import { reasonLabel } from '@/score/presentation'
import {
  dedupeSourceFeeds,
  entrypointRole,
  fetchAndParseSourceOpml,
  resolveEntrypointUrls,
} from '@/sources/load'
import type {
  CommunitySource,
  ParsedSourceFeed,
  SourceEntrypoint,
} from '@/sources/types'
import { normalizeFeedUrl } from '@/opml/url'

export interface CommunityAddPayload {
  feeds: {
    text: string
    xmlUrl: string
    htmlUrl?: string
    sourceId: string
    sourceTitle: string
    suggestedCategory?: string
    /** OPML folder path from the source pack. */
    groups?: string[]
  }[]
  /** When true, parent applies feeds but leaves the modal open (Advanced Add). */
  keepOpen?: boolean
}

type Pane = 'browse' | 'advanced'

interface PackRef {
  key: string
  sourceId: string
  sourceTitle: string
  sourceHomepage: string
  attribution: string
  label: string
  role: 'collection' | 'section'
  ep: SourceEntrypoint
}

const props = defineProps<{
  open: boolean
  sources: CommunitySource[]
  /** Feed URLs already in the Catalog (curated + local community). */
  existingUrls: Set<string> | string[]
}>()

const emit = defineEmits<{
  cancel: []
  confirm: [payload: CommunityAddPayload]
}>()

const pane = ref<Pane>('browse')
/** Source ids enabled for the browse pack list (default: all). */
const enabledSources = ref<Record<string, boolean>>({})
/** Pack keys enabled (default: all packs of enabled sources). */
const enabledPacks = ref<Record<string, boolean>>({})

const packKey = ref('')
const loading = ref(false)
const checking = ref(false)
const loadError = ref('')
const feeds = ref<ParsedSourceFeed[]>([])
const selected = ref<Record<string, boolean>>({})
const scores = ref<Record<string, ScoreResult>>({})
const filter = ref('')
/** OPML folder filter; '' = all sections. */
const groupFilter = ref('')
const collapsedGroups = ref<Record<string, boolean>>({})
/** After Advanced Add succeeds; null = not yet added this session. */
const advancedAddedCount = ref<number | null>(null)
const advancedAddStatus = ref('')

const existing = computed(() => {
  const raw =
    props.existingUrls instanceof Set
      ? [...props.existingUrls]
      : props.existingUrls
  return new Set(
    raw.map((u) => normalizeFeedUrl(u)).filter(Boolean),
  )
})

function isExisting(xmlUrl: string): boolean {
  return existing.value.has(normalizeFeedUrl(xmlUrl))
}

function packRefKey(sourceId: string, ep: SourceEntrypoint, index: number): string {
  return `${sourceId}::${ep.url ?? `merge-${index}`}`
}

function allPacksFromSources(sources: CommunitySource[]): PackRef[] {
  const out: PackRef[] = []
  for (const s of sources) {
    s.entrypoints.forEach((ep, index) => {
      out.push({
        key: packRefKey(s.id, ep, index),
        sourceId: s.id,
        sourceTitle: s.title,
        sourceHomepage: s.homepage,
        attribution: s.attribution,
        label: ep.label,
        role: entrypointRole(ep),
        ep,
      })
    })
  }
  return out
}

const allPacks = computed(() => allPacksFromSources(props.sources))

/** Browse list: collections always (when source enabled); sections only if enabled in Advanced. */
const browsePacks = computed(() =>
  allPacks.value.filter((p) => {
    if (!enabledSources.value[p.sourceId]) return false
    if (p.role === 'collection') return enabledPacks.value[p.key] !== false
    return enabledPacks.value[p.key] === true
  }),
)

/** Packs Advanced Add will fetch: checked sections, else collections of enabled sources. */
const advancedAddPacks = computed(() => {
  const sections = allPacks.value.filter(
    (p) =>
      p.role === 'section' &&
      enabledSources.value[p.sourceId] &&
      enabledPacks.value[p.key] === true,
  )
  if (sections.length > 0) return sections
  return allPacks.value.filter(
    (p) =>
      p.role === 'collection' &&
      enabledSources.value[p.sourceId] &&
      enabledPacks.value[p.key] !== false,
  )
})

const canAdvancedAdd = computed(
  () =>
    advancedAddPacks.value.length > 0 &&
    !loading.value &&
    advancedAddedCount.value === null,
)

function browseOptionLabel(p: PackRef): string {
  if (p.role === 'section') return `${p.label} — ${p.sourceTitle}`
  const raw = p.label.trim()
  const stripped = raw.replace(/^Entire collection\s*/i, '').trim()
  if (!stripped || stripped.toLowerCase() === p.sourceTitle.trim().toLowerCase()) {
    return p.sourceTitle
  }
  if (stripped.startsWith('(')) return `${p.sourceTitle} ${stripped}`
  return `${p.sourceTitle} — ${stripped}`
}

const activePack = computed(
  () => browsePacks.value.find((p) => p.key === packKey.value) ?? null,
)

const groupNames = computed(() => {
  const names = new Set<string>()
  for (const f of feeds.value) {
    names.add(groupLabel(f.groups))
  }
  return [...names].sort((a, b) => a.localeCompare(b))
})

function groupLabel(groups: string[]): string {
  return groups.length ? groups.join(' › ') : 'Ungrouped'
}

const visibleFeeds = computed(() => {
  const q = filter.value.trim().toLowerCase()
  return feeds.value.filter((f) => {
    const g = groupLabel(f.groups)
    if (groupFilter.value && g !== groupFilter.value) return false
    if (!q) return true
    return (
      f.text.toLowerCase().includes(q) ||
      f.xmlUrl.toLowerCase().includes(q) ||
      g.toLowerCase().includes(q)
    )
  })
})

const feedsByGroup = computed(() => {
  const map = new Map<string, ParsedSourceFeed[]>()
  for (const f of visibleFeeds.value) {
    const g = groupLabel(f.groups)
    const list = map.get(g) ?? []
    list.push(f)
    map.set(g, list)
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
})

const selectedCount = computed(
  () => feeds.value.filter((f) => selected.value[f.xmlUrl]).length,
)

const selectedNewCount = computed(
  () =>
    feeds.value.filter(
      (f) => selected.value[f.xmlUrl] && !isExisting(f.xmlUrl),
    ).length,
)

const selectedUpdateCount = computed(
  () =>
    feeds.value.filter(
      (f) => selected.value[f.xmlUrl] && isExisting(f.xmlUrl),
    ).length,
)

const canAdd = computed(
  () => selectedCount.value > 0 && !loading.value && !checking.value,
)

function initEnabledDefaults() {
  const src: Record<string, boolean> = {}
  const packs: Record<string, boolean> = {}
  for (const s of props.sources) {
    src[s.id] = true
    s.entrypoints.forEach((ep, index) => {
      const key = packRefKey(s.id, ep, index)
      // Collections on by default; category/section packs off until Advanced.
      packs[key] = entrypointRole(ep) === 'collection'
    })
  }
  enabledSources.value = src
  enabledPacks.value = packs
}

function resetPackState() {
  feeds.value = []
  selected.value = {}
  scores.value = {}
  loadError.value = ''
  filter.value = ''
  groupFilter.value = ''
  collapsedGroups.value = {}
}

function resetAll() {
  pane.value = 'browse'
  initEnabledDefaults()
  packKey.value = ''
  loading.value = false
  checking.value = false
  advancedAddedCount.value = null
  advancedAddStatus.value = ''
  resetPackState()
}

function onKeydown(ev: KeyboardEvent) {
  if (!props.open) return
  if (ev.key === 'Escape') {
    ev.preventDefault()
    if (pane.value === 'advanced') {
      pane.value = 'browse'
      return
    }
    emit('cancel')
  }
}

/** Block Catalog/Workspace under the overlay (incl. ghost-clicks after close). */
function setPageInert(on: boolean) {
  const app = document.getElementById('app')
  if (app) {
    if (on) app.setAttribute('inert', '')
    else app.removeAttribute('inert')
  }
  document.body.style.overflow = on ? 'hidden' : ''
}

function onBackdropPointerDown(ev: PointerEvent) {
  if (ev.target !== ev.currentTarget) return
  ev.preventDefault()
  ev.stopPropagation()
  window.setTimeout(() => emit('cancel'), 0)
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      resetAll()
      setPageInert(true)
      window.addEventListener('keydown', onKeydown)
    } else {
      setPageInert(false)
      window.removeEventListener('keydown', onKeydown)
    }
  },
)

watch(
  () => props.sources,
  () => {
    if (props.open) initEnabledDefaults()
  },
)

onUnmounted(() => {
  setPageInert(false)
  window.removeEventListener('keydown', onKeydown)
})

watch(packKey, (key) => {
  resetPackState()
  if (key && pane.value === 'browse') void loadPack()
})

function openAdvanced() {
  advancedAddedCount.value = null
  advancedAddStatus.value = ''
  loadError.value = ''
  pane.value = 'advanced'
}

function backToBrowse() {
  finishAdvanced()
}

function finishAdvanced() {
  // Drop current pack if it was disabled.
  if (packKey.value && !browsePacks.value.some((p) => p.key === packKey.value)) {
    packKey.value = ''
    resetPackState()
  }
  advancedAddedCount.value = null
  advancedAddStatus.value = ''
  pane.value = 'browse'
}

function setSourceEnabled(id: string, on: boolean) {
  enabledSources.value = { ...enabledSources.value, [id]: on }
  const next = { ...enabledPacks.value }
  props.sources
    .find((s) => s.id === id)
    ?.entrypoints.forEach((ep, index) => {
      const key = packRefKey(id, ep, index)
      if (!on) next[key] = false
      else if (entrypointRole(ep) === 'collection') next[key] = true
      // leave section packs as-is when re-enabling source
    })
  enabledPacks.value = next
}

function setPackEnabled(key: string, on: boolean) {
  enabledPacks.value = { ...enabledPacks.value, [key]: on }
}

/** Advanced list All/None: sections only; None also turns the source off. */
function setSourceSectionsEnabled(sourceId: string, on: boolean) {
  if (!on) {
    setSourceEnabled(sourceId, false)
    return
  }
  setSourceEnabled(sourceId, true)
  const next = { ...enabledPacks.value }
  props.sources
    .find((s) => s.id === sourceId)
    ?.entrypoints.forEach((ep, index) => {
      if (entrypointRole(ep) === 'section') {
        next[packRefKey(sourceId, ep, index)] = true
      }
    })
  enabledPacks.value = next
}

function setAllPacksEnabled(on: boolean) {
  if (!on) {
    const nextPacks = { ...enabledPacks.value }
    const nextSources = { ...enabledSources.value }
    for (const s of props.sources) {
      nextSources[s.id] = false
      s.entrypoints.forEach((ep, index) => {
        nextPacks[packRefKey(s.id, ep, index)] = false
      })
    }
    enabledPacks.value = nextPacks
    enabledSources.value = nextSources
    return
  }
  const nextPacks = { ...enabledPacks.value }
  const nextSources = { ...enabledSources.value }
  for (const s of props.sources) {
    nextSources[s.id] = true
    s.entrypoints.forEach((ep, index) => {
      nextPacks[packRefKey(s.id, ep, index)] = true
    })
  }
  enabledPacks.value = nextPacks
  enabledSources.value = nextSources
}

/** Section packs only — collections stay on the browse list via the source toggle. */
function sourceSectionPacks(
  s: CommunitySource,
): { ep: SourceEntrypoint; index: number }[] {
  return s.entrypoints
    .map((ep, index) => ({ ep, index }))
    .filter(({ ep }) => entrypointRole(ep) === 'section')
}

function selectAllVisible(on: boolean) {
  const next = { ...selected.value }
  for (const f of visibleFeeds.value) {
    next[f.xmlUrl] = on
  }
  selected.value = next
}

function selectGroup(group: string, on: boolean) {
  const next = { ...selected.value }
  for (const f of feeds.value) {
    if (groupLabel(f.groups) !== group) continue
    next[f.xmlUrl] = on
  }
  selected.value = next
}

function toggleGroupCollapsed(group: string) {
  collapsedGroups.value = {
    ...collapsedGroups.value,
    [group]: !collapsedGroups.value[group],
  }
}

async function loadPack() {
  loadError.value = ''
  const pack = activePack.value
  const source = props.sources.find((s) => s.id === pack?.sourceId)
  if (!pack || !source) {
    loadError.value = 'Choose a collection to load.'
    return
  }
  const urls = resolveEntrypointUrls(source, pack.ep)
  loading.value = true
  try {
    const parsed = dedupeSourceFeeds(
      await fetchAndParseSourceOpml({
        urls,
        sourceId: pack.sourceId,
        sourceTitle: pack.sourceTitle,
        entrypointLabel: pack.label,
      }),
    )
    feeds.value = parsed
    const sel: Record<string, boolean> = {}
    for (const f of parsed) {
      sel[f.xmlUrl] = !isExisting(f.xmlUrl)
    }
    selected.value = sel
    groupFilter.value = ''
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load OPML.'
  } finally {
    loading.value = false
  }
}

async function checkSelected() {
  if (!scoreWorkerUrl()) {
    loadError.value = 'Score Worker is not configured — you can still add feeds.'
    return
  }
  const urls = feeds.value
    .filter((f) => selected.value[f.xmlUrl])
    .map((f) => f.xmlUrl)
  if (urls.length === 0) return
  checking.value = true
  loadError.value = ''
  try {
    const results = await scoreUrls(urls)
    const next = { ...scores.value }
    for (const r of results) next[r.xmlUrl] = r
    scores.value = next
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Score failed.'
  } finally {
    checking.value = false
  }
}

function healthBadge(xmlUrl: string): string | null {
  const s = scores.value[xmlUrl]
  if (!s) return null
  if (s.health === 'ok') return 'Healthy'
  if (s.health === 'stale') return 'Stale'
  return 'Unhealthy'
}

function onConfirm() {
  if (!canAdd.value) return
  const picked = feeds.value.filter((f) => selected.value[f.xmlUrl])
  const cat = activePack.value?.ep.suggestedCategory
  emit('confirm', {
    feeds: picked.map((f) => ({
      text: f.text,
      xmlUrl: f.xmlUrl,
      htmlUrl: f.htmlUrl,
      sourceId: f.sourceId,
      sourceTitle: f.sourceTitle,
      suggestedCategory: cat,
      groups: f.groups.length ? [...f.groups] : undefined,
    })),
  })
}

async function onAdvancedAdd() {
  if (!canAdvancedAdd.value) return
  const packs = advancedAddPacks.value
  loading.value = true
  loadError.value = ''
  advancedAddStatus.value = ''
  try {
    const chunks = await Promise.all(
      packs.map(async (pack) => {
        const source = props.sources.find((s) => s.id === pack.sourceId)
        if (!source) {
          return { feeds: [] as ParsedSourceFeed[], category: undefined as string | undefined }
        }
        const feeds = await fetchAndParseSourceOpml({
          urls: resolveEntrypointUrls(source, pack.ep),
          sourceId: pack.sourceId,
          sourceTitle: pack.sourceTitle,
          entrypointLabel: pack.label,
        })
        return { feeds, category: pack.ep.suggestedCategory }
      }),
    )
    const flat = chunks.flatMap((c) =>
      c.feeds.map((f) => ({ feed: f, category: c.category })),
    )
    const parsed = dedupeSourceFeeds(flat.map((x) => x.feed))
    const catByUrl = new Map<string, string | undefined>()
    for (const { feed, category } of flat) {
      const key = normalizeFeedUrl(feed.xmlUrl)
      if (!catByUrl.has(key)) catByUrl.set(key, category)
    }
    emit('confirm', {
      feeds: parsed.map((f) => ({
        text: f.text,
        xmlUrl: f.xmlUrl,
        htmlUrl: f.htmlUrl,
        sourceId: f.sourceId,
        sourceTitle: f.sourceTitle,
        suggestedCategory: catByUrl.get(normalizeFeedUrl(f.xmlUrl)),
        groups: f.groups.length ? [...f.groups] : undefined,
      })),
      keepOpen: true,
    })
    advancedAddedCount.value = parsed.length
    const already = parsed.filter((f) => isExisting(f.xmlUrl)).length
    const fresh = parsed.length - already
    advancedAddStatus.value =
      parsed.length === 0
        ? 'No feeds in the selected collections.'
        : `Catalog sync: ${fresh} added, ${already} updated from ${packs.length} collection(s).`
  } catch (e) {
    loadError.value =
      e instanceof Error ? e.message : 'Failed to load selected collections.'
  } finally {
    loading.value = false
  }
}

function onAdvancedDone() {
  emit('cancel')
}

const enabledSourceCount = computed(
  () => Object.values(enabledSources.value).filter(Boolean).length,
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      role="presentation"
      @pointerdown="onBackdropPointerDown"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-sources-title"
        class="relative z-10 flex h-[min(52rem,94vh)] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
        @pointerdown.stop
      >
        <!-- Shared header: title + Advanced control/label -->
        <div class="shrink-0 border-b border-slate-100 px-5 py-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                <button
                  v-if="pane === 'advanced'"
                  type="button"
                  class="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                  @click="backToBrowse"
                >
                  <span aria-hidden="true">←</span> Back
                </button>
                <h2
                  id="community-sources-title"
                  class="text-base font-semibold text-slate-900"
                >
                  Community sources
                </h2>
              </div>
              <p class="mt-0.5 text-sm text-slate-600">
                <template v-if="pane === 'browse'">
                  Load a collection into your Catalog list — not your OPML
                  workspace. Stage them in the Outbox later from Catalog rows.
                </template>
                <template v-else>
                  Turn on category/section slices, then Add to put those feeds
                  into your Catalog. Workspace import stays a separate step.
                </template>
              </p>
            </div>
            <button
              v-if="pane === 'browse'"
              type="button"
              class="shrink-0 text-xs font-medium text-slate-600 hover:text-slate-900"
              @click="openAdvanced"
            >
              Advanced…
            </button>
            <p
              v-else
              id="community-advanced-title"
              class="shrink-0 text-xs font-semibold tracking-wide text-teal-800 uppercase"
            >
              Advanced
            </p>
          </div>
        </div>

        <!-- Browse pane (default) -->
        <template v-if="pane === 'browse'">
          <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <label class="block space-y-1">
              <span class="text-sm font-medium text-slate-700">Collection</span>
              <select
                v-model="packKey"
                class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                :disabled="loading"
              >
                <option value="">Choose a collection…</option>
                <option
                  v-for="p in browsePacks"
                  :key="p.key"
                  :value="p.key"
                >
                  {{ browseOptionLabel(p) }}
                </option>
              </select>
              <span class="text-xs text-slate-500">
                Showing {{ browsePacks.length }} collection(s) from
                {{ enabledSourceCount }} source(s). Enable category slices under
                Advanced…
              </span>
            </label>

            <p
              v-if="activePack"
              class="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600"
            >
              {{ activePack.attribution }}
              ·
              <a
                :href="activePack.sourceHomepage"
                class="text-teal-800 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
                >Upstream</a
              >
            </p>

            <p v-if="loadError" class="text-sm text-red-700" role="alert">
              {{ loadError }}
            </p>
            <p v-else-if="loading" class="text-sm text-slate-500">
              Loading collection…
            </p>

            <div v-if="feeds.length && !loading" class="space-y-3">
              <div class="flex flex-wrap items-center gap-2">
                <p class="text-sm font-medium text-slate-800">
                  {{ feeds.length }} feed(s)
                  <span
                    v-if="selectedCount > 0"
                    class="font-normal text-slate-500"
                  >
                    · {{ selectedNewCount }} new
                    <template v-if="selectedUpdateCount > 0">
                      · {{ selectedUpdateCount }} update</template
                    >
                  </span>
                </p>
                <button
                  type="button"
                  class="text-xs text-teal-800 hover:underline"
                  @click="selectAllVisible(true)"
                >
                  Select all
                </button>
                <button
                  type="button"
                  class="text-xs text-slate-600 hover:underline"
                  @click="selectAllVisible(false)"
                >
                  Clear
                </button>
                <button
                  type="button"
                  class="text-xs text-teal-800 hover:underline disabled:opacity-50"
                  :disabled="checking || selectedCount === 0"
                  @click="checkSelected"
                >
                  {{ checking ? 'Checking…' : 'Check selected' }}
                </button>
              </div>

              <p
                v-if="feeds.some((f) => isExisting(f.xmlUrl))"
                class="text-xs text-slate-500"
              >
                Feeds already in Catalog stay selectable — check them to
                overwrite title, groups, and attribution on Add.
              </p>

              <input
                v-model="filter"
                type="search"
                class="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                placeholder="Filter feeds…"
                autocomplete="off"
              />

              <div
                v-if="groupNames.length > 1"
                class="flex flex-wrap gap-1"
                role="group"
                aria-label="Sections in collection"
              >
                <button
                  type="button"
                  class="rounded px-2 py-0.5 text-xs font-medium"
                  :class="
                    groupFilter === ''
                      ? 'bg-teal-700 text-white'
                      : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
                  "
                  @click="groupFilter = ''"
                >
                  All sections
                </button>
                <button
                  v-for="g in groupNames"
                  :key="g"
                  type="button"
                  class="rounded px-2 py-0.5 text-xs font-medium"
                  :class="
                    groupFilter === g
                      ? 'bg-teal-700 text-white'
                      : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
                  "
                  @click="groupFilter = g"
                >
                  {{ g }}
                </button>
              </div>

              <div class="max-h-[min(28rem,50vh)] space-y-2 overflow-y-auto">
                <section
                  v-for="[group, list] in feedsByGroup"
                  :key="group"
                  class="overflow-hidden rounded-md border border-slate-200"
                >
                  <div
                    class="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-2 py-1.5"
                  >
                    <button
                      type="button"
                      class="min-w-0 flex-1 text-left text-xs font-medium text-slate-800"
                      @click="toggleGroupCollapsed(group)"
                    >
                      <span class="mr-1 text-slate-400" aria-hidden="true">{{
                        collapsedGroups[group] ? '▸' : '▾'
                      }}</span>
                      {{ group }}
                      <span class="font-normal text-slate-500"
                        >({{ list.length }})</span
                      >
                    </button>
                    <button
                      type="button"
                      class="text-xs text-teal-800 hover:underline"
                      @click="selectGroup(group, true)"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      class="text-xs text-slate-600 hover:underline"
                      @click="selectGroup(group, false)"
                    >
                      None
                    </button>
                  </div>
                  <ul v-if="!collapsedGroups[group]" class="divide-y divide-slate-100">
                    <li
                      v-for="f in list"
                      :key="f.xmlUrl"
                      class="flex items-start gap-2 px-2 py-1.5"
                      :class="
                        isExisting(f.xmlUrl) && !selected[f.xmlUrl]
                          ? 'opacity-60'
                          : undefined
                      "
                    >
                      <input
                        type="checkbox"
                        class="mt-1 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                        :checked="Boolean(selected[f.xmlUrl])"
                        @change="
                          selected = {
                            ...selected,
                            [f.xmlUrl]: ($event.target as HTMLInputElement).checked,
                          }
                        "
                      />
                      <span class="min-w-0 flex-1">
                        <span class="block truncate text-sm text-slate-900">{{
                          f.text
                        }}</span>
                        <span
                          class="block truncate text-xs text-slate-500"
                          :title="f.xmlUrl"
                          >{{ f.xmlUrl }}</span
                        >
                        <span
                          v-if="isExisting(f.xmlUrl) && selected[f.xmlUrl]"
                          class="text-xs text-amber-800"
                          >In Catalog — will update on Add</span
                        >
                        <span
                          v-else-if="isExisting(f.xmlUrl)"
                          class="text-xs text-slate-500"
                          >In Catalog</span
                        >
                        <span
                          v-else-if="healthBadge(f.xmlUrl)"
                          class="text-xs"
                          :class="
                            scores[f.xmlUrl]?.health === 'unhealthy'
                              ? 'text-red-700'
                              : scores[f.xmlUrl]?.health === 'stale'
                                ? 'text-amber-800'
                                : 'text-teal-800'
                          "
                          :title="
                            scores[f.xmlUrl]
                              ? reasonLabel(
                                  scores[f.xmlUrl]!.reason,
                                  scores[f.xmlUrl]!.detail,
                                )
                              : undefined
                          "
                        >
                          {{ healthBadge(f.xmlUrl) }}
                        </span>
                      </span>
                    </li>
                  </ul>
                </section>
              </div>
            </div>
          </div>

          <div class="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-3">
            <button
              type="button"
              class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
              @click="emit('cancel')"
            >
              Cancel
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
              :disabled="!canAdd"
              @click="onConfirm"
            >
              Add
              <span
                v-if="selectedCount > 0"
                class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-semibold tabular-nums text-teal-800"
                >{{ selectedCount }}</span
              >
            </button>
          </div>
        </template>

        <!-- Advanced: tailor collections; Back in header returns to browse -->
        <template v-else>
          <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <p
              v-if="loadError"
              class="text-sm text-red-700"
              role="alert"
            >
              {{ loadError }}
            </p>
            <p
              v-else-if="advancedAddStatus"
              class="text-sm text-teal-800"
              role="status"
            >
              {{ advancedAddStatus }}
            </p>
            <p v-else-if="loading" class="text-sm text-slate-500">
              Adding selected collections…
            </p>

            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                class="text-xs font-medium text-teal-800 hover:underline disabled:opacity-50"
                :disabled="loading || advancedAddedCount !== null"
                @click="setAllPacksEnabled(true)"
              >
                Select all
              </button>
              <button
                type="button"
                class="text-xs font-medium text-slate-600 hover:underline disabled:opacity-50"
                :disabled="loading || advancedAddedCount !== null"
                @click="setAllPacksEnabled(false)"
              >
                Select none
              </button>
              <span class="text-xs text-slate-500">
                {{ advancedAddPacks.length }} collection(s) ready to add
              </span>
            </div>

            <ul class="space-y-4">
              <li
                v-for="s in sources"
                :key="s.id"
                class="rounded-md border border-slate-200 px-3 py-2.5"
              >
                <div class="flex items-start justify-between gap-2">
                  <label class="flex min-w-0 cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      class="mt-1 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                      :checked="Boolean(enabledSources[s.id])"
                      :disabled="loading || advancedAddedCount !== null"
                      @change="
                        setSourceEnabled(
                          s.id,
                          ($event.target as HTMLInputElement).checked,
                        )
                      "
                    />
                    <span class="min-w-0">
                      <span class="block text-sm font-medium text-slate-900">{{
                        s.title
                      }}</span>
                      <span class="mt-0.5 block text-xs text-slate-500">{{
                        s.attribution
                      }}</span>
                      <a
                        :href="s.homepage"
                        class="mt-0.5 inline-block text-xs text-teal-800 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                        @click.stop
                      >
                        Upstream project
                      </a>
                    </span>
                  </label>
                  <div
                    v-if="enabledSources[s.id] && sourceSectionPacks(s).length > 1"
                    class="flex shrink-0 gap-2 pt-0.5"
                  >
                    <button
                      type="button"
                      class="text-xs text-teal-800 hover:underline disabled:opacity-50"
                      :disabled="loading || advancedAddedCount !== null"
                      @click="setSourceSectionsEnabled(s.id, true)"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      class="text-xs text-slate-600 hover:underline disabled:opacity-50"
                      :disabled="loading || advancedAddedCount !== null"
                      @click="setSourceSectionsEnabled(s.id, false)"
                    >
                      None
                    </button>
                  </div>
                </div>

                <ul
                  v-if="enabledSources[s.id] && sourceSectionPacks(s).length"
                  class="mt-3 space-y-1.5 border-t border-slate-100 pt-2 pl-7"
                >
                  <li
                    v-for="{ ep, index } in sourceSectionPacks(s)"
                    :key="packRefKey(s.id, ep, index)"
                    class="flex items-center gap-2"
                  >
                    <input
                      :id="packRefKey(s.id, ep, index)"
                      type="checkbox"
                      class="h-3.5 w-3.5 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                      :checked="Boolean(enabledPacks[packRefKey(s.id, ep, index)])"
                      :disabled="loading || advancedAddedCount !== null"
                      @change="
                        setPackEnabled(
                          packRefKey(s.id, ep, index),
                          ($event.target as HTMLInputElement).checked,
                        )
                      "
                    />
                    <label
                      :for="packRefKey(s.id, ep, index)"
                      class="text-xs text-slate-700"
                    >
                      {{ ep.label }}
                    </label>
                  </li>
                </ul>
              </li>
            </ul>
          </div>

          <div class="flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 px-5 py-3">
            <button
              type="button"
              class="text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50"
              :disabled="loading || advancedAddedCount !== null"
              @click="initEnabledDefaults"
            >
              Reset defaults
            </button>
            <div class="flex gap-2">
              <button
                type="button"
                class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                @click="emit('cancel')"
              >
                Cancel
              </button>
              <button
                v-if="advancedAddedCount !== null"
                type="button"
                class="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
                @click="onAdvancedDone"
              >
                Done
              </button>
              <button
                v-else
                type="button"
                class="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                :disabled="!canAdvancedAdd"
                @click="onAdvancedAdd"
              >
                {{ loading ? 'Adding…' : 'Add' }}
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>
