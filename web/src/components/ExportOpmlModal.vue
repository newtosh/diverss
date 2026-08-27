<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { opmlDownloadFilename } from '@/opml/filename'

const props = defineProps<{
  open: boolean
  /** Current workspace / document title used as the starting value. */
  initialTitle: string
}>()

const emit = defineEmits<{
  cancel: []
  confirm: [title: string]
}>()

const title = ref('')

const filename = computed(() => opmlDownloadFilename(title.value))

const canExport = computed(() => title.value.trim().length > 0)

function reset() {
  title.value = props.initialTitle.trim() || 'My subscriptions'
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
      reset()
      window.addEventListener('keydown', onKeydown)
    } else {
      window.removeEventListener('keydown', onKeydown)
    }
  },
)

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})

function onConfirm() {
  if (!canExport.value) return
  emit('confirm', title.value.trim())
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      @click.self="emit('cancel')"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-opml-title"
        class="flex w-full max-w-lg flex-col overflow-hidden rounded-lg border border-gr-border bg-gr-surface shadow-lg"
      >
        <div class="border-b border-gr-border px-4 py-3">
          <h2 id="export-opml-title" class="text-base font-semibold text-gr-text">
            Export OPML
          </h2>
          <p class="mt-0.5 text-sm text-gr-text-muted">
            Set the document title written into the OPML &lt;head&gt; and used as
            the download file name.
          </p>
        </div>

        <div class="space-y-4 px-4 py-4">
          <label class="block space-y-1">
            <span class="text-sm font-medium text-gr-text">Title</span>
            <input
              v-model="title"
              type="text"
              class="w-full rounded-md border border-gr-border px-3 py-2 text-sm"
              placeholder="My subscriptions"
              autocomplete="off"
              @keydown.enter.prevent="onConfirm"
            />
            <span class="text-xs text-gr-text-muted">
              Download as
              <code class="rounded bg-gr-surface-2 px-1 font-mono text-[0.7rem] text-gr-text">{{
                filename
              }}</code>
            </span>
          </label>
        </div>

        <div class="flex justify-end gap-2 border-t border-gr-border px-4 py-3">
          <button
            type="button"
            class="rounded-md border border-gr-border bg-gr-surface px-3 py-2 text-sm font-medium text-gr-text hover:bg-gr-surface-2"
            @click="emit('cancel')"
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-md bg-gr-accent-strong px-3 py-2 text-sm font-medium text-white hover:brightness-90 disabled:opacity-50"
            :disabled="!canExport"
            @click="onConfirm"
          >
            Download OPML
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
