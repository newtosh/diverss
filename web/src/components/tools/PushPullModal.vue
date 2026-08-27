<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  kind: 'push' | 'pull'
}>()

const emit = defineEmits<{
  cancel: []
  choose: [mode: 'replace' | 'merge' | 'stage']
}>()

const mode = ref<'replace' | 'merge' | 'stage'>('merge')

watch(
  () => props.open,
  (open) => {
    if (open) mode.value = props.kind === 'push' ? 'merge' : 'merge'
  },
)

function submit() {
  emit('choose', mode.value)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      :aria-label="kind === 'push' ? 'Push to reader' : 'Pull from reader'"
      @click.self="emit('cancel')"
    >
      <div
        class="w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-lg"
      >
        <h2 class="text-lg font-semibold text-slate-900">
          {{ kind === 'push' ? 'Push Garden to reader' : 'Pull from reader' }}
        </h2>
        <p class="mt-2 text-sm text-slate-600">
          Choose how to apply this transfer. Replace is never silent.
        </p>

        <fieldset class="mt-4 space-y-2">
          <legend class="sr-only">Mode</legend>
          <label
            v-if="kind === 'push'"
            class="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 p-2 text-sm hover:bg-slate-50"
          >
            <input v-model="mode" type="radio" value="merge" class="mt-0.5" />
            <span
              ><span class="font-medium">Merge</span> — additive import on the
              reader (existing feeds kept)</span
            >
          </label>
          <label
            v-if="kind === 'push'"
            class="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 p-2 text-sm hover:bg-slate-50"
          >
            <input v-model="mode" type="radio" value="replace" class="mt-0.5" />
            <span
              ><span class="font-medium">Replace</span> — wipe reader feeds
              (backup required), then import Garden</span
            >
          </label>
          <label
            v-if="kind === 'pull'"
            class="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 p-2 text-sm hover:bg-slate-50"
          >
            <input v-model="mode" type="radio" value="merge" class="mt-0.5" />
            <span
              ><span class="font-medium">Merge</span> — add missing feeds into
              the Garden</span
            >
          </label>
          <label
            v-if="kind === 'pull'"
            class="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 p-2 text-sm hover:bg-slate-50"
          >
            <input v-model="mode" type="radio" value="replace" class="mt-0.5" />
            <span
              ><span class="font-medium">Replace</span> — replace the GardenRSS
              garden with the reader list</span
            >
          </label>
          <label
            v-if="kind === 'pull'"
            class="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 p-2 text-sm hover:bg-slate-50"
          >
            <input v-model="mode" type="radio" value="stage" class="mt-0.5" />
            <span
              ><span class="font-medium">Stage</span> — send feeds to the Deck
              for review</span
            >
          </label>
        </fieldset>

        <div class="mt-5 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            @click="emit('cancel')"
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-md border border-teal-700 bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800"
            @click="submit"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
