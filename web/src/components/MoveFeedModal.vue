<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/ui/Dialog.vue'
import type { OutlinePath } from '@/opml/mutate'

const props = withDefaults(
  defineProps<{
    open: boolean
    feedTitle: string
    /** Current parent folder path; empty = already ungrouped at root. */
    currentFolderPath?: OutlinePath
    sections: { path: OutlinePath; label: string }[]
    /** Bulk move: any destination is allowed (no “already here” block). */
    bulk?: boolean
  }>(),
  {
    currentFolderPath: () => [],
    bulk: false,
  },
)

const emit = defineEmits<{
  cancel: []
  confirm: [folderPath: OutlinePath | null]
}>()

const sectionKey = ref('')

const currentKey = computed(() => props.currentFolderPath.join('.'))

watch(
  () => props.open,
  (open) => {
    if (open) sectionKey.value = props.bulk ? '' : currentKey.value
  },
)

const canMove = computed(() => {
  if (props.bulk) return true
  return sectionKey.value !== currentKey.value
})

function onConfirm() {
  if (!canMove.value) return
  if (!sectionKey.value) {
    emit('confirm', null)
    return
  }
  emit(
    'confirm',
    sectionKey.value.split('.').map((s) => Number(s)),
  )
}

function onUpdateOpen(next: boolean) {
  if (!next) emit('cancel')
}
</script>

<template>
  <Dialog
    :open="open"
    size="md"
    title="Move to category"
    :description="feedTitle"
    @update:open="onUpdateOpen"
  >
    <label class="block space-y-1">
      <span class="text-sm font-medium text-gr-text">Category</span>
      <select
        v-model="sectionKey"
        class="w-full rounded-md border border-gr-border bg-gr-surface px-3 py-2 text-sm"
      >
        <option value="">Ungrouped (top level)</option>
        <option v-for="s in sections" :key="s.path.join('.')" :value="s.path.join('.')">
          {{ s.label }}
        </option>
      </select>
    </label>

    <template #footer>
      <Button variant="secondary" @click="emit('cancel')">Cancel</Button>
      <Button variant="primary" :disabled="!canMove" @click="onConfirm">
        {{ bulk ? 'Move feeds' : 'Move feed' }}
      </Button>
    </template>
  </Dialog>
</template>
