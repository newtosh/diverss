<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { Icon } from '@iconify/vue'
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-900">
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Icon icon="tabler:scuba-mask" class="h-7 w-7 text-teal-700" aria-hidden="true" />
        <div class="flex-1">
          <p class="text-lg font-semibold tracking-tight">DiveRSS</p>
          <p class="text-xs text-slate-500">OPML workspace · not a reader</p>
        </div>
        <nav class="flex gap-2 text-sm">
          <RouterLink
            class="rounded px-3 py-1.5 text-slate-600 hover:bg-slate-100"
            active-class="bg-teal-50 text-teal-800"
            to="/"
          >
            Workspace
          </RouterLink>
          <RouterLink
            class="rounded px-3 py-1.5 text-slate-600 hover:bg-slate-100"
            active-class="bg-teal-50 text-teal-800"
            to="/catalog"
          >
            Catalog
          </RouterLink>
        </nav>
      </div>
    </header>
    <main class="mx-auto max-w-5xl px-4 py-6">
      <RouterView />
    </main>
  </div>
</template>
