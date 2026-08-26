<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import type { HealthStatus } from '@/score/client'
import {
  matchesStaleAgeDays,
  type StaleAgeFilter,
} from '@/score/presentation'

export type PruneFilter = 'all' | 'unhealthy' | 'stale'

export interface PruneCandidate {
  xmlUrl: string
  text: string
  health: Extract<HealthStatus, 'stale' | 'unhealthy'>
  badge: string
  detail?: string
  /** ISO last dated post (optional metadata). */
  lastDatedAt?: string
  /**
   * Whole days since last dated post. Required for Stale age chips;
   * null = unknown age (only visible under “Any age”).
   */
  ageDays?: number | null
}

const props = withDefaults(
  defineProps<{
    open: boolean
    candidates: PruneCandidate[]
    /** xmlUrl → selected */
    selected: Record<string, boolean>
    removeEmptySections?: boolean
    title?: string
    description?: string
    showRemoveEmptySections?: boolean
    initialFilter?: PruneFilter
  }>(),
  {
    removeEmptySections: false,
    title: 'Prune feeds',
    description: 'Choose Stale and Unhealthy feeds to remove from this OPML.',
    showRemoveEmptySections: true,
    initialFilter: 'all',
  },
)

const emit = defineEmits<{
  'update:selected': [value: Record<string, boolean>]
  'update:removeEmptySections': [value: boolean]
  cancel: []
  confirm: []
}>()

const statusFilter = ref<PruneFilter>(props.initialFilter)
const staleAge = ref<StaleAgeFilter>('all')

const filterOptions: { id: PruneFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unhealthy', label: 'Unhealthy' },
  { id: 'stale', label: 'Stale' },
]

const staleAgeOptions: { id: StaleAgeFilter; label: string }[] = [
  { id: 'all', label: 'Any age' },
  { id: '3m', label: '3 months+' },
  { id: '6m', label: '6 months+' },
  { id: '1y', label: '> 1 year' },
]

const visibleCandidates = computed(() => {
  const status = statusFilter.value
  const age = staleAge.value
  return props.candidates.filter((c) => {
    if (status === 'unhealthy') return c.health === 'unhealthy'
    if (status === 'stale') {
      if (c.health !== 'stale') return false
      return matchesStaleAgeDays(c.ageDays, age)
    }
    return true
  })
})

const selectedCount = computed(
  () => props.candidates.filter((c) => props.selected[c.xmlUrl]).length,
)

const visibleSelectedCount = computed(
  () => visibleCandidates.value.filter((c) => props.selected[c.xmlUrl]).length,
)

const canConfirm = computed(
  () =>
    selectedCount.value > 0 ||
    (props.showRemoveEmptySections && props.removeEmptySections),
)

function setChecked(xmlUrl: string, checked: boolean) {
  emit('update:selected', { ...props.selected, [xmlUrl]: checked })
}

function selectAll(checked: boolean) {
  const next: Record<string, boolean> = { ...props.selected }
  for (const c of visibleCandidates.value) next[c.xmlUrl] = checked
  emit('update:selected', next)
}

function selectMatchingVisible() {
  const status = statusFilter.value
  const age = staleAge.value
  const sel: Record<string, boolean> = { ...props.selected }
  for (const c of props.candidates) {
    let visible = true
    if (status === 'unhealthy') visible = c.health === 'unhealthy'
    else if (status === 'stale') {
      visible = c.health === 'stale' && matchesStaleAgeDays(c.ageDays, age)
    }
    sel[c.xmlUrl] = visible
  }
  emit('update:selected', sel)
}

function applyFilter(next: PruneFilter) {
  statusFilter.value = next
  if (next !== 'stale') staleAge.value = 'all'
  selectMatchingVisible()
}

function applyStaleAge(next: StaleAgeFilter) {
  staleAge.value = next
  selectMatchingVisible()
}

function onKeydown(ev: KeyboardEvent) {
  if (!props.open) return
  if (ev.key === 'Escape') {
    ev.preventDefault()
    emit('cancel')
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      statusFilter.value = props.initialFilter
      staleAge.value = 'all'
      if (props.initialFilter !== 'all') {
        applyFilter(props.initialFilter)
      }
      window.addEventListener('keydown', onKeydown)
    } else {
      window.removeEventListener('keydown', onKeydown)
    }
  },
)

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      role="presentation"
      @click.self="emit('cancel')"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="prune-feeds-title"
        class="flex max-h-[min(36rem,90vh)] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
      >
        <div class="border-b border-slate-100 px-4 py-3">
          <h2 id="prune-feeds-title" class="text-base font-semibold text-slate-900">
            {{ title }}
          </h2>
          <p class="mt-0.5 text-sm text-slate-600">
            {{ description }}
          </p>
          <div
            class="mt-3 flex flex-wrap items-center gap-1"
            role="group"
            aria-label="Filter by status"
          >
            <button
              v-for="opt in filterOptions"
              :key="opt.id"
              type="button"
              class="rounded px-2.5 py-1 text-xs font-medium"
              :class="
                statusFilter === opt.id
                  ? 'bg-teal-700 text-white'
                  : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
              "
              :aria-pressed="statusFilter === opt.id"
              @click="applyFilter(opt.id)"
            >
              {{ opt.label }}
            </button>
          </div>
          <div
            v-if="statusFilter === 'stale'"
            class="mt-2 flex flex-wrap items-center gap-1"
            role="group"
            aria-label="Filter stale by age"
          >
            <span class="mr-1 text-xs font-medium text-slate-500">Last post</span>
            <button
              v-for="opt in staleAgeOptions"
              :key="`age-${opt.id}`"
              type="button"
              class="rounded px-2.5 py-1 text-xs font-medium"
              :class="
                staleAge === opt.id
                  ? 'bg-amber-700 text-white'
                  : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
              "
              :aria-pressed="staleAge === opt.id"
              @click="applyStaleAge(opt.id)"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <div class="flex items-center gap-3 border-b border-slate-100 px-4 py-2 text-xs">
          <button
            type="button"
            class="font-medium text-teal-800 hover:text-teal-950"
            @click="selectAll(true)"
          >
            Select all
          </button>
          <button
            type="button"
            class="font-medium text-slate-600 hover:text-slate-900"
            @click="selectAll(false)"
          >
            Select none
          </button>
          <span class="ml-auto tabular-nums text-slate-500">
            {{ visibleSelectedCount }} of {{ visibleCandidates.length }} selected
          </span>
        </div>

        <ul class="min-h-0 flex-1 overflow-y-auto divide-y divide-slate-100">
          <li
            v-if="visibleCandidates.length === 0"
            class="px-4 py-8 text-center text-sm text-slate-500"
          >
            {{
              statusFilter === 'all'
                ? 'No problem feeds in this list.'
                : statusFilter === 'unhealthy'
                  ? 'No Unhealthy feeds in this list.'
                  : staleAge === 'all'
                    ? 'No Stale feeds in this list.'
                    : 'No Stale feeds match this age filter.'
            }}
          </li>
          <li
            v-for="(c, idx) in visibleCandidates"
            :key="`${c.xmlUrl}::${idx}`"
            class="flex items-start gap-3 px-4 py-3"
          >
            <input
              :id="`prune-${idx}-${c.xmlUrl}`"
              type="checkbox"
              class="mt-1 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
              :checked="Boolean(selected[c.xmlUrl])"
              @change="
                setChecked(c.xmlUrl, ($event.target as HTMLInputElement).checked)
              "
            />
            <label
              :for="`prune-${idx}-${c.xmlUrl}`"
              class="min-w-0 flex-1 cursor-pointer"
            >
              <span class="block truncate text-sm font-medium text-slate-900">{{
                c.text
              }}</span>
              <span class="mt-0.5 block truncate text-xs text-slate-500">{{
                c.xmlUrl
              }}</span>
              <span class="mt-1.5 flex flex-wrap items-center gap-2">
                <span
                  class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
                  :class="
                    c.health === 'unhealthy'
                      ? 'bg-red-50 text-red-800 ring-red-200'
                      : 'bg-amber-50 text-amber-900 ring-amber-200'
                  "
                >
                  {{ c.badge }}
                </span>
                <span v-if="c.detail" class="text-xs text-slate-500">{{ c.detail }}</span>
              </span>
            </label>
          </li>
        </ul>

        <label
          v-if="showRemoveEmptySections"
          class="flex cursor-pointer items-start gap-3 border-t border-slate-100 px-4 py-3"
        >
          <input
            type="checkbox"
            class="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
            :checked="removeEmptySections"
            @change="
              emit(
                'update:removeEmptySections',
                ($event.target as HTMLInputElement).checked,
              )
            "
          />
          <span class="min-w-0">
            <span class="block text-sm font-medium text-slate-900">
              Also remove empty categories
            </span>
            <span class="mt-0.5 block text-xs text-slate-500">
              Drop folders that have no feeds left after this prune.
            </span>
          </span>
        </label>

        <div class="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            @click="emit('cancel')"
          >
            Cancel
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
            :disabled="!canConfirm"
            @click="emit('confirm')"
          >
            <template v-if="selectedCount > 0">
              Remove
              <span
                class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-semibold tabular-nums text-red-800"
                aria-hidden="true"
              >
                {{ selectedCount }}
              </span>
              <span class="sr-only">{{ selectedCount }}</span>
            </template>
            <template v-else>Remove empty categories</template>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
