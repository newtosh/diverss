<script setup lang="ts">
export type ReaderPanelTabId = 'connection' | 'filters' | 'admin'

defineProps<{
  modelValue: ReaderPanelTabId
}>()

const emit = defineEmits<{
  'update:modelValue': [ReaderPanelTabId]
}>()

const tabs: { id: ReaderPanelTabId; label: string }[] = [
  { id: 'connection', label: 'Connection' },
  { id: 'filters', label: 'Filters' },
  { id: 'admin', label: 'Admin' },
]

function tabClass(selected: boolean) {
  return [
    'min-w-0 flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-700',
    selected
      ? 'border-teal-800 bg-teal-700 text-white shadow-sm'
      : 'border-slate-400 bg-white text-slate-800 hover:border-teal-600 hover:bg-teal-50 hover:text-teal-950 active:border-teal-700 active:bg-teal-100',
  ]
}
</script>

<template>
  <div
    class="-mx-4 -mt-4 mb-3 border-b border-slate-200 bg-slate-100 px-3 py-2"
    role="tablist"
    aria-label="Reader panel sections"
  >
    <div class="flex gap-1.5">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        role="tab"
        :class="tabClass(modelValue === tab.id)"
        :aria-selected="modelValue === tab.id"
        @click="emit('update:modelValue', tab.id)"
      >
        {{ tab.label }}
      </button>
    </div>
  </div>
</template>
