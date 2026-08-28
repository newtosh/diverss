<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import Button from '@/components/ui/Button.vue'
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
    if (open) window.addEventListener('keydown', onKeydown)
    else window.removeEventListener('keydown', onKeydown)
  },
)

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})

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
        aria-labelledby="move-feed-title"
        class="flex w-full max-w-md flex-col overflow-hidden rounded-lg border border-gr-border bg-gr-surface shadow-lg"
      >
        <div class="border-b border-gr-border px-4 py-3">
          <h2 id="move-feed-title" class="text-base font-semibold text-gr-text">
            Move to category
          </h2>
          <p class="mt-0.5 truncate text-sm text-gr-text-muted">
            {{ feedTitle }}
          </p>
        </div>

        <div class="space-y-3 px-4 py-4">
          <label class="block space-y-1">
            <span class="text-sm font-medium text-gr-text">Category</span>
            <select
              v-model="sectionKey"
              class="w-full rounded-md border border-gr-border bg-gr-surface px-3 py-2 text-sm"
            >
              <option value="">Ungrouped (top level)</option>
              <option
                v-for="s in sections"
                :key="s.path.join('.')"
                :value="s.path.join('.')"
              >
                {{ s.label }}
              </option>
            </select>
          </label>
        </div>

        <div class="flex justify-end gap-2 border-t border-gr-border px-4 py-3">
          <Button variant="secondary" @click="emit('cancel')">Cancel</Button>
          <Button variant="primary" :disabled="!canMove" @click="onConfirm">
            {{ bulk ? 'Move feeds' : 'Move feed' }}
          </Button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
