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
    <span v-if="label" class="mr-1 text-xs font-medium text-gr-text-muted">{{ label }}</span>
    <button
      v-for="opt in options"
      :key="opt.id"
      type="button"
      class="rounded font-medium transition-colors duration-150"
      :class="[
        compact ? 'px-2 py-0.5 text-xs' : 'px-2 py-1 text-xs',
        modelValue === opt.id
          ? tone === 'slate'
            ? 'bg-gr-text text-white'
            : 'bg-gr-accent-strong text-white'
          : 'bg-gr-surface text-gr-text ring-1 ring-gr-border hover:bg-gr-surface-2',
      ]"
      :aria-pressed="modelValue === opt.id"
      :title="opt.title"
      @click="$emit('update:modelValue', opt.id)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
