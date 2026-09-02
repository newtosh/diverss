<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import Button from '@/components/ui/Button.vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import DropdownMenuItem from '@/components/ui/DropdownMenuItem.vue'
import { applyPackToAdapter, normalizeFeedUrl } from '@/tools/filters/apply'
import { confirm } from '@/lib/confirm'
import { loadFilterPacks } from '@/tools/filters/load'
import {
  blankFilterPack,
  deleteLocalFilterPack,
  exportLocalFilterPacksJson,
  importLocalFilterPacksJson,
  loadLocalFilterPacks,
  newLocalPackId,
  saveLocalFilterPack,
} from '@/tools/filters/localStore'
import {
  candidateToFilterPack,
  groupIntoPackCandidates,
  inventoryFromFeeds,
  summarizeInventory,
  type PullPackCandidate,
} from '@/tools/filters/pullFromReader'
import { validateFilterPack } from '@/tools/filters/schema'
import type { FilterField, FilterPack, PackSource } from '@/tools/filters/types'
import type { ReaderAdapter, ReaderFeedSummary } from '@/tools/types'
import PatternTryPanel from '@/components/tools/PatternTryPanel.vue'

const FIELD_OPTIONS: { id: FilterField; label: string }[] = [
  { id: 'title', label: 'Title' },
  { id: 'body', label: 'Body' },
]

const TRY_SEEDS: Record<string, string[]> = {
  'iphone-seo': [
    'This iPhone camera trick will change how you shoot',
    'New iOS feature unlocks a hidden ability',
    'Android battery tip you need today',
  ],
  'streaming-clickbait': [
    'Free on streaming this weekend',
    'Officially streaming smash hit — essential viewing',
    "Chris Pratt's Must-See $300 Million Sci-Fi Thriller Is Officially Leaving Netflix Next Week",
    "'Avengers: Doomsday' Star's $150 Million Action Flop is Officially Getting a 2nd Chance on Streaming",
    'The Only Stephen King-Directed Movie Is Officially Free to Watch on YouTube',
    'Quiet indie film opens in limited theaters',
  ],
  'fortnite-chapter': [
    'Fortnite Chapter 6 Season 1 rundown',
    'Apex Legends ranked reset notes',
  ],
  'nostalgia-years-later': [
    '34 Years Later, Captain Picard’s Best Quote Is Still an All-Time Star Trek Classic',
    'This new sci-fi show just dropped its first trailer',
  ],
  'pinkbike-topic-prefix-noise': [
    'Video: Vali Höll’s World Champs Race Recap',
    'Photo Epic: Practice Days at the 2026 Val di Sole Downhill World Championships',
    'Results: Junior Qualifying at the 2026 Val di Sole DH World Championships',
    'Field Test: The New Trek Fuel EXe',
    'Randy Huntzinger Wins the 2026 Red Bull Rampage',
  ],
}

const SELECT_CLASS =
  'w-full appearance-none rounded-md border border-gr-border bg-gr-surface py-2 pl-3 pr-10 text-sm text-gr-text shadow-sm bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat disabled:bg-gr-surface-2 disabled:text-gr-text-muted'
const SELECT_CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")"

const props = defineProps<{
  adapter: ReaderAdapter | null
  busy: boolean
}>()

const emit = defineEmits<{
  status: [message: string]
  error: [message: string]
}>()

const shipped = ref<FilterPack[]>([])
const localPacks = ref<FilterPack[]>([])
const loadError = ref('')
const selectedKey = ref('')
const draft = ref<FilterPack | null>(null)
const draftSource = ref<PackSource>('shipped')
const feeds = ref<ReaderFeedSummary[]>([])
const copyFlash = ref('')
const contributeNudge = ref(false)
const editingFeeds = ref(false)
const applying = ref(false)
const pulling = ref(false)
const pullOpen = ref(false)
const pullCandidates = ref<PullPackCandidate[]>([])
const pullSelected = ref<string[]>([])
const pullSummary = ref({
  feedsWithRules: 0,
  blockLines: 0,
  keepLines: 0,
  importableCandidates: 0,
})
const fileInput = ref<HTMLInputElement | null>(null)

type ListedPack = { key: string; pack: FilterPack; source: PackSource }

const listed = computed((): ListedPack[] => {
  const locals = localPacks.value.map((p) => ({
    key: `local:${p.id}`,
    pack: p,
    source: 'local' as const,
  }))
  const ships = shipped.value.map((p) => ({
    key: `shipped:${p.id}`,
    pack: p,
    source: 'shipped' as const,
  }))
  return [...locals, ...ships]
})

const selectedEntry = computed(
  () => listed.value.find((e) => e.key === selectedKey.value) ?? null,
)

const isLocalDraft = computed(() => draftSource.value === 'local')

const associatedFeeds = computed(() => {
  if (!draft.value || draft.value.scope.global) return []
  const want = new Set(
    (draft.value.scope.feedUrls ?? []).map((u) => normalizeFeedUrl(u)),
  )
  if (!want.size) return []
  return feeds.value.filter((f) => want.has(normalizeFeedUrl(f.xmlUrl)))
})

const unmatchedUrls = computed(() => {
  if (!draft.value || draft.value.scope.global) return []
  const have = new Set(feeds.value.map((f) => normalizeFeedUrl(f.xmlUrl)))
  return (draft.value.scope.feedUrls ?? []).filter(
    (u) => !have.has(normalizeFeedUrl(u)),
  )
})

const modeHint = computed(() => {
  if (!draft.value) return ''
  return draft.value.mode === 'block'
    ? 'Block drops matching entries when Miniflux fetches the feed.'
    : 'Keep retains only matching entries (drops everything else).'
})

const trySeeds = computed(() => {
  if (!draft.value) return undefined
  return TRY_SEEDS[draft.value.id]
})

const canApplyApi = computed(() => !!props.adapter?.updateFeedFilters)

const canPull = computed(() => !!props.adapter)

const applyTargetCount = computed(() => {
  if (!draft.value) return 0
  if (draft.value.scope.global) return feeds.value.length
  return associatedFeeds.value.length
})

const importablePull = computed(() =>
  pullCandidates.value.filter((c) => c.importable),
)

function clonePack(p: FilterPack): FilterPack {
  return JSON.parse(JSON.stringify(p)) as FilterPack
}

function refreshLocals() {
  localPacks.value = loadLocalFilterPacks()
}

function loadDraftFromSelection() {
  const entry = selectedEntry.value
  if (!entry) {
    draft.value = null
    return
  }
  draft.value = clonePack(entry.pack)
  draftSource.value = entry.source
  copyFlash.value = ''
  contributeNudge.value = false
  editingFeeds.value = false
}

watch(selectedKey, () => loadDraftFromSelection())

onMounted(async () => {
  refreshLocals()
  try {
    shipped.value = await loadFilterPacks()
  } catch (e) {
    loadError.value =
      e instanceof Error ? e.message : 'Could not load filter packs.'
  }
  if (listed.value[0]) selectedKey.value = listed.value[0].key
})

watch(
  () => props.adapter,
  async (adapter) => {
    if (!adapter) {
      feeds.value = []
      pullCandidates.value = []
      pullSelected.value = []
      return
    }
    try {
      feeds.value = await adapter.listFeeds()
    } catch {
      feeds.value = []
    }
  },
  { immediate: true },
)

function toggleField(field: FilterField) {
  if (!draft.value || !isLocalDraft.value) return
  const set = new Set(draft.value.fields)
  if (set.has(field)) {
    if (set.size === 1) return
    set.delete(field)
  } else {
    set.add(field)
  }
  draft.value.fields = FIELD_OPTIONS.map((o) => o.id).filter((id) => set.has(id))
}

function setGlobal(global: boolean) {
  if (!draft.value || !isLocalDraft.value) return
  draft.value.scope = global
    ? { global: true }
    : { global: false, feedUrls: draft.value.scope.feedUrls ?? [] }
}

function toggleFeedAssociation(xmlUrl: string) {
  if (!draft.value || !isLocalDraft.value || draft.value.scope.global) return
  const urls = [...(draft.value.scope.feedUrls ?? [])]
  const i = urls.findIndex(
    (u) => u.trim().toLowerCase() === xmlUrl.trim().toLowerCase(),
  )
  if (i >= 0) urls.splice(i, 1)
  else urls.push(xmlUrl)
  draft.value.scope = { global: false, feedUrls: urls }
}

async function onApplyApi() {
  if (!draft.value || !props.adapter || !canApplyApi.value) return
  const pack = draft.value
  const n = applyTargetCount.value
  if (n === 0) {
    emit(
      'error',
      'No target feeds to apply. Associate feeds or choose All feeds.',
    )
    return
  }
  const modeLabel = pack.mode === 'keep' ? 'keeplist' : 'blocklist'
  const scopeLabel = pack.scope.global
    ? `all ${n} feed(s)`
    : `${n} associated feed(s)`
  const ok = await confirm(
    `Merge “${pack.name}” into Miniflux ${modeLabel} on ${scopeLabel}? Existing rules are kept; duplicates are skipped.`,
    { confirmLabel: 'Apply' },
  )
  if (!ok) return
  applying.value = true
  emit('error', '')
  try {
    const validated = validateFilterPack(pack)
    const result = await applyPackToAdapter(validated, props.adapter)
    if (result.errors.length && result.feedsTouched === 0) {
      emit('error', result.errors.join(' '))
      return
    }
    const parts = [
      `Applied “${validated.name}” (${result.mode}): ${result.feedsTouched} feed(s), ${result.linesAdded} line(s)`,
    ]
    if (result.feedsSkipped) parts.push(`${result.feedsSkipped} URL(s) unmatched`)
    if (result.errors.length) parts.push(`warnings: ${result.errors[0]}`)
    emit('status', parts.join(' — '))
    feeds.value = await props.adapter.listFeeds()
  } catch (e) {
    emit('error', e instanceof Error ? e.message : 'Apply failed.')
  } finally {
    applying.value = false
  }
}

async function onPullFromReader() {
  if (!props.adapter) return
  pulling.value = true
  emit('error', '')
  pullOpen.value = true
  try {
    feeds.value = await props.adapter.listFeeds()
    const rows = inventoryFromFeeds(feeds.value)
    pullSummary.value = summarizeInventory(rows)
    pullCandidates.value = groupIntoPackCandidates(rows)
    pullSelected.value = pullCandidates.value
      .filter((c) => c.importable)
      .map((c) => c.key)
    emit(
      'status',
      `Pulled rules: ${pullSummary.value.blockLines} block, ${pullSummary.value.keepLines} keep across ${pullSummary.value.feedsWithRules} feed(s).`,
    )
  } catch (e) {
    emit('error', e instanceof Error ? e.message : 'Pull failed.')
  } finally {
    pulling.value = false
  }
}

function togglePullCandidate(key: string) {
  const set = new Set(pullSelected.value)
  if (set.has(key)) set.delete(key)
  else set.add(key)
  pullSelected.value = [...set]
}

function onImportPulled() {
  const chosen = pullCandidates.value.filter(
    (c) => c.importable && pullSelected.value.includes(c.key),
  )
  if (!chosen.length) {
    emit('error', 'Select at least one importable rule to save as a local pack.')
    return
  }
  let imported = 0
  let lastKey = ''
  for (const c of chosen) {
    try {
      const pack = candidateToFilterPack(c, {
        totalFeedCount: feeds.value.length,
      })
      localPacks.value = saveLocalFilterPack(pack)
      lastKey = `local:${pack.id}`
      imported++
    } catch (e) {
      emit('error', e instanceof Error ? e.message : 'Import failed.')
      return
    }
  }
  contributeNudge.value = true
  if (lastKey) selectedKey.value = lastKey
  emit(
    'status',
    `Imported ${imported} local pack(s) from Miniflux. Review, then Save/PR if you want them permanent.`,
  )
}

function onCreate() {
  const id = newLocalPackId()
  const pack = blankFilterPack(id)
  localPacks.value = saveLocalFilterPack(pack)
  selectedKey.value = `local:${id}`
  contributeNudge.value = true
  editingFeeds.value = true
  emit(
    'status',
    `Created “${pack.name}”. Save when ready — consider a PR later.`,
  )
}

function onSave() {
  if (!draft.value || !isLocalDraft.value) return
  emit('error', '')
  try {
    if (!draft.value.pattern.trim()) {
      throw new Error('Pattern is required before saving.')
    }
    const pack = validateFilterPack(draft.value)
    localPacks.value = saveLocalFilterPack(pack)
    draft.value = clonePack(pack)
    selectedKey.value = `local:${pack.id}`
    contributeNudge.value = true
    emit('status', `Saved “${pack.name}” in this browser.`)
  } catch (e) {
    emit('error', e instanceof Error ? e.message : 'Save failed.')
  }
}

async function onDeleteLocal() {
  if (!draft.value || !isLocalDraft.value) return
  const ok = await confirm(`Delete local pack “${draft.value.name}”?`, {
    danger: true,
    confirmLabel: 'Delete',
  })
  if (!ok) return
  const id = draft.value.id
  localPacks.value = deleteLocalFilterPack(id)
  contributeNudge.value = false
  selectedKey.value = listed.value[0]?.key ?? ''
  emit('status', 'Local pack deleted.')
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
  copyFlash.value = label
  emit('status', `Copied ${label}.`)
}

function onCopyPattern() {
  if (!draft.value) return
  void copyText(draft.value.pattern.trim(), 'pattern')
}

function onCopyJson() {
  if (!draft.value) return
  void copyText(`${JSON.stringify(draft.value, null, 2)}\n`, 'filter JSON')
}

function onBackup() {
  const blob = new Blob([exportLocalFilterPacksJson()], {
    type: 'application/json',
  })
  const a = document.createElement('a')
  const url = URL.createObjectURL(blob)
  a.href = url
  a.download = 'gardenrss-filter-packs.json'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  emit('status', 'Downloaded local filter packs backup.')
}

function onRestoreClick() {
  fileInput.value?.click()
}

async function onRestoreFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const text = await file.text()
    const { imported } = importLocalFilterPacksJson(text)
    refreshLocals()
    if (listed.value[0]) selectedKey.value = listed.value[0].key
    emit('status', `Restored ${imported} local pack(s).`)
  } catch (e) {
    emit('error', e instanceof Error ? e.message : 'Restore failed.')
  }
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <p class="text-xs text-gr-text-muted">
        Miniflux-native packs: <span class="font-medium">block</span> or
        <span class="font-medium">keep</span>. Apply merges onto feeds; Pull
        inventories existing rules and can import them as local packs.
      </p>
      <a
        class="shrink-0 text-xs text-gr-accent-strong underline"
        href="https://github.com/newtosh/gardenrss/blob/HEAD/web/public/data/filter-packs/README.md"
        target="_blank"
        rel="noopener noreferrer"
        >Contribute packs</a
      >
    </div>

    <p v-if="loadError" class="text-sm text-gr-danger-strong" role="alert">{{ loadError }}</p>

    <div class="flex flex-wrap items-end gap-2">
      <label class="min-w-0 flex-1 space-y-1 text-sm">
        <span class="text-gr-text-muted">Pack</span>
        <select
          v-model="selectedKey"
          class="tools-select"
          :style="{ backgroundImage: SELECT_CHEVRON }"
          :class="SELECT_CLASS"
        >
          <option v-for="e in listed" :key="e.key" :value="e.key">
            {{ e.source === 'local' ? 'Local · ' : '' }}{{ e.pack.name }}
          </option>
        </select>
      </label>
      <Button variant="primary" :disabled="busy" @click="onCreate">Create</Button>
      <Button
        variant="secondary"
        :disabled="busy || !canPull"
        :loading="pulling"
        @click="onPullFromReader"
      >
        Pull from Miniflux
      </Button>
    </div>

    <!-- Pull inventory -->
    <div
      v-if="pullOpen"
      class="space-y-2 rounded-md border border-gr-border bg-gr-surface-2/60 p-3"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm font-medium text-gr-text">Pulled rules</p>
        <button
          type="button"
          class="text-xs text-gr-text-muted underline"
          @click="pullOpen = false"
        >
          Hide
        </button>
      </div>
      <p class="text-xs text-gr-text-muted">
        {{ pullSummary.blockLines }} block · {{ pullSummary.keepLines }} keep ·
        {{ pullSummary.feedsWithRules }} feed(s) ·
        {{ pullSummary.importableCandidates }} importable as packs
      </p>
      <p class="text-[11px] text-gr-text-muted">
        Best-effort: EntryTitle/EntryContent lines only. Import creates
        <span class="font-medium">local</span> packs — does not change the
        server.
      </p>

      <div
        v-if="pullCandidates.length"
        class="max-h-52 space-y-1 overflow-y-auto rounded-md border border-gr-border bg-gr-surface p-2"
      >
        <label
          v-for="c in pullCandidates"
          :key="c.key"
          class="flex items-start gap-2 rounded px-1 py-1 text-xs"
          :class="c.importable ? 'text-gr-text' : 'text-gr-text-muted'"
        >
          <input
            type="checkbox"
            class="mt-0.5"
            :disabled="!c.importable"
            :checked="pullSelected.includes(c.key)"
            @change="togglePullCandidate(c.key)"
          />
          <span class="min-w-0 flex-1">
            <span class="font-medium capitalize">{{ c.mode }}</span>
            <span class="text-gr-text-muted"> · {{ c.fieldKey }} · </span>
            <span class="font-mono break-all">{{ c.body }}</span>
            <span class="mt-0.5 block text-[10px] text-gr-text-muted">
              {{ c.feedIds.length }} feed(s):
              {{ c.feedTitles.slice(0, 3).join(', ')
              }}{{ c.feedTitles.length > 3 ? '…' : '' }}
              <span v-if="!c.importable"> · not importable yet</span>
            </span>
          </span>
        </label>
      </div>
      <p v-else class="text-xs text-gr-text-muted">
        No block/keep rules found on this reader.
      </p>

      <Button
        variant="secondary"
        size="sm"
        :disabled="busy || pulling || !importablePull.length || !pullSelected.length"
        @click="onImportPulled"
      >
        Import selected as local packs
      </Button>
    </div>

    <template v-if="draft">
      <p
        v-if="contributeNudge"
        class="rounded-md border border-gr-accent/30 bg-gr-accent/10 px-3 py-2 text-xs text-gr-accent-strong"
      >
        Pack saved locally.
        <a
          class="font-medium underline"
          href="https://github.com/newtosh/gardenrss/blob/HEAD/web/public/data/filter-packs/README.md"
          target="_blank"
          rel="noopener noreferrer"
          >Contribute it upstream</a
        >
        so others can use it.
      </p>

      <section class="space-y-3 rounded-lg border border-gr-border bg-gr-surface-2/50 p-3">
        <h3 class="text-xs font-semibold tracking-wide text-gr-text-muted uppercase">
          Pack
        </h3>
        <label class="block space-y-1 text-sm">
          <span class="text-gr-text-muted">Name</span>
          <input
            v-model="draft.name"
            class="w-full rounded-md border border-gr-border bg-gr-surface px-3 py-2 disabled:bg-gr-surface-2"
            :disabled="!isLocalDraft"
          />
        </label>

        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block space-y-1 text-sm">
            <span class="text-gr-text-muted">Mode</span>
            <select
              v-model="draft.mode"
              class="tools-select"
              :style="{ backgroundImage: SELECT_CHEVRON }"
              :class="SELECT_CLASS"
              :disabled="!isLocalDraft"
            >
              <option value="block">Block</option>
              <option value="keep">Keep</option>
            </select>
            <span class="block text-xs text-gr-text-muted">{{ modeHint }}</span>
          </label>
          <label class="block space-y-1 text-sm">
            <span class="text-gr-text-muted">Pattern kind</span>
            <select
              v-model="draft.patternKind"
              class="tools-select"
              :style="{ backgroundImage: SELECT_CHEVRON }"
              :class="SELECT_CLASS"
              :disabled="!isLocalDraft"
            >
              <option value="keyword">Keyword</option>
              <option value="regex">Regex</option>
            </select>
          </label>
        </div>

        <fieldset class="space-y-1.5" :disabled="!isLocalDraft">
          <legend class="text-sm text-gr-text-muted">Fields</legend>
          <div class="flex flex-wrap gap-3">
            <label
              v-for="opt in FIELD_OPTIONS"
              :key="opt.id"
              class="inline-flex items-center gap-1.5 text-sm text-gr-text"
            >
              <input
                type="checkbox"
                class="rounded border-gr-border"
                :checked="draft.fields.includes(opt.id)"
                :disabled="!isLocalDraft"
                @change="toggleField(opt.id)"
              />
              {{ opt.label }}
            </label>
          </div>
        </fieldset>
      </section>

      <section class="space-y-3 rounded-lg border border-gr-border bg-gr-surface-2/50 p-3">
        <h3 class="text-xs font-semibold tracking-wide text-gr-text-muted uppercase">
          Match pattern
        </h3>
        <label class="block space-y-1 text-sm">
          <span class="text-gr-text-muted">Pattern</span>
          <textarea
            v-model="draft.pattern"
            rows="3"
            class="w-full rounded-md border border-gr-border bg-gr-surface px-3 py-2 font-mono text-xs disabled:bg-gr-surface-2"
            :disabled="!isLocalDraft"
          />
        </label>

        <PatternTryPanel
          :pattern="draft.pattern"
          :pattern-kind="draft.patternKind"
          :seed-samples="trySeeds"
        />
      </section>

      <section class="space-y-3 rounded-lg border border-gr-border bg-gr-surface-2/50 p-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-xs font-semibold tracking-wide text-gr-text-muted uppercase">
            Applies to
          </h3>
          <div class="flex gap-1.5 rounded-md bg-gr-surface p-0.5">
            <button
              type="button"
              class="rounded px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60"
              :disabled="!isLocalDraft"
              :class="
                draft.scope.global
                  ? 'bg-gr-accent-strong text-gr-on-accent'
                  : 'text-gr-text-muted hover:text-gr-text'
              "
              @click="setGlobal(true)"
            >
              All feeds
            </button>
            <button
              type="button"
              class="rounded px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60"
              :disabled="!isLocalDraft"
              :class="
                !draft.scope.global
                  ? 'bg-gr-accent-strong text-gr-on-accent'
                  : 'text-gr-text-muted hover:text-gr-text'
              "
              @click="setGlobal(false)"
            >
              Specific feeds
            </button>
          </div>
        </div>

        <div
          v-if="draft.scope.global"
          class="rounded-md border border-gr-border bg-gr-surface px-3 py-2 text-xs text-gr-text-muted"
        >
          Associated with <span class="font-medium text-gr-text">all feeds</span>
          on the reader.
        </div>
        <div v-else class="space-y-2 rounded-md border border-gr-border bg-gr-surface p-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-xs font-medium text-gr-text-muted">
              Associated feeds
              <span class="font-normal text-gr-text-muted"
                >({{ (draft.scope.feedUrls ?? []).length }})</span
              >
            </p>
            <button
              v-if="isLocalDraft && feeds.length"
              type="button"
              class="text-xs font-medium text-gr-accent-strong underline"
              @click="editingFeeds = !editingFeeds"
            >
              {{ editingFeeds ? 'Done' : 'Edit associations' }}
            </button>
          </div>

          <ul v-if="associatedFeeds.length" class="space-y-1">
            <li
              v-for="f in associatedFeeds"
              :key="f.id"
              class="flex items-start gap-2 rounded-md bg-gr-accent/15 px-2 py-1.5 text-xs text-gr-accent-strong"
            >
              <span
                class="mt-0.5 rounded bg-gr-accent-strong px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase"
                >Selected</span
              >
              <span class="min-w-0">
                <span class="font-medium">{{ f.title }}</span>
                <span class="block truncate text-gr-accent-strong/70">{{ f.xmlUrl }}</span>
              </span>
            </li>
          </ul>
          <p
            v-else-if="!(draft.scope.feedUrls ?? []).length"
            class="text-xs text-gr-text-muted"
          >
            No feeds associated yet.
            <span v-if="isLocalDraft"
              >Use Edit associations when a reader is connected.</span
            >
          </p>

          <ul v-if="unmatchedUrls.length" class="space-y-1">
            <li
              v-for="u in unmatchedUrls"
              :key="u"
              class="truncate rounded-md bg-gr-surface-2 px-2 py-1 text-xs text-gr-text-muted"
              :title="u"
            >
              Pack URL not on this reader: {{ u }}
            </li>
          </ul>

          <div
            v-if="editingFeeds && isLocalDraft && feeds.length"
            class="max-h-40 space-y-1 overflow-y-auto border-t border-gr-border pt-2"
          >
            <label
              v-for="f in feeds"
              :key="f.id"
              class="flex items-start gap-2 text-xs text-gr-text"
            >
              <input
                type="checkbox"
                class="mt-0.5"
                :checked="
                  (draft.scope.feedUrls ?? []).some(
                    (u) =>
                      u.trim().toLowerCase() === f.xmlUrl.trim().toLowerCase(),
                  )
                "
                @change="toggleFeedAssociation(f.xmlUrl)"
              />
              <span class="min-w-0">
                <span class="font-medium">{{ f.title }}</span>
                <span class="block truncate text-gr-text-muted">{{ f.xmlUrl }}</span>
              </span>
            </label>
          </div>
        </div>
      </section>

      <div class="flex flex-wrap items-center gap-2 border-t border-gr-border pt-3">
        <Button
          v-if="canApplyApi"
          variant="primary"
          size="sm"
          :disabled="busy || applyTargetCount === 0"
          :loading="applying"
          @click="onApplyApi"
        >
          Apply {{ draft.mode }} to Miniflux
        </Button>
        <Button
          v-if="isLocalDraft"
          variant="secondary"
          size="sm"
          :disabled="busy || applying"
          @click="onSave"
        >
          Save
        </Button>
        <DropdownMenu>
          <template #trigger>
            <Button variant="secondary" size="sm" :disabled="busy || applying">
              More
              <Icon icon="tabler:chevron-down" class="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </template>
          <DropdownMenuItem @select="onCopyPattern">
            <Icon icon="tabler:copy" class="h-4 w-4 text-gr-text-muted" aria-hidden="true" />
            {{ copyFlash === 'pattern' ? 'Copied pattern' : 'Copy pattern' }}
          </DropdownMenuItem>
          <DropdownMenuItem @select="onCopyJson">
            <Icon icon="tabler:braces" class="h-4 w-4 text-gr-text-muted" aria-hidden="true" />
            {{ copyFlash === 'filter JSON' ? 'Copied JSON' : 'Copy JSON' }}
          </DropdownMenuItem>
          <DropdownMenuItem @select="onBackup">
            <Icon icon="tabler:download" class="h-4 w-4 text-gr-text-muted" aria-hidden="true" />
            Backup locals
          </DropdownMenuItem>
          <DropdownMenuItem @select="onRestoreClick">
            <Icon icon="tabler:upload" class="h-4 w-4 text-gr-text-muted" aria-hidden="true" />
            Restore…
          </DropdownMenuItem>
          <template v-if="isLocalDraft">
            <div class="my-1 border-t border-gr-border" role="separator" />
            <DropdownMenuItem variant="danger" @select="onDeleteLocal">
              <Icon icon="tabler:trash" class="h-4 w-4" aria-hidden="true" />
              Delete local
            </DropdownMenuItem>
          </template>
        </DropdownMenu>
        <input
          ref="fileInput"
          type="file"
          accept="application/json,.json"
          class="hidden"
          @change="onRestoreFile"
        />
      </div>
      <p v-if="!canApplyApi" class="text-xs text-gr-text-muted">
        Connect Miniflux (or turn mock on) to apply block/keep rules via API.
      </p>
      <p v-else-if="applyTargetCount === 0" class="text-xs text-gr-gold">
        No target feeds yet — associate feeds or switch to All feeds before Apply.
      </p>
    </template>
  </div>
</template>
