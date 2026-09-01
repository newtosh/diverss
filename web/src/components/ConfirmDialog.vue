<script setup lang="ts">
import { computed } from 'vue'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/ui/Dialog.vue'
import { confirmRequest, resolveConfirm } from '@/lib/confirm'

const open = computed(() => confirmRequest.value !== null)
const message = computed(() => confirmRequest.value?.message ?? '')
const options = computed(() => confirmRequest.value?.options ?? {})

function onUpdateOpen(next: boolean) {
  // Reka's Dialog only emits update:open(false) — on Escape, or (were it
  // enabled) an overlay click — never true; this is always a cancel.
  if (!next) resolveConfirm(false)
}
</script>

<template>
  <Dialog
    :open="open"
    :title="options.title ?? 'Confirm'"
    :description="message"
    elevated
    @update:open="onUpdateOpen"
  >
    <template #footer>
      <Button variant="secondary" @click="resolveConfirm(false)">
        {{ options.cancelLabel ?? 'Cancel' }}
      </Button>
      <Button :variant="options.danger ? 'danger' : 'primary'" @click="resolveConfirm(true)">
        {{ options.confirmLabel ?? 'Confirm' }}
      </Button>
    </template>
  </Dialog>
</template>
