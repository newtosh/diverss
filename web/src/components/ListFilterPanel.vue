<script setup lang="ts">
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
    compactChips?: boolean
  }>(),
  {
    searchPlaceholder: 'Filter by title or URL…',
    searchAriaLabel: 'Filter feeds',
    showPing: true,
    compactChips: false,
  },
)

const pingOptions = PING_TIMEFRAMES.map((id) => ({ id, label: id }))
</script>

<template>
  <section
    class="list-filter-panel relative overflow-hidden rounded-lg border border-gr-border/90 bg-gradient-to-br from-gr-surface-2 via-gr-surface to-gr-accent/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7)]"
    aria-label="List filters"
  >
    <!-- Depth marker — GardenRSS filter rail -->
    <div
      class="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-gr-accent-strong via-gr-accent to-gr-accent-strong"
      aria-hidden="true"
    />
    <div
      class="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-gr-accent-strong/40 via-gr-border to-transparent"
      aria-hidden="true"
    />

    <div class="relative space-y-2.5 py-2.5 pl-3.5 pr-2.5">
      <label class="relative block min-w-0 w-full">
        <span class="sr-only">{{ searchAriaLabel }}</span>
        <input
          v-model="query"
          type="search"
          class="w-full rounded-md border border-gr-border/90 bg-gr-surface/90 py-1.5 pl-3 text-sm shadow-sm outline-none transition-[border-color,box-shadow] placeholder:text-gr-text-muted focus:border-gr-accent-strong focus:ring-2 focus:ring-gr-accent-strong/20 [&::-webkit-search-cancel-button]:hidden"
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
          <span class="text-base leading-none" aria-hidden="true">×</span>
        </button>
      </label>

      <FilterChipGroup
        v-model="health"
        :options="LIST_HEALTH_OPTIONS"
        :label="healthLabel ?? 'Health'"
        group-aria-label="Filter by health"
        :compact="compactChips"
      />

      <div v-if="$slots.extra" class="flex flex-col gap-2.5">
        <slot name="extra" />
      </div>

      <div
        v-if="showPing || $slots.tools || $slots.actions"
        class="flex w-full flex-wrap items-center gap-x-4 gap-y-2"
      >
        <FilterChipGroup
          v-if="showPing"
          v-model="timeframe"
          :options="pingOptions"
          label="Ping"
          group-aria-label="Ping frequency window"
          :compact="compactChips"
        />
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
