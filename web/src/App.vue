<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { Icon } from '@iconify/vue'
import OutboxDrawer from '@/components/OutboxDrawer.vue'
import { theme, toggleTheme } from '@/lib/theme'
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

const navTabClass =
  'rounded-md border border-transparent px-2.5 py-1.5 font-medium text-gr-text-muted transition-colors hover:border-gr-accent hover:bg-gr-accent/10 hover:text-gr-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gr-accent-strong sm:px-3'
const navTabActiveClass =
  'border-gr-accent-strong bg-gr-accent-strong text-white shadow-sm hover:border-gr-accent-strong hover:bg-gr-accent-strong hover:text-white'

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
  <div class="min-h-screen bg-gr-bg text-gr-text">
    <header
      class="sticky top-0 z-40 border-b border-gr-border bg-gr-surface/95 backdrop-blur-sm"
    >
      <div class="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
        <img src="/brand/favicon-plant.svg" class="h-11 w-11 shrink-0" alt="" />
        <div class="min-w-0 flex-1">
          <p class="text-lg font-semibold tracking-tight">GardenRSS</p>
          <p class="text-xs text-gr-text-muted">
            RSS feed manager · prune weeds, keep evergreen
          </p>
        </div>
        <nav class="flex shrink-0 items-center gap-3 text-sm">
          <div class="flex gap-1 rounded-lg border border-gr-border bg-gr-surface-2/60 p-1">
            <RouterLink :class="navTabClass" :active-class="navTabActiveClass" to="/">
              Garden
            </RouterLink>
            <RouterLink :class="navTabClass" :active-class="navTabActiveClass" to="/catalog">
              Catalog
            </RouterLink>
            <RouterLink :class="navTabClass" :active-class="navTabActiveClass" to="/tools">
              Tools
            </RouterLink>
            <button
              type="button"
              :class="[navTabClass, 'relative', outboxDrawerOpen ? navTabActiveClass : undefined]"
              :aria-expanded="outboxDrawerOpen"
              aria-controls="outbox-drawer"
              @click="toggleOutboxDrawer()"
            >
              Deck
              <span
                v-if="outboxCount > 0"
                class="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-gr-accent-strong px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums"
                :class="outboxDrawerOpen ? 'bg-white/25' : undefined"
              >
                {{ outboxCount }}
              </span>
            </button>
            <div class="mx-0.5 h-5 w-px shrink-0 self-center bg-gr-border" aria-hidden="true" />
            <button
              type="button"
              class="rounded-md border border-transparent p-1.5 text-gr-text-muted transition-colors hover:border-gr-accent hover:bg-gr-accent/10 hover:text-gr-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gr-accent-strong"
              :aria-label="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
              @click="toggleTheme()"
            >
              <Icon :icon="theme === 'dark' ? 'ph:sun-fill' : 'ph:moon-fill'" class="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <a
            href="https://github.com/newtosh/gardenrss"
            target="_blank"
            rel="noopener noreferrer"
            class="flex h-8 w-8 items-center justify-center rounded-full bg-gr-accent-strong text-white transition-[filter] hover:brightness-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gr-accent-strong"
            aria-label="View GardenRSS on GitHub"
            title="View GardenRSS on GitHub"
          >
            <Icon icon="ph:github-logo-fill" class="h-6 w-6" aria-hidden="true" />
          </a>
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
