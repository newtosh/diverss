<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/ui/Dialog.vue'
import type { OutlinePath } from '@/opml/mutate'

export interface AddCategoryPayload {
  text: string
  /** null / empty = top-level category. */
  parentPath: OutlinePath | null
}

const props = defineProps<{
  open: boolean
  sections: { path: OutlinePath; label: string }[]
}>()

const emit = defineEmits<{
  cancel: []
  confirm: [payload: AddCategoryPayload]
}>()

const name = ref('')
const parentKey = ref('')

const canAdd = computed(() => name.value.trim().length > 0)

function reset() {
  name.value = ''
  parentKey.value = ''
}

watch(
  () => props.open,
  (open) => {
    if (open) reset()
  },
)

function parsePath(key: string): OutlinePath | null {
  if (!key) return null
  return key.split('.').map((n) => Number(n))
}

function onConfirm() {
  if (!canAdd.value) return
  emit('confirm', {
    text: name.value.trim(),
    parentPath: parsePath(parentKey.value),
  })
}

function onUpdateOpen(next: boolean) {
  if (!next) emit('cancel')
}
</script>

<template>
  <Dialog
    :open="open"
    size="lg"
    title="Add a category"
    description="Creates an OPML category you can group feeds under."
    @update:open="onUpdateOpen"
  >
    <div class="space-y-4">
      <label class="block space-y-1">
        <span class="text-sm font-medium text-gr-text">Name</span>
        <input
          v-model="name"
          type="text"
          class="w-full rounded-md border border-gr-border px-3 py-2 text-sm"
          placeholder="e.g. Apple, News, Gadgets"
          autocomplete="off"
          @keydown.enter.prevent="onConfirm"
        />
        <span class="text-xs text-gr-text-muted">
          Shown as a category heading in your workspace and exported OPML.
        </span>
      </label>

      <label class="block space-y-1">
        <span class="text-sm font-medium text-gr-text">Parent category</span>
        <select
          v-model="parentKey"
          class="w-full rounded-md border border-gr-border bg-gr-surface px-3 py-2 text-sm"
        >
          <option value="">None (top level)</option>
          <option v-for="s in sections" :key="s.path.join('.')" :value="s.path.join('.')">
            {{ s.label }}
          </option>
        </select>
        <span class="text-xs text-gr-text-muted">
          Nest under an existing category, or leave as a top-level category.
        </span>
      </label>
    </div>

    <template #footer>
      <Button variant="secondary" @click="emit('cancel')">Cancel</Button>
      <Button variant="primary" :disabled="!canAdd" @click="onConfirm">Add category</Button>
    </template>
  </Dialog>
</template>
