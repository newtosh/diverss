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
  /**
   * 'chips' (default) — individually bordered, wraps naturally. Right shape
   * for variable-length/variable-count option sets (categories, membership).
   * 'segmented' — single pill-track control, active option lifts on a
   * surface tile. Right shape only for a few short, fixed options (health,
   * ping window) — don't use for option sets that can grow long or wrap.
   */
  variant?: 'chips' | 'segmented'
}>()

defineEmits<{
  'update:modelValue': [value: T]
}>()
</script>

<template>
  <div
    v-if="variant === 'segmented'"
    class="inline-flex items-center gap-0.5 rounded-lg bg-gr-surface-2 p-0.5"
    role="group"
    :aria-label="groupAriaLabel"
  >
    <button
      v-for="opt in options"
      :key="opt.id"
      type="button"
      class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150"
      :class="
        modelValue === opt.id
          ? 'bg-gr-surface text-gr-text shadow-[var(--shadow-gr-raised)]'
          : 'text-gr-text-muted hover:text-gr-text'
      "
      :aria-pressed="modelValue === opt.id"
      :title="opt.title"
      @click="$emit('update:modelValue', opt.id)"
    >
      {{ opt.label }}
    </button>
  </div>
  <div
    v-else
    class="flex flex-wrap items-center gap-1"
    role="group"
    :aria-label="groupAriaLabel"
  >
    <span
      v-if="label"
      class="w-20 shrink-0 text-xs font-medium text-gr-text-muted"
      >{{ label }}</span
    >
    <button
      v-for="opt in options"
      :key="opt.id"
      type="button"
      class="rounded font-medium transition-colors duration-150"
      :class="[
        compact ? 'px-2 py-0.5 text-xs' : 'px-2 py-1 text-xs',
        modelValue === opt.id
          ? tone === 'slate'
            ? 'bg-gr-text text-gr-on-accent'
            : 'bg-gr-accent-strong text-gr-on-accent'
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
