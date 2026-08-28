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
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gr-accent-strong',
    selected
      ? 'border-gr-accent-strong bg-gr-accent-strong text-gr-on-accent shadow-sm'
      : 'border-gr-border bg-gr-surface text-gr-text hover:border-gr-accent-strong hover:bg-gr-accent/10 hover:text-gr-accent-strong active:border-gr-accent-strong active:bg-gr-accent/20',
  ]
}
</script>

<template>
  <div
    class="-mx-4 -mt-4 mb-3 border-b border-gr-border bg-gr-surface-2 px-3 py-2"
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
