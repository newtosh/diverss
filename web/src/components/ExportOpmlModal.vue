<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/ui/Dialog.vue'
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

watch(
  () => props.open,
  (open) => {
    if (open) reset()
  },
)

function onConfirm() {
  if (!canExport.value) return
  emit('confirm', title.value.trim())
}

function onUpdateOpen(next: boolean) {
  if (!next) emit('cancel')
}
</script>

<template>
  <Dialog
    :open="open"
    size="lg"
    title="Export OPML"
    description="Set the document title written into the OPML <head> and used as the download file name."
    @update:open="onUpdateOpen"
  >
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

    <template #footer>
      <Button variant="secondary" @click="emit('cancel')">Cancel</Button>
      <Button variant="primary" :disabled="!canExport" @click="onConfirm">
        Download OPML
      </Button>
    </template>
  </Dialog>
</template>
