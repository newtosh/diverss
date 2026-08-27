<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useRouter } from 'vue-router'
import { listSectionOptions } from '@/opml/mutate'
import type { OpmlDocument } from '@/opml/types'
import { importOutbox } from '@/outbox/import'
import {
  categoryPresence,
  destinationDisplayLabel,
  destinationGroupKey,
  workspaceMembershipKeys,
  isUrlInWorkspace,
} from '@/outbox/propose'
import {
  clearOutbox,
  remapGroup,
  removeEntry,
  removeEntriesByIds,
  updateEntry,
} from '@/outbox/store'
import type { OutboxDestination, OutboxEntry } from '@/outbox/types'
import { useOutbox } from '@/outbox/useOutbox'

const props = withDefaults(
  defineProps<{
    document: OpmlDocument
    variant?: 'drawer' | 'page'
  }>(),
  { variant: 'drawer' },
)

const emit = defineEmits<{
  imported: [
    summary: {
      document: OpmlDocument
      added: number
      skippedAlreadyPresent: number
      createdCategories: string[]
    },
  ]
  expand: []
  close: []
}>()

const router = useRouter()
const { entries, importableCount } = useOutbox()

const sectionOptions = computed(() =>
  listSectionOptions(props.document.outlines),
)

/** Refresh alreadyInWorkspace flags when the workspace document changes. */
watch(
  () => props.document,
  (doc) => {
    const keys = workspaceMembershipKeys(doc)
    for (const e of entries.value) {
      const next = isUrlInWorkspace(e.xmlUrl, keys)
      if (next !== e.alreadyInWorkspace) {
        updateEntry(e.id, { alreadyInWorkspace: next })
      }
    }
  },
  { immediate: true },
)

interface OutboxGroup {
  key: string
  destination: OutboxDestination
  presence: 'existing' | 'new' | 'ungrouped'
  label: string
  entries: OutboxEntry[]
}

const groups = computed((): OutboxGroup[] => {
  const map = new Map<string, OutboxGroup>()
  for (const e of entries.value) {
    const key = destinationGroupKey(e.destination)
    const existing = map.get(key)
    if (existing) {
      existing.entries.push(e)
      continue
    }
    map.set(key, {
      key,
      destination: e.destination,
      presence: categoryPresence(e.destination),
      label: destinationDisplayLabel(e.destination),
      entries: [e],
    })
  }
  return [...map.values()].sort((a, b) => {
    if (a.presence === 'ungrouped') return 1
    if (b.presence === 'ungrouped') return -1
    return a.label.localeCompare(b.label)
  })
})

const remapDraft = ref<Record<string, string>>({})

watch(
  groups,
  (gs) => {
    const next: Record<string, string> = { ...remapDraft.value }
    for (const g of gs) {
      if (next[g.key] !== undefined) continue
      if (g.destination.kind === 'ungrouped') next[g.key] = 'ungrouped'
      else if (g.destination.kind === 'existing') {
        next[g.key] = `path:${g.destination.path.join('.')}`
      } else next[g.key] = 'new'
    }
    remapDraft.value = next
  },
  { immediate: true },
)

const newLabelDraft = ref<Record<string, string>>({})

watch(
  groups,
  (gs) => {
    const next = { ...newLabelDraft.value }
    for (const g of gs) {
      if (next[g.key] !== undefined) continue
      next[g.key] =
        g.destination.kind === 'new' ? g.destination.label : g.label === 'Ungrouped' ? '' : g.label
    }
    newLabelDraft.value = next
  },
  { immediate: true },
)

function applyRemap(groupKey: string) {
  const mode = remapDraft.value[groupKey] ?? 'ungrouped'
  let destination: OutboxDestination
  if (mode === 'ungrouped') {
    destination = { kind: 'ungrouped' }
  } else if (mode === 'new') {
    const label = (newLabelDraft.value[groupKey] ?? '').trim() || 'New category'
    destination = { kind: 'new', label }
  } else if (mode.startsWith('path:')) {
    const pathKey = mode.slice(5)
    const opt = sectionOptions.value.find((s) => s.path.join('.') === pathKey)
    if (!opt) return
    destination = { kind: 'existing', path: opt.path, label: opt.label }
  } else {
    return
  }
  remapGroup(groupKey, destination, destinationGroupKey)
}

function onRemapSelect(groupKey: string, value: string) {
  remapDraft.value = { ...remapDraft.value, [groupKey]: value }
  if (value !== 'new') applyRemap(groupKey)
}

function onNewLabelBlur(groupKey: string) {
  if (remapDraft.value[groupKey] === 'new') applyRemap(groupKey)
}

const importing = ref(false)

async function runImport() {
  if (importableCount.value === 0 || importing.value) return
  importing.value = true
  try {
    const result = importOutbox(props.document, entries.value)
    removeEntriesByIds(result.addedIds)
    emit('imported', {
      document: result.document,
      added: result.added,
      skippedAlreadyPresent: result.skippedAlreadyPresent,
      createdCategories: result.createdCategories,
    })
  } finally {
    importing.value = false
  }
}

function onClear() {
  clearOutbox()
  emit('close')
}

function onClose() {
  emit('close')
}

function onExpand() {
  emit('expand')
  void router.push({ name: 'outbox' })
}
</script>

<template>
  <div
    class="flex min-h-0 flex-col"
    :class="variant === 'page' ? 'gap-4' : 'h-full'"
  >
    <div
      class="flex flex-wrap items-start justify-between gap-2 border-b border-gr-border px-4 py-3"
    >
      <div class="min-w-0">
        <h2
          id="outbox-panel-title"
          class="text-base font-semibold text-gr-text"
        >
          Deck
        </h2>
        <p class="mt-0.5 text-sm text-gr-text-muted">
          Review categories, then import into your Garden.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-if="variant === 'drawer'"
          type="button"
          class="rounded-md border border-gr-border bg-gr-surface px-2.5 py-1.5 text-xs font-medium text-gr-text hover:bg-gr-surface-2"
          @click="onExpand"
        >
          Expand
        </button>
        <button
          type="button"
          class="rounded-md border border-gr-border bg-gr-surface px-2.5 py-1.5 text-xs font-medium text-gr-text hover:bg-gr-surface-2 disabled:opacity-50"
          :disabled="entries.length === 0"
          @click="onClear"
        >
          Clear
        </button>
        <button
          v-if="variant === 'drawer'"
          type="button"
          class="inline-flex items-center justify-center rounded-md border border-gr-border bg-gr-surface p-1.5 text-gr-text-muted hover:bg-gr-surface-2 hover:text-gr-text"
          aria-label="Close Deck"
          @click="onClose"
        >
          <Icon icon="tabler:x" class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>

    <div
      class="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3"
      :class="variant === 'page' ? '' : ''"
    >
      <p v-if="entries.length === 0" class="text-sm text-gr-text-muted">
        Nothing staged yet. From Catalog, use
        <span class="font-medium text-gr-text">Add to Deck</span>
        on feeds you want to import.
      </p>

      <div
        v-for="g in groups"
        :key="g.key"
        class="overflow-hidden rounded-lg border border-gr-border bg-gr-surface"
        :class="
          g.presence === 'ungrouped'
            ? 'border-amber-300/80 bg-amber-50/40 ring-1 ring-amber-200/60'
            : undefined
        "
      >
        <div class="space-y-2 border-b border-gr-border px-3 py-2.5">
          <div class="flex flex-wrap items-center gap-2">
            <p class="min-w-0 flex-1 text-sm font-medium text-gr-text">
              {{ g.label }}
            </p>
            <span
              v-if="g.presence === 'existing'"
              class="shrink-0 rounded bg-gr-border/90 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-gr-text uppercase"
            >
              Matches Garden
            </span>
            <span
              v-else-if="g.presence === 'new'"
              class="shrink-0 rounded bg-gr-accent/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-gr-accent-strong uppercase"
            >
              New category
            </span>
            <span
              v-else
              class="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-950 uppercase"
            >
              Needs category
            </span>
            <span
              class="shrink-0 rounded-full bg-gr-surface-2 px-2 py-0.5 text-xs tabular-nums text-gr-text-muted"
            >
              {{ g.entries.length }}
            </span>
          </div>

          <div class="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label class="block min-w-0 flex-1 space-y-1">
              <span class="text-xs font-medium text-gr-text-muted">Import into</span>
              <select
                class="w-full rounded-md border border-gr-border bg-gr-surface px-2 py-1.5 text-sm"
                :value="remapDraft[g.key]"
                @change="
                  onRemapSelect(
                    g.key,
                    ($event.target as HTMLSelectElement).value,
                  )
                "
              >
                <option value="ungrouped">Ungrouped (top level)</option>
                <option
                  v-for="s in sectionOptions"
                  :key="s.path.join('.')"
                  :value="`path:${s.path.join('.')}`"
                >
                  {{ s.label }}
                </option>
                <option value="new">New category…</option>
              </select>
            </label>
            <label
              v-if="remapDraft[g.key] === 'new'"
              class="block min-w-0 flex-1 space-y-1"
            >
              <span class="text-xs font-medium text-gr-text-muted"
                >Category name</span
              >
              <input
                type="text"
                class="w-full rounded-md border border-gr-border px-2 py-1.5 text-sm"
                :value="newLabelDraft[g.key]"
                @input="
                  newLabelDraft = {
                    ...newLabelDraft,
                    [g.key]: ($event.target as HTMLInputElement).value,
                  }
                "
                @blur="onNewLabelBlur(g.key)"
                @keydown.enter.prevent="onNewLabelBlur(g.key)"
              />
            </label>
          </div>
        </div>

        <ul class="divide-y divide-gr-border">
          <li
            v-for="e in g.entries"
            :key="e.id"
            class="flex items-start justify-between gap-2 px-3 py-2"
          >
            <div class="min-w-0">
              <p class="truncate text-sm text-gr-text">{{ e.title }}</p>
              <p class="truncate text-xs text-gr-text-muted">{{ e.xmlUrl }}</p>
              <p
                v-if="e.alreadyInWorkspace"
                class="mt-0.5 text-xs font-medium text-amber-900"
              >
                Already in Garden — skipped on import
              </p>
            </div>
            <button
              type="button"
              class="shrink-0 text-xs text-gr-text-muted hover:text-red-700"
              @click="removeEntry(e.id)"
            >
              Remove
            </button>
          </li>
        </ul>
      </div>
    </div>

    <div
      class="flex flex-wrap items-center justify-between gap-2 border-t border-gr-border px-4 py-3"
    >
      <p class="text-xs text-gr-text-muted">
        <template v-if="entries.length === 0">Empty</template>
        <template v-else>
          {{ importableCount }} to add
          <template v-if="entries.length - importableCount > 0">
            · {{ entries.length - importableCount }} already present
          </template>
        </template>
      </p>
      <button
        type="button"
        class="rounded-md border border-gr-accent-strong bg-gr-accent-strong px-3 py-2 text-sm font-medium text-white hover:brightness-90 disabled:opacity-50"
        :disabled="importableCount === 0 || importing"
        @click="runImport"
      >
        {{ importing ? 'Importing…' : 'Import to Garden' }}
      </button>
    </div>
  </div>
</template>
