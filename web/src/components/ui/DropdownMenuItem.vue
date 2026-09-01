<script setup lang="ts">
import { computed } from 'vue'
import { DropdownMenuItem, useForwardPropsEmits } from 'reka-ui'

const props = defineProps<{
  disabled?: boolean
  variant?: 'default' | 'danger'
}>()

const emit = defineEmits<{
  select: [event: Event]
}>()

// `variant` is wrapper-local styling, not a Reka UI DropdownMenuItem prop --
// forward only what Reka understands so it doesn't leak onto the DOM node.
const forwarded = useForwardPropsEmits(
  computed(() => ({ disabled: props.disabled })),
  emit,
)
</script>

<template>
  <DropdownMenuItem
    v-bind="forwarded"
    class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
    :class="
      variant === 'danger'
        ? 'text-gr-danger-strong data-[highlighted]:bg-gr-danger/15'
        : 'text-gr-text data-[highlighted]:bg-gr-surface-2'
    "
  >
    <slot />
  </DropdownMenuItem>
</template>
