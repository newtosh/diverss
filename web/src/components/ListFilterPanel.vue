<script setup lang="ts">
import { Icon } from '@iconify/vue'
import FilterChipGroup from '@/components/FilterChipGroup.vue'
import {
  LIST_HEALTH_OPTIONS,
  PING_TIMEFRAMES,
  type ListHealthFilter,
} from '@/lib/listFilter'
import type { ScanTimeframe } from '@/scan/client'

const query = defineModel<string>('query', { required: true })
const health = defineModel<ListHealthFilter>('health', { required: true })
const timeframe = defineModel<ScanTimeframe>('timeframe', { required: true })

withDefaults(
  defineProps<{
    searchPlaceholder?: string
    searchAriaLabel?: string
    /** e.g. "Showing 12 of 40" — omit when unused */
    showingLabel?: string
    showPing?: boolean
    healthLabel?: string
  }>(),
  {
    searchPlaceholder: 'Filter by title or URL…',
    searchAriaLabel: 'Filter feeds',
    showPing: true,
  },
)

const pingOptions = PING_TIMEFRAMES.map((id) => ({ id, label: id }))
</script>

<template>
  <section
    class="list-filter-panel rounded-xl border border-gr-border bg-gr-surface shadow-[var(--shadow-gr-raised)]"
    aria-label="List filters"
  >
    <div class="space-y-3 p-3.5 lg:space-y-4 lg:p-4">
      <label class="relative block min-w-0 w-full">
        <span class="sr-only">{{ searchAriaLabel }}</span>
        <Icon
          icon="tabler:search"
          class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gr-text-muted lg:h-[18px] lg:w-[18px]"
          aria-hidden="true"
        />
        <input
          v-model="query"
          type="search"
          class="h-9 w-full rounded-md border border-gr-border bg-gr-bg pl-9 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-gr-text-muted focus:border-gr-accent-strong focus:ring-2 focus:ring-gr-accent-strong/20 lg:h-10 lg:pl-10 lg:text-[0.9rem] [&::-webkit-search-cancel-button]:hidden"
          :class="query.trim() ? 'pr-9' : 'pr-3'"
          :placeholder="searchPlaceholder"
          autocomplete="off"
        />
        <button
          v-if="query.trim()"
          type="button"
          class="absolute top-1/2 right-1.5 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-gr-text-muted hover:bg-gr-surface-2 hover:text-gr-text"
          aria-label="Clear filter"
          @click="query = ''"
        >
          <Icon icon="tabler:x" class="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </label>

      <div class="flex w-full flex-wrap items-center gap-x-4 gap-y-2">
        <FilterChipGroup
          v-model="health"
          :options="LIST_HEALTH_OPTIONS"
          variant="segmented"
          :label="healthLabel ?? 'Health'"
          group-aria-label="Filter by health"
        />
        <FilterChipGroup
          v-if="showPing"
          v-model="timeframe"
          :options="pingOptions"
          variant="segmented"
          label="Ping"
          group-aria-label="Ping frequency window"
        />
      </div>

      <div v-if="$slots.extra" class="flex flex-col gap-2.5">
        <slot name="extra" />
      </div>

      <div
        v-if="$slots.tools || $slots.actions"
        class="flex w-full flex-wrap items-center gap-x-4 gap-y-2"
      >
        <slot name="tools" />
        <div
          v-if="$slots.actions"
          class="ml-auto flex flex-wrap items-center gap-2"
        >
          <slot name="actions" />
        </div>
      </div>

      <p
        v-if="showingLabel"
        class="text-right text-xs tabular-nums tracking-wide text-gr-text-muted"
      >
        {{ showingLabel }}
      </p>
    </div>
  </section>
</template>
