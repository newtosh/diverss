<script setup lang="ts">
import { DropdownMenuItem, useForwardPropsEmits } from 'reka-ui'

const props = defineProps<{
  disabled?: boolean
  variant?: 'default' | 'danger'
}>()

const emit = defineEmits<{
  select: [event: Event]
}>()

const forwarded = useForwardPropsEmits(props, emit)
</script>

<template>
  <DropdownMenuItem
    v-bind="forwarded"
    class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-gr-text outline-none data-[highlighted]:bg-gr-surface-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
    :class="variant === 'danger' ? 'text-gr-danger-strong' : ''"
  >
    <slot />
  </DropdownMenuItem>
</template>
