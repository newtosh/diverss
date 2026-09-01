<script setup lang="ts">
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
  useForwardPropsEmits,
} from 'reka-ui'

const props = defineProps<{
  open?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const forwarded = useForwardPropsEmits(props, emit)
</script>

<template>
  <PopoverRoot v-bind="forwarded">
    <PopoverTrigger as-child>
      <slot name="trigger" />
    </PopoverTrigger>
    <PopoverPortal>
      <Transition name="gr-popover">
        <PopoverContent
          :side-offset="4"
          class="z-[60] rounded-md border border-gr-border bg-gr-surface p-3 shadow-lg outline-none"
        >
          <slot />
        </PopoverContent>
      </Transition>
    </PopoverPortal>
  </PopoverRoot>
</template>
