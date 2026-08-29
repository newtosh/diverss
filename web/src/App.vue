<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { Icon } from '@iconify/vue'
import { Analytics } from '@vercel/analytics/vue'
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
  'inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-1 text-xs font-medium text-gr-text-muted transition-colors hover:border-gr-accent hover:bg-gr-accent/10 hover:text-gr-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gr-accent-strong sm:flex-none sm:px-3 sm:py-1.5 sm:text-sm'
const navTabActiveClass =
  'border-gr-accent-strong bg-gr-accent-strong !text-gr-on-accent shadow-sm hover:!border-gr-accent-strong hover:!bg-gr-accent-strong hover:!text-gr-on-accent'

watch(outboxDrawerOpen, async (open) => {
  if (open) {
    workspace.value = await loadWorkspace()
  }
})

watch(workspaceEpoch, async () => {
  workspace.value = await loadWorkspace()
})

const headerEl = ref<HTMLElement | null>(null)
let headerResizeObserver: ResizeObserver | undefined

function syncHeaderHeight() {
  if (headerEl.value) {
    document.documentElement.style.setProperty('--app-header-h', `${headerEl.value.offsetHeight}px`)
  }
}

onMounted(() => {
  syncHeaderHeight()
  if (typeof ResizeObserver === 'undefined') return
  headerResizeObserver = new ResizeObserver(syncHeaderHeight)
  if (headerEl.value) headerResizeObserver.observe(headerEl.value)
})

onBeforeUnmount(() => {
  headerResizeObserver?.disconnect()
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
      ref="headerEl"
      class="sticky top-0 z-40 border-b border-gr-border/50 bg-gr-surface/95 pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] backdrop-blur-sm"
    >
      <div class="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-3">
        <img src="/brand/favicon-plant.svg" class="h-8 w-8 shrink-0 sm:h-11 sm:w-11" alt="" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-lg font-semibold tracking-tight">GardenRSS</p>
          <p class="hidden text-xs text-gr-text-muted sm:block">
            RSS feed manager · prune weeds, keep evergreen
          </p>
        </div>
        <div class="order-1 flex shrink-0 items-center gap-1.5 sm:order-3">
          <button
            type="button"
            class="inline-flex shrink-0 rounded-md border border-transparent p-1.5 text-gr-text-muted transition-colors hover:border-gr-accent hover:bg-gr-accent/10 hover:text-gr-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gr-accent-strong"
            :aria-label="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
            @click="toggleTheme()"
          >
            <Icon :icon="theme === 'dark' ? 'ph:sun-fill' : 'ph:moon-fill'" class="h-5 w-5" aria-hidden="true" />
          </button>
          <a
            href="https://github.com/newtosh/gardenrss"
            target="_blank"
            rel="noopener noreferrer"
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent text-gr-text-muted transition-colors hover:border-gr-accent hover:bg-gr-accent/10 hover:text-gr-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gr-accent-strong"
            aria-label="View GardenRSS on GitHub"
            title="View GardenRSS on GitHub"
          >
            <Icon icon="ph:github-logo" class="h-5 w-5" aria-hidden="true" />
          </a>
        </div>
        <nav
          class="order-2 flex w-full min-w-0 gap-0.5 rounded-lg border border-gr-border bg-gr-surface-2/60 p-0.5 text-sm sm:w-auto sm:gap-1 sm:p-1"
        >
          <RouterLink :class="navTabClass" :active-class="navTabActiveClass" to="/">
            <Icon icon="tabler:plant-2" class="h-4 w-4" aria-hidden="true" />
            Garden
          </RouterLink>
          <RouterLink :class="navTabClass" :active-class="navTabActiveClass" to="/catalog">
            <Icon icon="tabler:list-search" class="h-4 w-4" aria-hidden="true" />
            Catalog
          </RouterLink>
          <RouterLink :class="navTabClass" :active-class="navTabActiveClass" to="/tools">
            <Icon icon="tabler:tool" class="h-4 w-4" aria-hidden="true" />
            Tools
          </RouterLink>
          <button
            type="button"
            :class="[navTabClass, 'relative', outboxDrawerOpen ? navTabActiveClass : undefined]"
            :aria-expanded="outboxDrawerOpen"
            aria-controls="outbox-drawer"
            @click="toggleOutboxDrawer()"
          >
            <Icon icon="tabler:layout-list" class="h-4 w-4" aria-hidden="true" />
            Deck
            <span
              v-if="outboxCount > 0"
              class="ml-1 inline-flex min-w-4 items-center justify-center rounded-full bg-gr-accent-strong px-1 py-0.5 text-[9px] font-semibold text-gr-on-accent tabular-nums sm:ml-1.5 sm:min-w-5 sm:px-1.5 sm:text-[10px]"
              :class="outboxDrawerOpen ? 'bg-gr-bg/20' : undefined"
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
    <Analytics />
  </div>
</template>
