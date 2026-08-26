<script setup lang="ts">
import { Icon } from '@iconify/vue'

withDefaults(
  defineProps<{
    count: number
    canScore?: boolean
    scoring?: boolean
    /** workspace: Move/Delete · catalog: Outbox/Remove */
    variant?: 'workspace' | 'catalog'
  }>(),
  {
    canScore: false,
    scoring: false,
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
</script>

<template>
  <Teleport to="body">
    <Transition name="selection-bar">
      <div
        v-if="count > 0"
        class="selection-action-bar pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-5 sm:pb-6"
        role="toolbar"
        :aria-label="`${count} feeds selected`"
      >
        <div
          class="pointer-events-auto flex max-w-full items-stretch overflow-hidden rounded-xl border border-teal-500/30 bg-slate-950 text-slate-100 shadow-[0_12px_40px_-8px_rgba(15,23,42,0.65),0_0_0_1px_rgba(15,118,110,0.25)]"
        >
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
                class="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/80 bg-slate-900/80 px-3 py-1.5 text-sm font-medium text-slate-100 transition-colors hover:border-teal-500/50 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="!canScore || scoring"
                @click="emit('score')"
              >
                <Icon
                  icon="tabler:radar-2"
                  class="h-4 w-4 text-teal-400"
                  aria-hidden="true"
                />
                {{ scoring ? 'Scoring…' : 'Score' }}
              </button>
              <button
                v-if="variant === 'workspace'"
                type="button"
                class="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/80 bg-slate-900/80 px-3 py-1.5 text-sm font-medium text-slate-100 transition-colors hover:border-teal-500/50 hover:bg-slate-800 hover:text-white"
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
                class="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/80 bg-slate-900/80 px-3 py-1.5 text-sm font-medium text-slate-100 transition-colors hover:border-teal-500/50 hover:bg-slate-800 hover:text-white"
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
                class="inline-flex items-center gap-1.5 rounded-lg border border-red-500/35 bg-red-950/40 px-3 py-1.5 text-sm font-medium text-red-300 transition-colors hover:border-red-400/50 hover:bg-red-950/70 hover:text-red-200"
                @click="emit('delete')"
              >
                <Icon icon="tabler:trash" class="h-4 w-4" aria-hidden="true" />
                {{ variant === 'catalog' ? 'Remove' : 'Delete' }}
              </button>
              <button
                type="button"
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                aria-label="Clear selection"
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
