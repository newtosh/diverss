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

const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    description?: string
    /** Content max-width above the sm breakpoint. */
    size?: 'sm' | 'md' | 'lg' | 'xl' | '3xl'
    /**
     * Stacks above the default tier (z-50) at z-60 -- for dialogs that can
     * open on top of another already-open dialog (e.g. a confirm() prompt
     * triggered from inside a modal), so it's never hidden behind it.
     */
    elevated?: boolean
  }>(),
  {
    size: 'sm',
    elevated: false,
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const forwarded = useForwardPropsEmits(props, emit)

// Literal keys so Tailwind's content scanner sees each full class string.
const sizeClass: Record<'sm' | 'md' | 'lg' | 'xl' | '3xl', string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '3xl': 'sm:max-w-3xl',
}
</script>

<template>
  <DialogRoot v-bind="forwarded">
    <DialogPortal>
      <Transition name="gr-overlay">
        <DialogOverlay
          v-if="open"
          class="fixed inset-0 bg-black/40"
          :class="elevated ? 'z-[60]' : 'z-50'"
        />
      </Transition>
      <Transition name="gr-dialog">
        <DialogContent
          v-if="open"
          class="fixed inset-x-0 bottom-0 flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-lg border border-gr-border bg-gr-surface shadow-lg outline-none sm:inset-0 sm:m-auto sm:h-fit sm:rounded-lg"
          :class="[sizeClass[size], elevated ? 'z-[60]' : 'z-50']"
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
