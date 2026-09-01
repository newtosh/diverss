<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  useForwardPropsEmits,
} from 'reka-ui'

const props = defineProps<{
  open: boolean
  title?: string
  description?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const forwarded = useForwardPropsEmits(props, emit)
</script>

<template>
  <DialogRoot v-bind="forwarded">
    <DialogPortal>
      <Transition name="gr-overlay">
        <DialogOverlay v-if="open" class="fixed inset-0 z-[60] bg-black/40" />
      </Transition>
      <Transition name="gr-dialog">
        <DialogContent
          v-if="open"
          class="fixed inset-x-0 bottom-0 z-[60] flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-lg border border-gr-border bg-gr-surface shadow-lg outline-none sm:inset-0 sm:m-auto sm:h-fit sm:max-w-sm sm:rounded-lg"
        >
          <div class="flex-1 overflow-y-auto px-4 py-4">
            <DialogTitle v-if="title" class="mb-1 text-base font-semibold text-gr-text">
              {{ title }}
            </DialogTitle>
            <DialogDescription v-if="description" class="text-sm text-gr-text-muted">
              {{ description }}
            </DialogDescription>
            <slot />
          </div>
          <div
            v-if="$slots.footer"
            class="flex justify-end gap-2 border-t border-gr-border px-4 py-3"
          >
            <slot name="footer" />
          </div>
          <DialogClose class="sr-only">Close</DialogClose>
        </DialogContent>
      </Transition>
    </DialogPortal>
  </DialogRoot>
</template>
