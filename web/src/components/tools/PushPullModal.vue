<script setup lang="ts">
import { ref, watch } from 'vue'
import Button from '@/components/ui/Button.vue'

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
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      :aria-label="kind === 'push' ? 'Push to reader' : 'Pull from reader'"
      @click.self="emit('cancel')"
    >
      <div
        class="w-full max-w-md rounded-lg border border-gr-border bg-gr-surface p-4 shadow-lg"
      >
        <h2 class="text-lg font-semibold text-gr-text">
          {{ kind === 'push' ? 'Push Garden to reader' : 'Pull from reader' }}
        </h2>
        <p class="mt-2 text-sm text-gr-text-muted">
          Choose how to apply this transfer. Replace is never silent.
        </p>

        <fieldset class="mt-4 space-y-2">
          <legend class="sr-only">Mode</legend>
          <label
            v-if="kind === 'push'"
            class="flex cursor-pointer items-start gap-2 rounded-md border border-gr-border p-2 text-sm hover:bg-gr-surface-2"
          >
            <input v-model="mode" type="radio" value="merge" class="mt-0.5" />
            <span
              ><span class="font-medium">Merge</span> — additive import on the
              reader (existing feeds kept)</span
            >
          </label>
          <label
            v-if="kind === 'push'"
            class="flex cursor-pointer items-start gap-2 rounded-md border border-gr-border p-2 text-sm hover:bg-gr-surface-2"
          >
            <input v-model="mode" type="radio" value="replace" class="mt-0.5" />
            <span
              ><span class="font-medium">Replace</span> — wipe reader feeds
              (backup required), then import Garden</span
            >
          </label>
          <label
            v-if="kind === 'pull'"
            class="flex cursor-pointer items-start gap-2 rounded-md border border-gr-border p-2 text-sm hover:bg-gr-surface-2"
          >
            <input v-model="mode" type="radio" value="merge" class="mt-0.5" />
            <span
              ><span class="font-medium">Merge</span> — add missing feeds into
              the Garden</span
            >
          </label>
          <label
            v-if="kind === 'pull'"
            class="flex cursor-pointer items-start gap-2 rounded-md border border-gr-border p-2 text-sm hover:bg-gr-surface-2"
          >
            <input v-model="mode" type="radio" value="replace" class="mt-0.5" />
            <span
              ><span class="font-medium">Replace</span> — replace the GardenRSS
              garden with the reader list</span
            >
          </label>
          <label
            v-if="kind === 'pull'"
            class="flex cursor-pointer items-start gap-2 rounded-md border border-gr-border p-2 text-sm hover:bg-gr-surface-2"
          >
            <input v-model="mode" type="radio" value="stage" class="mt-0.5" />
            <span
              ><span class="font-medium">Stage</span> — send feeds to the Deck
              for review</span
            >
          </label>
        </fieldset>

        <div class="mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="sm" @click="emit('cancel')">Cancel</Button>
          <Button variant="primary" size="sm" @click="submit">Continue</Button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
