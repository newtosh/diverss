<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import OutlineList from '@/components/OutlineList.vue'
import { parseOpml, OpmlParseError } from '@/opml/parse'
import { serializeOpml } from '@/opml/serialize'
import {
  appendFeed,
  removeAtPath,
  setDocumentTitle,
  updateFeedText,
  type OutlinePath,
} from '@/opml/mutate'
import type { OpmlDocument } from '@/opml/types'
import { emptyOpmlDocument, flattenFeeds } from '@/opml/types'
import { loadWorkspace, saveWorkspace } from '@/db/workspace'
import { scoreUrls, scoreWorkerUrl, type ScoreResult } from '@/score/client'

const workspace = ref<OpmlDocument>(emptyOpmlDocument())
const ready = ref(false)
const error = ref('')
const status = ref('')
const editingPath = ref<string | null>(null)
const editDraft = ref('')
const newTitle = ref('')
const newUrl = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const scores = ref<Record<string, ScoreResult>>({})
const scoring = ref(false)

const feedCount = computed(() => flattenFeeds(workspace.value.outlines).length)
const canScore = computed(() => Boolean(scoreWorkerUrl()) && feedCount.value > 0)

async function persist() {
  await saveWorkspace(workspace.value)
}

onMounted(async () => {
  try {
    workspace.value = await loadWorkspace()
  } catch {
    error.value = 'Could not load saved workspace.'
  } finally {
    ready.value = true
  }
})

watch(
  workspace,
  () => {
    if (!ready.value) return
    void persist()
  },
  { deep: true },
)

function pathKey(path: OutlinePath): string {
  return path.join('.')
}

async function onFileSelected(ev: Event) {
  error.value = ''
  status.value = ''
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    workspace.value = parseOpml(text)
    scores.value = {}
    status.value = `Imported ${flattenFeeds(workspace.value.outlines).length} feed(s).`
  } catch (e) {
    error.value =
      e instanceof OpmlParseError ? e.message : 'Failed to import OPML.'
  } finally {
    input.value = ''
  }
}

function startEdit(path: OutlinePath, current: string) {
  editingPath.value = pathKey(path)
  editDraft.value = current
}

function commitEdit(path: OutlinePath) {
  const next = editDraft.value.trim()
  if (next) {
    workspace.value = updateFeedText(workspace.value, path, next)
  }
  editingPath.value = null
}

function prune(path: OutlinePath) {
  workspace.value = removeAtPath(workspace.value, path)
  status.value = 'Feed removed.'
}

function onAppend(ev: Event) {
  ev.preventDefault()
  error.value = ''
  const title = newTitle.value.trim()
  const url = newUrl.value.trim()
  if (!title || !url) {
    error.value = 'Title and feed URL are required.'
    return
  }
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('bad protocol')
    }
  } catch {
    error.value = 'Feed URL must be http(s).'
    return
  }
  workspace.value = appendFeed(workspace.value, { text: title, xmlUrl: url })
  newTitle.value = ''
  newUrl.value = ''
  status.value = 'Feed added.'
}

function onTitleBlur() {
  workspace.value = setDocumentTitle(workspace.value, workspace.value.title)
}

function exportOpml() {
  error.value = ''
  const xml = serializeOpml(workspace.value)
  const blob = new Blob([xml], { type: 'text/xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = window.document.createElement('a')
  a.href = url
  a.download = 'diverss-export.opml'
  a.click()
  URL.revokeObjectURL(url)
  status.value = 'Exported OPML (Score not required).'
}

async function runScore() {
  error.value = ''
  if (!scoreWorkerUrl()) {
    error.value = 'Score Worker URL is not configured (VITE_SCORE_URL). Export still works.'
    return
  }
  const urls = flattenFeeds(workspace.value.outlines).map((f) => f.xmlUrl)
  if (urls.length === 0) return
  scoring.value = true
  status.value = 'Scoring…'
  try {
    const results = await scoreUrls(urls, (done, total) => {
      status.value = `Scoring ${done}/${total}…`
    })
    const next: Record<string, ScoreResult> = { ...scores.value }
    for (const r of results) {
      next[r.xmlUrl] = r
    }
    scores.value = next
    status.value = `Scored ${results.length} feed(s).`
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Score failed.'
    status.value = 'Score failed — you can still export.'
  } finally {
    scoring.value = false
  }
}
</script>

<template>
  <section v-if="ready" class="space-y-6">
    <div class="space-y-1">
      <h1 class="text-xl font-semibold">Workspace</h1>
      <p class="text-sm text-slate-600">
        Import, optionally Score, prune, and export OPML for your reader. DiveRSS is not a feed reader.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <input
        ref="fileInput"
        type="file"
        accept=".opml,.xml,text/xml,application/xml"
        class="sr-only"
        @change="onFileSelected"
      />
      <button
        type="button"
        class="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
        @click="fileInput?.click()"
      >
        Import OPML
      </button>
      <button
        type="button"
        class="rounded-md border border-teal-700 bg-white px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-50"
        :disabled="!canScore || scoring"
        @click="runScore"
      >
        {{ scoring ? 'Scoring…' : 'Score feeds' }}
      </button>
      <button
        type="button"
        class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
        @click="exportOpml"
      >
        Export OPML
      </button>
      <span class="text-sm text-slate-500">{{ feedCount }} feed(s)</span>
    </div>

    <p v-if="!scoreWorkerUrl()" class="text-xs text-slate-500">
      Set <code class="rounded bg-slate-100 px-1">VITE_SCORE_URL</code> to enable Score (export works without it).
    </p>

    <p v-if="error" class="text-sm text-red-700" role="alert">{{ error }}</p>
    <p v-if="status" class="text-sm text-teal-800">{{ status }}</p>

    <label class="block space-y-1">
      <span class="text-sm font-medium text-slate-700">Document title</span>
      <input
        v-model="workspace.title"
        type="text"
        class="w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm"
        @blur="onTitleBlur"
      />
    </label>

    <form class="flex flex-col gap-2 sm:flex-row sm:items-end" @submit="onAppend">
      <label class="block flex-1 space-y-1">
        <span class="text-sm font-medium text-slate-700">Feed title</span>
        <input
          v-model="newTitle"
          type="text"
          class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Example Blog"
        />
      </label>
      <label class="block flex-[2] space-y-1">
        <span class="text-sm font-medium text-slate-700">Feed URL</span>
        <input
          v-model="newUrl"
          type="url"
          class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="https://example.com/feed.xml"
        />
      </label>
      <button
        type="submit"
        class="rounded-md border border-teal-700 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50"
      >
        Add feed
      </button>
    </form>

    <div v-if="workspace.outlines.length === 0" class="text-sm text-slate-500">
      No feeds yet. Import an OPML file or add a feed above.
    </div>

    <ul
      v-else
      class="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white"
    >
      <OutlineList
        :outlines="workspace.outlines"
        :path="[]"
        :editing-path="editingPath"
        :edit-draft="editDraft"
        :scores="scores"
        @update:edit-draft="editDraft = $event"
        @start-edit="startEdit"
        @commit-edit="commitEdit"
        @prune="prune"
      />
    </ul>
  </section>
  <p v-else class="text-sm text-slate-500">Loading workspace…</p>
</template>
