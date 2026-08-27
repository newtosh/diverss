<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { Icon } from '@iconify/vue'
import OutboxDrawer from '@/components/OutboxDrawer.vue'
import { loadWorkspace, saveWorkspace, workspaceEpoch } from '@/db/workspace'
import type { OpmlDocument } from '@/opml/types'
import { emptyOpmlDocument } from '@/opml/types'
import {
  setOutboxDrawerOpen,
  toggleOutboxDrawer,
} from '@/outbox/store'
import { useOutbox } from '@/outbox/useOutbox'

const { count: outboxCount, drawerOpen: outboxDrawerOpen } = useOutbox()
const workspace = ref<OpmlDocument>(emptyOpmlDocument())

watch(outboxDrawerOpen, async (open) => {
  if (open) {
    workspace.value = await loadWorkspace()
  }
})

watch(workspaceEpoch, async () => {
  workspace.value = await loadWorkspace()
})

async function onOutboxImported(summary: {
  document: OpmlDocument
  added: number
  skippedAlreadyPresent: number
  createdCategories: string[]
}) {
  workspace.value = summary.document
  await saveWorkspace(summary.document)
  setOutboxDrawerOpen(false)
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-900">
    <header
      class="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm"
    >
      <div class="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Icon icon="ph:plant-fill" class="h-7 w-7 shrink-0 text-teal-700" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <p class="text-lg font-semibold tracking-tight">GardenRSS</p>
          <p class="text-xs text-slate-500">
            RSS feed manager · prune weeds, keep evergreen
          </p>
        </div>
        <nav class="flex shrink-0 items-center gap-1 text-sm sm:gap-2">
          <RouterLink
            class="rounded px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 sm:px-3"
            active-class="bg-teal-50 text-teal-800"
            to="/"
          >
            Garden
          </RouterLink>
          <RouterLink
            class="rounded px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 sm:px-3"
            active-class="bg-teal-50 text-teal-800"
            to="/catalog"
          >
            Catalog
          </RouterLink>
          <RouterLink
            class="rounded px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 sm:px-3"
            active-class="bg-teal-50 text-teal-800"
            to="/tools"
          >
            Tools
          </RouterLink>
          <button
            type="button"
            class="relative ml-1 rounded px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 sm:ml-2 sm:px-3"
            :class="outboxDrawerOpen ? 'bg-teal-50 text-teal-800' : undefined"
            :aria-expanded="outboxDrawerOpen"
            aria-controls="outbox-drawer"
            @click="toggleOutboxDrawer()"
          >
            Deck
            <span
              v-if="outboxCount > 0"
              class="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-teal-700 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums"
            >
              {{ outboxCount }}
            </span>
          </button>
        </nav>
      </div>
    </header>
    <main class="mx-auto max-w-5xl px-4 py-6">
      <RouterView v-slot="{ Component }">
        <KeepAlive>
          <component :is="Component" />
        </KeepAlive>
      </RouterView>
    </main>
    <OutboxDrawer
      :open="outboxDrawerOpen"
      :document="workspace"
      @close="setOutboxDrawerOpen(false)"
      @imported="onOutboxImported"
    />
  </div>
</template>
