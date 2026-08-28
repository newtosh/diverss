<script setup lang="ts">
defineProps<{
  readerLabel: string
  connected: boolean
  busy: boolean
}>()

defineEmits<{
  wipe: []
  emptyCategories: []
}>()
</script>

<template>
  <div class="space-y-4" role="tabpanel">
    <p class="text-xs text-gr-text-muted">
      Destructive reader maintenance. Prefer these only when you intend to clear
      or tidy the {{ readerLabel }} instance.
    </p>
    <section class="space-y-2">
      <h3 class="text-sm font-semibold text-gr-text">Feeds</h3>
      <p class="text-xs text-gr-text-muted">
        Remove every subscription on this reader. Export a backup when prompted.
      </p>
      <button
        type="button"
        class="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-800 hover:bg-red-50 disabled:opacity-50"
        :disabled="busy || !connected"
        @click="$emit('wipe')"
      >
        Wipe all feeds…
      </button>
    </section>
    <section class="space-y-2 border-t border-gr-border pt-3">
      <h3 class="text-sm font-semibold text-gr-text">Categories</h3>
      <p class="text-xs text-gr-text-muted">
        Delete categories that no longer contain feeds.
      </p>
      <button
        type="button"
        class="rounded-md border border-gr-border px-3 py-1.5 text-sm hover:bg-gr-surface-2 disabled:opacity-50"
        :disabled="busy || !connected"
        @click="$emit('emptyCategories')"
      >
        Delete empty categories
      </button>
    </section>
  </div>
</template>
