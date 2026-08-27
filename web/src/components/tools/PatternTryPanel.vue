<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { tryPatternAgainstSamples } from '@/tools/filters/tryPattern'
import type { FilterPatternKind } from '@/tools/filters/types'

const props = defineProps<{
  pattern: string
  patternKind: FilterPatternKind
  /** Seed lines when the panel opens / pack changes. */
  seedSamples?: string[]
}>()

const open = ref(false)
const customSample = ref('')
const samples = ref<string[]>([])

const DEFAULT_SEEDS = [
  'iPhone camera trick you need',
  'Fortnite Chapter 6 is live',
  'Free on streaming this weekend',
  'Essential viewing: 10/10 smash hit',
]

watch(
  () => [props.pattern, props.patternKind, props.seedSamples] as const,
  () => {
    const seeds =
      props.seedSamples?.filter((s) => s.trim()).slice(0, 6) ?? DEFAULT_SEEDS
    samples.value = seeds.length ? seeds : DEFAULT_SEEDS
  },
  { immediate: true },
)

const preview = computed(() =>
  tryPatternAgainstSamples(props.pattern, props.patternKind, [
    ...samples.value,
    ...(customSample.value.trim() ? [customSample.value.trim()] : []),
  ]),
)

const hitCount = computed(() =>
  preview.value.rows.reduce((n, r) => n + (r.matchCount > 0 ? 1 : 0), 0),
)
</script>

<template>
  <div class="rounded-md border border-gr-border">
    <button
      type="button"
      class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-gr-text hover:bg-gr-surface-2"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="font-medium">Try pattern</span>
      <span class="text-xs text-gr-text-muted">
        {{
          open
            ? 'Hide'
            : preview.error
              ? 'Invalid'
              : `${hitCount}/${preview.rows.length} samples hit`
        }}
      </span>
    </button>

    <div v-if="open" class="space-y-2 border-t border-gr-border px-3 py-2.5">
      <p class="text-[11px] leading-relaxed text-gr-text-muted">
        Browser preview only — Miniflux uses RE2; some JS-only syntax may differ.
        <span v-if="preview.source" class="font-mono text-gr-text-muted">
          → {{ preview.source }}
        </span>
      </p>

      <p v-if="preview.error" class="text-xs text-red-700" role="alert">
        {{ preview.error }}
      </p>

      <ul v-else class="max-h-48 space-y-1.5 overflow-y-auto">
        <li
          v-for="(row, i) in preview.rows"
          :key="i"
          class="rounded-md px-2 py-1.5 text-xs leading-relaxed"
          :class="
            row.matchCount
              ? 'bg-gr-accent/15 text-gr-accent-strong'
              : 'bg-gr-surface-2 text-gr-text-muted'
          "
        >
          <span class="mr-1.5 inline-block min-w-8 text-[10px] font-semibold tracking-wide uppercase"
            :class="row.matchCount ? 'text-gr-accent-strong' : 'text-gr-text-muted'"
          >
            {{ row.matchCount ? `${row.matchCount} hit` : 'miss' }}
          </span>
          <span class="whitespace-pre-wrap break-words">
            <template v-for="(seg, j) in row.segments" :key="j">
              <mark
                v-if="seg.hit"
                class="rounded-sm bg-amber-200/90 px-0.5 text-inherit"
                >{{ seg.text }}</mark
              >
              <template v-else>{{ seg.text }}</template>
            </template>
          </span>
        </li>
      </ul>

      <label class="block space-y-1 text-xs">
        <span class="text-gr-text-muted">Your sample</span>
        <input
          v-model="customSample"
          type="text"
          class="w-full rounded-md border border-gr-border px-2.5 py-1.5 text-xs"
          placeholder="Paste a title or snippet to test…"
        />
      </label>
    </div>
  </div>
</template>
