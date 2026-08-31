<script setup lang="ts">
import { computed, onUnmounted, watch } from 'vue'
import Button from '@/components/ui/Button.vue'
import { confirmRequest, resolveConfirm } from '@/lib/confirm'

const open = computed(() => confirmRequest.value !== null)
const message = computed(() => confirmRequest.value?.message ?? '')
const options = computed(() => confirmRequest.value?.options ?? {})

function onKeydown(ev: KeyboardEvent) {
  if (!open.value) return
  if (ev.key === 'Escape') {
    ev.preventDefault()
    resolveConfirm(false)
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    window.addEventListener('keydown', onKeydown)
  } else {
    window.removeEventListener('keydown', onKeydown)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      @click.self="resolveConfirm(false)"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        :aria-labelledby="options.title ? 'confirm-dialog-title' : 'confirm-dialog-message'"
        :aria-describedby="options.title ? 'confirm-dialog-message' : undefined"
        class="flex w-full max-w-sm flex-col overflow-hidden rounded-lg border border-gr-border bg-gr-surface shadow-lg"
      >
        <div class="px-4 py-4">
          <h2
            v-if="options.title"
            id="confirm-dialog-title"
            class="mb-1 text-base font-semibold text-gr-text"
          >
            {{ options.title }}
          </h2>
          <p id="confirm-dialog-message" class="text-sm text-gr-text">
            {{ message }}
          </p>
        </div>

        <div class="flex justify-end gap-2 border-t border-gr-border px-4 py-3">
          <Button variant="secondary" @click="resolveConfirm(false)">
            {{ options.cancelLabel ?? 'Cancel' }}
          </Button>
          <Button
            :variant="options.danger ? 'danger' : 'primary'"
            @click="resolveConfirm(true)"
          >
            {{ options.confirmLabel ?? 'Confirm' }}
          </Button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
