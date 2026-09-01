<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    variant: 'primary' | 'secondary' | 'danger' | 'ghost'
    size?: 'sm' | 'md'
    iconOnly?: boolean
    disabled?: boolean
    /** Shows a spinner and disables the button for an in-flight action. */
    loading?: boolean
  }>(),
  {
    size: 'md',
    iconOnly: false,
    disabled: false,
    loading: false,
  },
)

const variantClass: Record<typeof props.variant, string> = {
  primary:
    'border-gr-accent-strong bg-gr-accent-strong text-gr-on-accent hover:brightness-90',
  secondary:
    'border-gr-text-muted/40 bg-gr-surface-2 text-gr-text shadow-sm hover:bg-gr-border/60',
  danger:
    'border-gr-danger-strong bg-gr-danger-strong text-gr-on-accent hover:brightness-90',
  ghost:
    'border-transparent text-gr-text-muted hover:bg-gr-surface-2 hover:text-gr-text',
}

const sizeClass: Record<'sm' | 'md', string> = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5',
  md: 'px-3 py-2 text-sm gap-1.5',
}

// sm matches sizeClass.sm's py-1.5 exactly (plus a 16px/text-xs-line-height
// icon) so an icon-only sm button is the same height as a label sm button
// sitting next to it -- no independent floor to drift out of sync.
const iconOnlySizeClass: Record<'sm' | 'md', string> = {
  sm: 'p-1.5',
  md: 'p-2 min-h-10 min-w-10',
}

const classes = computed(() => [
  'inline-flex items-center justify-center rounded-md border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gr-accent-strong',
  variantClass[props.variant],
  props.iconOnly ? iconOnlySizeClass[props.size] : sizeClass[props.size],
])
</script>

<template>
  <button
    type="button"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    :class="classes"
  >
    <svg
      v-if="loading"
      class="motion-safe:animate-spin size-4 shrink-0"
      :class="{ '-ml-0.5 mr-1.5': !iconOnly }"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z"
      />
    </svg>
    <slot v-if="!(loading && iconOnly)" />
  </button>
</template>
