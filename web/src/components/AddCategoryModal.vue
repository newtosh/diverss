<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
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
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      role="presentation"
      @click.self="emit('cancel')"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-category-title"
        class="flex w-full max-w-lg flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
      >
        <div class="border-b border-slate-100 px-4 py-3">
          <h2 id="add-category-title" class="text-base font-semibold text-slate-900">
            Add a category
          </h2>
          <p class="mt-0.5 text-sm text-slate-600">
            Creates an OPML category you can group feeds under.
          </p>
        </div>

        <div class="space-y-4 px-4 py-4">
          <label class="block space-y-1">
            <span class="text-sm font-medium text-slate-700">Name</span>
            <input
              v-model="name"
              type="text"
              class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="e.g. Apple, News, Gadgets"
              autocomplete="off"
              @keydown.enter.prevent="onConfirm"
            />
            <span class="text-xs text-slate-500">
              Shown as a category heading in your workspace and exported OPML.
            </span>
          </label>

          <label class="block space-y-1">
            <span class="text-sm font-medium text-slate-700">Parent category</span>
            <select
              v-model="parentKey"
              class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">None (top level)</option>
              <option
                v-for="s in sections"
                :key="s.path.join('.')"
                :value="s.path.join('.')"
              >
                {{ s.label }}
              </option>
            </select>
            <span class="text-xs text-slate-500">
              Nest under an existing category, or leave as a top-level category.
            </span>
          </label>
        </div>

        <div class="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            @click="emit('cancel')"
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
            :disabled="!canAdd"
            @click="onConfirm"
          >
            Add category
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
