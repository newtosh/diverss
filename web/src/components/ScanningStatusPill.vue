<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string
  }>(),
  { label: 'Scanning…' },
)
</script>

<template>
  <span
    class="relative inline-flex overflow-hidden rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-900 ring-1 ring-inset ring-sky-200"
    role="status"
    aria-live="polite"
  >
    <span class="relative z-10">{{ label }}</span>
    <span
      class="animate-scan-shimmer pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-sky-300/40 to-transparent"
      aria-hidden="true"
    />
  </span>
</template>
