<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineProps<{
  title: string
  subtitle?: string
  hint?: string
  expanded: boolean
  stub?: boolean
}>()

defineEmits<{
  toggle: []
}>()
</script>

<template>
  <section
    class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
  >
    <button
      type="button"
      class="flex w-full items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100/80"
      :class="expanded ? 'border-b-slate-100' : 'border-b-transparent'"
      :aria-expanded="expanded"
      @click="$emit('toggle')"
    >
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="font-semibold text-slate-900">{{ title }}</h2>
          <span
            v-if="stub"
            class="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-slate-600 uppercase"
            >Coming soon</span
          >
        </div>
        <p v-if="subtitle" class="mt-0.5 text-xs text-slate-500">{{ subtitle }}</p>
        <p v-if="hint" class="mt-0.5 text-xs text-slate-500">{{ hint }}</p>
      </div>
      <Icon
        :icon="expanded ? 'tabler:chevron-up' : 'tabler:chevron-down'"
        class="h-5 w-5 shrink-0 text-slate-500"
        aria-hidden="true"
      />
    </button>
    <div v-if="expanded" class="space-y-3 p-4">
      <slot />
    </div>
  </section>
</template>
