<script setup lang="ts" generic="T extends string">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import Popover from '@/components/ui/Popover.vue'

const props = withDefaults(
  defineProps<{
    modelValue: T[]
    options: { id: T; label: string; title?: string }[]
    /** Visible label before the trigger (omit for unlabeled groups). */
    label?: string
    groupAriaLabel: string
    /** false = pick at most one; selecting an option closes the popover. */
    multiple?: boolean
  }>(),
  { multiple: true },
)

const emit = defineEmits<{
  'update:modelValue': [value: T[]]
}>()

const open = ref(false)

function isChecked(id: T): boolean {
  return props.modelValue.includes(id)
}

function select(id: T) {
  if (props.multiple) {
    emit(
      'update:modelValue',
      isChecked(id)
        ? props.modelValue.filter((v) => v !== id)
        : [...props.modelValue, id],
    )
    return
  }
  emit('update:modelValue', isChecked(id) ? [] : [id])
  open.value = false
}

function clear() {
  emit('update:modelValue', [])
  if (!props.multiple) open.value = false
}

const triggerLabel = computed(() => {
  if (props.modelValue.length === 0) return 'All'
  if (props.modelValue.length === 1) {
    const id = props.modelValue[0]
    return props.options.find((o) => o.id === id)?.label ?? id
  }
  return `${props.modelValue.length} selected`
})
</script>

<template>
  <div class="inline-flex items-center gap-1.5">
    <span v-if="label" class="text-xs font-medium text-gr-text-muted">{{ label }}</span>
    <Popover v-model:open="open">
      <template #trigger>
        <button
          type="button"
          class="inline-flex w-40 items-center justify-between gap-1.5 rounded-md border border-gr-border bg-gr-surface px-2.5 py-1 text-xs font-medium text-gr-text hover:bg-gr-surface-2"
          :aria-label="groupAriaLabel"
        >
          <span class="min-w-0 truncate">{{ triggerLabel }}</span>
          <Icon
            icon="tabler:chevron-down"
            class="h-3.5 w-3.5 shrink-0 text-gr-text-muted"
            aria-hidden="true"
          />
        </button>
      </template>
      <div class="w-56 space-y-0.5" role="group" :aria-label="groupAriaLabel">
        <button
          v-if="!multiple"
          type="button"
          class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-gr-surface-2"
          @click="clear"
        >
          <span
            class="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors"
            :class="
              modelValue.length === 0
                ? 'border-gr-accent-strong bg-gr-accent-strong text-gr-on-accent'
                : 'border-gr-border text-transparent'
            "
          >
            <Icon icon="tabler:check" class="h-3 w-3" aria-hidden="true" />
          </span>
          <span class="min-w-0 flex-1 truncate text-gr-text">All</span>
        </button>
        <button
          v-for="opt in options"
          :key="opt.id"
          type="button"
          class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-gr-surface-2"
          :title="opt.title"
          @click="select(opt.id)"
        >
          <span
            class="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors"
            :class="
              isChecked(opt.id)
                ? 'border-gr-accent-strong bg-gr-accent-strong text-gr-on-accent'
                : 'border-gr-border text-transparent'
            "
          >
            <Icon icon="tabler:check" class="h-3 w-3" aria-hidden="true" />
          </span>
          <span class="min-w-0 flex-1 truncate text-gr-text">{{ opt.label }}</span>
        </button>
        <button
          v-if="multiple && modelValue.length"
          type="button"
          class="mt-1 w-full rounded px-2 py-1.5 text-left text-xs font-medium text-gr-text-muted hover:bg-gr-surface-2 hover:text-gr-text"
          @click="clear"
        >
          Clear selection
        </button>
      </div>
    </Popover>
  </div>
</template>
