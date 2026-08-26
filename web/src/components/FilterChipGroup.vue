<script setup lang="ts" generic="T extends string">
defineProps<{
  modelValue: T
  options: { id: T; label: string; title?: string }[]
  /** Visible label before chips (omit for unlabeled groups). */
  label?: string
  groupAriaLabel: string
  /** Active chip color — teal for list filters, slate for membership. */
  tone?: 'teal' | 'slate'
  compact?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: T]
}>()
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-1"
    role="group"
    :aria-label="groupAriaLabel"
  >
    <span v-if="label" class="mr-1 text-xs font-medium text-slate-500">{{ label }}</span>
    <button
      v-for="opt in options"
      :key="opt.id"
      type="button"
      class="rounded font-medium transition-colors duration-150"
      :class="[
        compact ? 'px-2 py-0.5 text-xs' : 'px-2 py-1 text-xs',
        modelValue === opt.id
          ? tone === 'slate'
            ? 'bg-slate-800 text-white'
            : 'bg-teal-700 text-white'
          : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50',
      ]"
      :aria-pressed="modelValue === opt.id"
      :title="opt.title"
      @click="$emit('update:modelValue', opt.id)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
