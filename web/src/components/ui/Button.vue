<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    variant: 'primary' | 'secondary' | 'danger' | 'ghost'
    size?: 'sm' | 'md'
    iconOnly?: boolean
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
  }>(),
  {
    size: 'md',
    iconOnly: false,
    disabled: false,
    type: 'button',
  },
)

const variantClass: Record<typeof props.variant, string> = {
  primary:
    'border-gr-accent-strong bg-gr-accent-strong text-white hover:brightness-90',
  secondary: 'border-gr-border bg-gr-surface hover:bg-gr-surface-2',
  danger:
    'border-gr-danger-strong bg-gr-danger-strong text-white hover:brightness-90',
  ghost:
    'border-transparent text-gr-text-muted hover:bg-gr-surface-2 hover:text-gr-text',
}

const sizeClass: Record<'sm' | 'md', string> = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5',
  md: 'px-3 py-2 text-sm gap-1.5',
}

const iconOnlySizeClass: Record<'sm' | 'md', string> = {
  sm: 'p-1.5 min-h-10 min-w-10',
  md: 'p-2 min-h-10 min-w-10',
}

const iconSizeClass: Record<'sm' | 'md', string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
}

const classes = computed(() => [
  'inline-flex items-center justify-center rounded-md border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gr-accent-strong',
  variantClass[props.variant],
  props.iconOnly ? iconOnlySizeClass[props.size] : sizeClass[props.size],
])
</script>

<template>
  <button :type="type" :disabled="disabled" :class="classes">
    <span v-if="$slots.icon" :class="['inline-flex shrink-0', iconSizeClass[size]]">
      <slot name="icon" />
    </span>
    <slot />
  </button>
</template>
