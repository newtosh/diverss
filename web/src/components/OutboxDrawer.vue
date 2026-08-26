<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import type { OpmlDocument } from '@/opml/types'
import OutboxPanel from '@/components/OutboxPanel.vue'
import { setOutboxDrawerOpen } from '@/outbox/store'

const props = defineProps<{
  open: boolean
  document: OpmlDocument
}>()

const emit = defineEmits<{
  close: []
  imported: [
    summary: {
      document: OpmlDocument
      added: number
      skippedAlreadyPresent: number
      createdCategories: string[]
    },
  ]
}>()

function onKeydown(ev: KeyboardEvent) {
  if (!props.open) return
  if (ev.key === 'Escape') {
    ev.preventDefault()
    emit('close')
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      window.addEventListener('keydown', onKeydown)
    } else {
      window.removeEventListener('keydown', onKeydown)
    }
  },
)

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})

function onClose() {
  setOutboxDrawerOpen(false)
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex justify-end bg-slate-900/40"
      role="presentation"
      @click.self="onClose"
    >
      <aside
        id="outbox-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="outbox-panel-title"
        class="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl"
        @click.stop
      >
        <OutboxPanel
          :document="document"
          variant="drawer"
          @close="onClose"
          @expand="onClose"
          @imported="(s) => emit('imported', s)"
        />
      </aside>
    </div>
  </Teleport>
</template>
