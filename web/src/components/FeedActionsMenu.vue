<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import Button from '@/components/ui/Button.vue'

defineProps<{
  fixOpen?: boolean
  suggestionCount?: number
}>()

const emit = defineEmits<{
  editTitle: []
  moveCategory: []
  toggleFixUrl: []
  delete: []
}>()

const open = ref(false)
const trigger = ref<InstanceType<typeof Button> | null>(null)
const menu = ref<HTMLElement | null>(null)
const pos = ref({ top: 0, left: 0 })
const gap = 4
const edge = 8

function close() {
  open.value = false
}

function placeMenu() {
  const el = trigger.value?.$el as HTMLElement | undefined
  const panel = menu.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const width = panel?.offsetWidth || 192
  const height = panel?.offsetHeight || 180
  const left = Math.min(
    Math.max(edge, r.right - width),
    window.innerWidth - width - edge,
  )
  const spaceBelow = window.innerHeight - r.bottom - edge
  const spaceAbove = r.top - edge
  const preferUp = spaceBelow < height + gap && spaceAbove > spaceBelow
  const top = preferUp
    ? Math.max(edge, r.top - height - gap)
    : Math.min(r.bottom + gap, window.innerHeight - height - edge)
  pos.value = { top, left }
}

async function toggle() {
  if (open.value) {
    close()
    return
  }
  open.value = true
  await nextTick()
  placeMenu()
  // Re-measure after paint in case content height differs from estimate.
  requestAnimationFrame(() => placeMenu())
}

function onDocPointer(ev: PointerEvent) {
  if (!open.value) return
  const t = ev.target as Node
  const triggerEl = trigger.value?.$el as HTMLElement | undefined
  if (triggerEl?.contains(t) || menu.value?.contains(t)) return
  close()
}

function onKey(ev: KeyboardEvent) {
  if (!open.value) return
  if (ev.key === 'Escape') {
    ev.preventDefault()
    close()
  }
}

function onReposition() {
  if (open.value) placeMenu()
}

watch(open, (isOpen) => {
  if (isOpen) {
    window.addEventListener('pointerdown', onDocPointer, true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
  } else {
    window.removeEventListener('pointerdown', onDocPointer, true)
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('resize', onReposition)
    window.removeEventListener('scroll', onReposition, true)
  }
})

onUnmounted(() => {
  window.removeEventListener('pointerdown', onDocPointer, true)
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', onReposition)
  window.removeEventListener('scroll', onReposition, true)
})

function run(action: () => void) {
  close()
  action()
}
</script>

<template>
  <div class="shrink-0">
    <Button
      ref="trigger"
      variant="ghost"
      icon-only
      :aria-expanded="open"
      aria-haspopup="menu"
      aria-label="Feed actions"
      @click="toggle"
    >
      <Icon icon="tabler:dots-vertical" class="h-4 w-4" aria-hidden="true" />
    </Button>
    <Teleport to="body">
      <div
        v-if="open"
        ref="menu"
        role="menu"
        class="fixed z-50 w-48 overflow-hidden rounded-md border border-gr-border bg-gr-surface py-1 shadow-lg"
        :style="{ top: `${pos.top}px`, left: `${pos.left}px` }"
      >
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gr-text hover:bg-gr-surface-2"
          @click="run(() => emit('editTitle'))"
        >
          <Icon icon="tabler:pencil" class="h-4 w-4 text-gr-text-muted" aria-hidden="true" />
          Edit title
        </button>
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gr-text hover:bg-gr-surface-2"
          @click="run(() => emit('moveCategory'))"
        >
          <Icon
            icon="tabler:folder-symlink"
            class="h-4 w-4 text-gr-text-muted"
            aria-hidden="true"
          />
          Move to category…
        </button>
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gr-text hover:bg-gr-surface-2"
          @click="run(() => emit('toggleFixUrl'))"
        >
          <Icon
            icon="tabler:link"
            class="h-4 w-4 text-gr-text-muted"
            aria-hidden="true"
          />
          {{ fixOpen ? 'Hide fix URL' : 'Fix URL' }}
          <span
            v-if="!fixOpen && (suggestionCount ?? 0) > 0"
            class="ml-auto tabular-nums text-xs text-gr-text-muted"
          >
            {{ suggestionCount }}
          </span>
        </button>
        <div class="my-1 border-t border-gr-border" role="separator" />
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-red-700 hover:bg-red-50"
          @click="run(() => emit('delete'))"
        >
          <Icon icon="tabler:trash" class="h-4 w-4" aria-hidden="true" />
          Delete
        </button>
      </div>
    </Teleport>
  </div>
</template>
