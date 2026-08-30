<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import Button from '@/components/ui/Button.vue'
import type { FeedSuggestion } from '@/suggest/proxyUnwrap'
import type { ScanResult, ScanTimeframe } from '@/scan/client'
import { pingBandClass, pingFrequencyFor, radarIcon } from '@/scan/pingFrequency'
import { healthPill, isFetchBlocked } from '@/scan/presentation'

const props = withDefaults(
  defineProps<{
    suggestions: FeedSuggestion[]
    scores?: Record<string, ScanResult>
    timeframe?: ScanTimeframe
    discovering?: boolean
    scanning?: boolean
    canDiscover?: boolean
    /** Show Mark as Unhealthy (Stale feeds with no good replacement). */
    canMarkUnhealthy?: boolean
    discoverError?: string
    statusNote?: string
  }>(),
  {
    scores: () => ({}),
    timeframe: '7d',
    discovering: false,
    scanning: false,
    canDiscover: false,
    canMarkUnhealthy: false,
  },
)

const emit = defineEmits<{
  use: [xmlUrl: string]
  discover: []
  collapse: []
  markUnhealthy: []
}>()

function healthRank(s?: ScanResult): number {
  if (!s) return 2
  if (s.health === 'ok') return 0
  if (s.health === 'stale') return 1
  if (isFetchBlocked(s)) return 2
  return 3
}

const ranked = computed(() => {
  return [...props.suggestions].sort((a, b) => {
    const sa = props.scores[a.xmlUrl]
    const sb = props.scores[b.xmlUrl]
    const ra = healthRank(sa)
    const rb = healthRank(sb)
    if (ra !== rb) return ra - rb
    if (sa?.health === 'ok' && sb?.health === 'ok') {
      const pa = pingFrequencyFor(sa, props.timeframe)?.score ?? 0
      const pb = pingFrequencyFor(sb, props.timeframe)?.score ?? 0
      return pb - pa
    }
    return a.label.localeCompare(b.label)
  })
})
</script>

<template>
  <div class="rounded-md border border-gr-border bg-gr-surface-2/80 px-3 py-2.5">
    <div class="mb-2 flex items-center justify-between gap-2">
      <p class="text-xs font-medium text-gr-text">Suggested feed URLs</p>
      <button
        type="button"
        class="text-xs text-gr-text-muted hover:text-gr-text"
        @click="emit('collapse')"
      >
        Close
      </button>
    </div>

    <p v-if="statusNote" class="mb-2 text-xs text-amber-900">
      {{ statusNote }}
    </p>

    <ul v-if="ranked.length > 0" class="space-y-2">
      <li
        v-for="s in ranked"
        :key="s.xmlUrl"
        class="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3"
      >
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-medium text-gr-text">{{
            s.label
          }}</span>
          <span class="block truncate text-xs text-gr-text-muted" :title="s.xmlUrl">{{
            s.xmlUrl
          }}</span>
          <span class="mt-1 flex flex-wrap items-center gap-2">
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
              :class="healthPill(scores[s.xmlUrl]).className"
              :title="healthPill(scores[s.xmlUrl]).title"
            >
              {{ healthPill(scores[s.xmlUrl]).label }}
            </span>
            <span
              v-if="pingFrequencyFor(scores[s.xmlUrl], timeframe)"
              class="inline-flex items-center gap-0.5 text-xs font-medium tabular-nums"
              :class="
                pingBandClass(pingFrequencyFor(scores[s.xmlUrl], timeframe)!.band)
              "
              :title="pingFrequencyFor(scores[s.xmlUrl], timeframe)!.tooltip"
            >
              <Icon
                :icon="
                  radarIcon(pingFrequencyFor(scores[s.xmlUrl], timeframe)!.band)
                "
                class="h-3.5 w-3.5"
                aria-hidden="true"
              />
              {{ pingFrequencyFor(scores[s.xmlUrl], timeframe)!.score }}
            </span>
          </span>
        </span>
        <button
          type="button"
          class="shrink-0 text-sm font-medium text-gr-accent-strong hover:text-gr-accent-strong"
          @click="emit('use', s.xmlUrl)"
        >
          Use this URL
        </button>
      </li>
    </ul>

    <p
      v-else-if="!discovering && !discoverError"
      class="text-xs text-gr-text-muted"
    >
      {{
        canDiscover
          ? 'No suggestions yet — search the site for alternate feeds.'
          : 'No local URL suggestions for this feed.'
      }}
    </p>

    <div class="mt-2 flex flex-wrap items-center gap-2">
      <Button
        v-if="canDiscover"
        variant="secondary"
        size="sm"
        :disabled="discovering || scanning"
        @click="emit('discover')"
      >
        Find feeds on site
      </Button>
      <Button
        v-if="canMarkUnhealthy"
        variant="danger"
        size="sm"
        title="Treat as broken for prune — moves this feed from Stale to Unhealthy"
        @click="emit('markUnhealthy')"
      >
        Mark as Unhealthy
      </Button>
      <span v-if="discoverError" class="text-xs text-red-700">{{ discoverError }}</span>
    </div>
  </div>
</template>
