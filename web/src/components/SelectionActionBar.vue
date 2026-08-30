<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'

const props = withDefaults(
  defineProps<{
    count: number
    canScan?: boolean
    scanning?: boolean
    /** Completed URLs while scanning (selection or bulk). */
    scanDone?: number
    scanTotal?: number
    /** workspace: Move/Delete · catalog: Outbox/Remove */
    variant?: 'workspace' | 'catalog'
  }>(),
  {
    canScan: false,
    scanning: false,
    scanDone: 0,
    scanTotal: 0,
    variant: 'workspace',
  },
)

const emit = defineEmits<{
  scan: []
  move: []
  outbox: []
  delete: []
  clear: []
}>()

/** Stable label width — never swap in "Scanning n/m" (that grew the bar). */
const scanLabel = computed(() => (props.scanning ? 'Scanning…' : 'Scan'))

const scanPercent = computed(() => {
  if (!props.scanning || props.scanTotal <= 0) return 0
  return Math.min(100, Math.round((100 * props.scanDone) / props.scanTotal))
})

const progressTitle = computed(() => {
  if (!props.scanning || props.scanTotal <= 0) return undefined
  return `Scanning ${props.scanDone}/${props.scanTotal}`
})
</script>

<template>
  <Teleport to="body">
    <Transition name="selection-bar">
      <div
        v-if="count > 0"
        class="selection-action-bar pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-5 sm:pb-6"
        role="toolbar"
        :aria-label="`${count} feeds selected`"
        :aria-busy="scanning ? 'true' : undefined"
      >
        <div
          class="pointer-events-auto relative flex max-w-full items-stretch overflow-hidden rounded-xl border border-gr-accent/30 bg-slate-950 text-slate-100 shadow-[0_12px_40px_-8px_rgba(15,23,42,0.65),0_0_0_1px_rgba(193,101,47,0.25)]"
          :title="progressTitle"
        >
          <!-- Overlay progress — must not add a flex row (UI contract: fixed bar height). -->
          <div
            v-if="scanning && scanTotal > 0"
            class="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 bg-slate-800/90"
            role="progressbar"
            :aria-valuenow="scanDone"
            :aria-valuemin="0"
            :aria-valuemax="scanTotal"
            aria-label="Scanning progress"
          >
            <div
              class="relative h-full bg-gr-accent transition-[width] duration-300 ease-out"
              :style="{ width: `${scanPercent}%` }"
            >
              <div
                class="animate-scan-shimmer pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                aria-hidden="true"
              />
            </div>
          </div>
          <div
            class="w-1 shrink-0 bg-gradient-to-b from-gr-accent via-gr-accent to-gr-accent-strong"
            aria-hidden="true"
          />
          <div
            class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:gap-x-4 sm:px-4"
          >
            <div class="min-w-0 pl-0.5">
              <p
                class="text-[10px] font-semibold tracking-[0.18em] text-gr-accent/90 uppercase"
              >
                Selection
              </p>
              <p class="text-sm font-medium tabular-nums text-white">
                {{ count }}
                <span class="font-normal text-slate-400">
                  feed{{ count === 1 ? '' : 's' }}
                </span>
              </p>
            </div>

            <div class="hidden h-8 w-px bg-slate-700/80 sm:block" aria-hidden="true" />

            <div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed"
                :class="
                  scanning
                    ? 'border-gr-accent/60 bg-gr-accent-strong text-gr-on-accent disabled:opacity-100'
                    : 'border-slate-600/80 bg-slate-900/80 text-slate-100 hover:border-gr-accent/50 hover:bg-slate-800 hover:text-white disabled:opacity-40'
                "
                :disabled="!canScan || scanning"
                :aria-busy="scanning"
                @click="emit('scan')"
              >
                <span
                  class="inline-flex min-w-[5.75rem] items-center justify-center gap-1.5"
                >
                  <Icon
                    :icon="scanning ? 'tabler:loader-2' : 'tabler:radar-2'"
                    class="h-4 w-4 shrink-0"
                    :class="scanning ? 'animate-spin text-gr-surface' : 'text-gr-accent'"
                    aria-hidden="true"
                  />
                  {{ scanLabel }}
                </span>
              </button>
              <button
                v-if="variant === 'workspace'"
                type="button"
                class="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/80 bg-slate-900/80 px-3 py-1.5 text-sm font-medium text-slate-100 transition-colors hover:border-gr-accent/50 hover:bg-slate-800 hover:text-white disabled:opacity-40"
                :disabled="scanning"
                @click="emit('move')"
              >
                <Icon
                  icon="tabler:folder-symlink"
                  class="h-4 w-4 text-gr-accent"
                  aria-hidden="true"
                />
                Move
              </button>
              <button
                v-else
                type="button"
                class="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/80 bg-slate-900/80 px-3 py-1.5 text-sm font-medium text-slate-100 transition-colors hover:border-gr-accent/50 hover:bg-slate-800 hover:text-white disabled:opacity-40"
                :disabled="scanning"
                @click="emit('outbox')"
              >
                <Icon
                  icon="tabler:stack-2"
                  class="h-4 w-4 text-gr-accent"
                  aria-hidden="true"
                />
                Deck
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-lg border border-red-500/35 bg-red-950/40 px-3 py-1.5 text-sm font-medium text-red-300 transition-colors hover:border-red-400/50 hover:bg-red-950/70 hover:text-red-200 disabled:opacity-40"
                :disabled="scanning"
                @click="emit('delete')"
              >
                <Icon icon="tabler:trash" class="h-4 w-4" aria-hidden="true" />
                {{ variant === 'catalog' ? 'Remove' : 'Delete' }}
              </button>
              <button
                type="button"
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-40"
                aria-label="Clear selection"
                :disabled="scanning"
                @click="emit('clear')"
              >
                <Icon icon="tabler:x" class="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.selection-bar-enter-active,
.selection-bar-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.selection-bar-enter-from,
.selection-bar-leave-to {
  opacity: 0;
  transform: translateY(1.25rem);
}
</style>
