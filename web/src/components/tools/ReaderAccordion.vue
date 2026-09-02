<script setup lang="ts">
import { Icon } from '@iconify/vue'
import {
  AccordionContent,
  AccordionHeader,
  AccordionItem,
  AccordionTrigger,
} from 'reka-ui'
import { SIGNAL_DOT, SIGNAL_LABEL, type StatusSignal } from '@/lib/statusSignal'

defineProps<{
  value: string
  title: string
  subtitle?: string
  hint?: string
  stub?: boolean
  /** Connection health dot — omit for sections with no connection state. */
  signal?: StatusSignal
}>()
</script>

<template>
  <AccordionItem
    :value="value"
    class="overflow-hidden rounded-lg border border-gr-border bg-gr-surface shadow-sm"
  >
    <AccordionHeader as-child>
      <AccordionTrigger
        class="group flex w-full items-center gap-3 border-b border-transparent bg-gr-surface-2 px-4 py-3 text-left transition-colors hover:bg-gr-surface-2/80 data-[state=open]:border-b-gr-border"
      >
        <span
          v-if="signal"
          class="inline-block h-2 w-2 shrink-0 rounded-full"
          :class="SIGNAL_DOT[signal]"
          :title="SIGNAL_LABEL[signal]"
          aria-hidden="true"
        />
        <span v-if="signal" class="sr-only">{{ SIGNAL_LABEL[signal] }}.</span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="font-semibold text-gr-text">{{ title }}</h2>
            <span
              v-if="stub"
              class="rounded bg-gr-surface-2 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-gr-text-muted uppercase"
              >Coming soon</span
            >
          </div>
          <p v-if="subtitle" class="mt-0.5 text-xs text-gr-text-muted">{{ subtitle }}</p>
          <p v-if="hint" class="mt-0.5 text-xs text-gr-text-muted">{{ hint }}</p>
        </div>
        <Icon
          icon="tabler:chevron-down"
          class="h-5 w-5 shrink-0 text-gr-text-muted transition-transform duration-200 group-data-[state=open]:rotate-180"
          aria-hidden="true"
        />
      </AccordionTrigger>
    </AccordionHeader>
    <AccordionContent
      class="overflow-hidden motion-safe:data-[state=open]:animate-accordion-down motion-safe:data-[state=closed]:animate-accordion-up"
    >
      <div class="space-y-3 p-4">
        <slot />
      </div>
    </AccordionContent>
  </AccordionItem>
</template>
