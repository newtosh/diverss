<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { appendFeed } from '@/opml/mutate'
import type { OpmlDocument } from '@/opml/types'
import { emptyOpmlDocument, flattenFeeds } from '@/opml/types'
import { loadWorkspace, saveWorkspace } from '@/db/workspace'

interface DirectoryFeed {
  title: string
  xmlUrl: string
  htmlUrl?: string
  category?: string
}

interface DirectoryFile {
  schemaVersion: number
  feeds: DirectoryFeed[]
}

const directory = ref<DirectoryFile | null>(null)
const workspace = ref<OpmlDocument>(emptyOpmlDocument())
const query = ref('')
const error = ref('')
const status = ref('')
const ready = ref(false)

const filtered = computed(() => {
  const feeds = directory.value?.feeds ?? []
  const q = query.value.trim().toLowerCase()
  if (!q) return feeds
  return feeds.filter(
    (f) =>
      f.title.toLowerCase().includes(q) ||
      f.xmlUrl.toLowerCase().includes(q) ||
      (f.category ?? '').toLowerCase().includes(q),
  )
})

function directoryUrl(): string {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/')
  return `${base}data/directory.json`
}

onMounted(async () => {
  try {
    workspace.value = await loadWorkspace()
    const res = await fetch(directoryUrl())
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    directory.value = (await res.json()) as DirectoryFile
  } catch (e) {
    error.value =
      e instanceof Error
        ? `Could not load catalog (${e.message}).`
        : 'Could not load catalog.'
  } finally {
    ready.value = true
  }
})

async function addFeed(feed: DirectoryFeed) {
  error.value = ''
  const existing = new Set(flattenFeeds(workspace.value.outlines).map((f) => f.xmlUrl))
  if (existing.has(feed.xmlUrl)) {
    status.value = 'Already in workspace.'
    return
  }
  workspace.value = appendFeed(workspace.value, {
    text: feed.title,
    xmlUrl: feed.xmlUrl,
    htmlUrl: feed.htmlUrl,
  })
  await saveWorkspace(workspace.value)
  status.value = `Added “${feed.title}” to workspace.`
}

function alternatives(feed: DirectoryFeed): DirectoryFeed[] {
  if (!feed.category || !directory.value) return []
  return directory.value.feeds.filter(
    (f) => f.category === feed.category && f.xmlUrl !== feed.xmlUrl,
  ).slice(0, 3)
}
</script>

<template>
  <section v-if="ready" class="space-y-6">
    <div class="space-y-1">
      <h1 class="text-xl font-semibold">Catalog</h1>
      <p class="text-sm text-slate-600">
        Thin curated directory — add feeds into your OPML workspace.
      </p>
    </div>

    <label class="block max-w-md space-y-1">
      <span class="text-sm font-medium text-slate-700">Filter</span>
      <input
        v-model="query"
        type="search"
        class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        placeholder="Title, URL, or category"
      />
    </label>

    <p v-if="error" class="text-sm text-red-700" role="alert">{{ error }}</p>
    <p v-if="status" class="text-sm text-teal-800">{{ status }}</p>

    <div v-if="!directory || filtered.length === 0" class="text-sm text-slate-500">
      No catalog feeds match.
    </div>

    <ul v-else class="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
      <li v-for="feed in filtered" :key="feed.xmlUrl" class="space-y-2 px-3 py-3">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0">
            <p class="text-sm font-medium text-slate-900">{{ feed.title }}</p>
            <p class="truncate text-xs text-slate-500">{{ feed.xmlUrl }}</p>
            <p v-if="feed.category" class="text-xs text-slate-400">{{ feed.category }}</p>
          </div>
          <button
            type="button"
            class="rounded-md border border-teal-700 px-3 py-1.5 text-sm text-teal-800 hover:bg-teal-50"
            @click="addFeed(feed)"
          >
            Add to workspace
          </button>
        </div>
        <p
          v-if="alternatives(feed).length"
          class="text-xs text-slate-500"
        >
          Alternatives:
          {{ alternatives(feed).map((a) => a.title).join(' · ') }}
        </p>
      </li>
    </ul>
  </section>
  <p v-else class="text-sm text-slate-500">Loading catalog…</p>
</template>
