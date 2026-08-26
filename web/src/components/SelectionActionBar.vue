<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'

const props = withDefaults(
  defineProps<{
    count: number
    canScore?: boolean
    scoring?: boolean
    /** Completed URLs while scoring (selection or bulk). */
    scoreDone?: number
    scoreTotal?: number
    /** workspace: Move/Delete · catalog: Outbox/Remove */
    variant?: 'workspace' | 'catalog'
  }>(),
  {
    canScore: false,
    scoring: false,
    scoreDone: 0,
    scoreTotal: 0,
    variant: 'workspace',
  },
)

const emit = defineEmits<{
  score: []
  move: []
  outbox: []
  delete: []
  clear: []
}>()

const scoreLabel = computed(() => {
  if (!props.scoring) return 'Score'
  if (props.scoreTotal > 0) {
    return `Scoring ${props.scoreDone}/${props.scoreTotal}`
  }
  return 'Scoring…'
})

const scorePercent = computed(() => {
  if (!props.scoring || props.scoreTotal <= 0) return 0
  return Math.min(100, Math.round((100 * props.scoreDone) / props.scoreTotal))
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
        :aria-busy="scoring ? 'true' : undefined"
      >
        <div
          class="pointer-events-auto flex max-w-full flex-col overflow-hidden rounded-xl border border-teal-500/30 bg-slate-950 text-slate-100 shadow-[0_12px_40px_-8px_rgba(15,23,42,0.65),0_0_0_1px_rgba(15,118,110,0.25)]"
        >
          <div
            v-if="scoring && scoreTotal > 0"
            class="h-1 w-full bg-slate-800"
            role="progressbar"
            :aria-valuenow="scoreDone"
            :aria-valuemin="0"
            :aria-valuemax="scoreTotal"
            aria-label="Scoring progress"
          >
            <div
              class="relative h-full bg-teal-400 transition-[width] duration-300 ease-out"
              :style="{ width: `${scorePercent}%` }"
            >
              <div
                class="animate-score-shimmer pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                aria-hidden="true"
              />
            </div>
          </div>
          <div class="flex min-w-0 items-stretch">
            <div
              class="w-1 shrink-0 bg-gradient-to-b from-teal-400 via-teal-500 to-teal-700"
              aria-hidden="true"
            />
            <div
              class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:gap-x-4 sm:px-4"
            >
              <div class="min-w-0 pl-0.5">
                <p
                  class="text-[10px] font-semibold tracking-[0.18em] text-teal-400/90 uppercase"
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
                  class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed"
                  :class="
                    scoring
                      ? 'border-teal-400/60 bg-teal-700 text-white disabled:opacity-100'
                      : 'border-slate-600/80 bg-slate-900/80 text-slate-100 hover:border-teal-500/50 hover:bg-slate-800 hover:text-white disabled:opacity-40'
                  "
                  :disabled="!canScore || scoring"
                  :aria-busy="scoring"
                  @click="emit('score')"
                >
                  <Icon
                    :icon="scoring ? 'tabler:loader-2' : 'tabler:radar-2'"
                    class="h-4 w-4"
                    :class="scoring ? 'animate-spin text-teal-100' : 'text-teal-400'"
                    aria-hidden="true"
                  />
                  {{ scoreLabel }}
                </button>
                <button
                  v-if="variant === 'workspace'"
                  type="button"
                  class="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/80 bg-slate-900/80 px-3 py-1.5 text-sm font-medium text-slate-100 transition-colors hover:border-teal-500/50 hover:bg-slate-800 hover:text-white disabled:opacity-40"
                  :disabled="scoring"
                  @click="emit('move')"
                >
                  <Icon
                    icon="tabler:folder-symlink"
                    class="h-4 w-4 text-teal-400"
                    aria-hidden="true"
                  />
                  Move
                </button>
                <button
                  v-else
                  type="button"
                  class="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/80 bg-slate-900/80 px-3 py-1.5 text-sm font-medium text-slate-100 transition-colors hover:border-teal-500/50 hover:bg-slate-800 hover:text-white disabled:opacity-40"
                  :disabled="scoring"
                  @click="emit('outbox')"
                >
                  <Icon
                    icon="tabler:inbox"
                    class="h-4 w-4 text-teal-400"
                    aria-hidden="true"
                  />
                  Outbox
                </button>
                <button
                  type="button"
                  class="inline-flex items-center gap-1.5 rounded-lg border border-red-500/35 bg-red-950/40 px-3 py-1.5 text-sm font-medium text-red-300 transition-colors hover:border-red-400/50 hover:bg-red-950/70 hover:text-red-200 disabled:opacity-40"
                  :disabled="scoring"
                  @click="emit('delete')"
                >
                  <Icon icon="tabler:trash" class="h-4 w-4" aria-hidden="true" />
                  {{ variant === 'catalog' ? 'Remove' : 'Delete' }}
                </button>
                <button
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-40"
                  aria-label="Clear selection"
                  :disabled="scoring"
                  @click="emit('clear')"
                >
                  <Icon icon="tabler:x" class="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
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
