<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  clearConnection,
  loadConnections,
  normalizeBaseUrl,
  saveConnection,
} from '@/tools/connections'
import { createFreshRssAdapter } from '@/tools/readers/freshrss'
import { createMinifluxAdapter } from '@/tools/readers/miniflux'
import {
  deleteEmptyCategories,
  pullFromReader,
  pushToReader,
  wipeFeeds,
} from '@/tools/ops'
import type {
  ConnectionsState,
  LiveReaderId,
  ReaderAdapter,
  ReaderStatusSummary,
} from '@/tools/types'
import { loadWorkspace, saveWorkspace } from '@/db/workspace'
import type { OpmlDocument } from '@/opml/types'
import { emptyOpmlDocument, flattenFeeds } from '@/opml/types'
import { scoreWorkerUrl } from '@/score/client'
import WipeBackupModal from '@/components/tools/WipeBackupModal.vue'
import PushPullModal from '@/components/tools/PushPullModal.vue'

const STUBS = [
  { id: 'inoreader', name: 'Inoreader' },
  { id: 'feedbin', name: 'Feedbin' },
  { id: 'newsblur', name: 'NewsBlur' },
] as const

const connections = ref<ConnectionsState>({})
const workspace = ref<OpmlDocument>(emptyOpmlDocument())
const status = ref('')
const error = ref('')
const busy = ref(false)

const minifluxUrl = ref('')
const minifluxToken = ref('')
const freshrssUrl = ref('')
const freshrssUser = ref('')
const freshrssPass = ref('')

const minifluxSummary = ref<ReaderStatusSummary | null>(null)
const freshrssSummary = ref<ReaderStatusSummary | null>(null)

const pushPullOpen = ref(false)
const pushPullKind = ref<'push' | 'pull'>('push')
const pushPullReader = ref<LiveReaderId>('miniflux')
const wipeOpen = ref(false)
const wipeReader = ref<LiveReaderId>('miniflux')
const wipeForReplace = ref(false)

const transparency =
  'Credentials stay in this browser only (same trust model as your workspace). DiveRSS has no account database for reader tokens. Clearing site data removes them.'

const workerHint = computed(() =>
  scoreWorkerUrl()
    ? `Score API ready — Tools uses same-origin /api/proxy when a reader blocks browser CORS (local: VITE_SCORE_URL → Worker).`
    : `Run npm run dev (SPA + Score) or deploy to Vercel so /api/proxy is available for Tools.`,
)

function refreshConnections() {
  connections.value = loadConnections()
  if (connections.value.miniflux) {
    minifluxUrl.value = connections.value.miniflux.baseUrl
    minifluxToken.value = connections.value.miniflux.token
  }
  if (connections.value.freshrss) {
    freshrssUrl.value = connections.value.freshrss.baseUrl
    freshrssUser.value = connections.value.freshrss.username
    freshrssPass.value = connections.value.freshrss.apiPassword
  }
}

async function refreshWorkspace() {
  workspace.value = await loadWorkspace()
}

const minifluxReady = computed(() => {
  return (
    normalizeBaseUrl(minifluxUrl.value).length > 0 &&
    minifluxToken.value.trim().length > 0
  )
})

const freshrssReady = computed(() => {
  return (
    normalizeBaseUrl(freshrssUrl.value).length > 0 &&
    freshrssUser.value.trim().length > 0 &&
    freshrssPass.value.length > 0
  )
})

function adapterFor(id: LiveReaderId): ReaderAdapter {
  if (id === 'miniflux') {
    const baseUrl = normalizeBaseUrl(minifluxUrl.value)
    const token = minifluxToken.value.trim()
    if (!baseUrl || !token) {
      throw new Error('Enter Miniflux base URL and API token.')
    }
    return createMinifluxAdapter({ baseUrl, token })
  }
  const baseUrl = normalizeBaseUrl(freshrssUrl.value)
  const username = freshrssUser.value.trim()
  const apiPassword = freshrssPass.value
  if (!baseUrl || !username || !apiPassword) {
    throw new Error('Enter FreshRSS base URL, username, and API password.')
  }
  return createFreshRssAdapter({ baseUrl, username, apiPassword })
}

onMounted(async () => {
  refreshConnections()
  await refreshWorkspace()
})
onActivated(async () => {
  refreshConnections()
  await refreshWorkspace()
})

async function saveMiniflux() {
  error.value = ''
  connections.value = saveConnection('miniflux', {
    baseUrl: minifluxUrl.value,
    token: minifluxToken.value,
  })
  status.value = 'Miniflux connection saved in this browser.'
}

async function saveFreshRss() {
  error.value = ''
  connections.value = saveConnection('freshrss', {
    baseUrl: freshrssUrl.value,
    username: freshrssUser.value,
    apiPassword: freshrssPass.value,
  })
  status.value = 'FreshRSS connection saved in this browser.'
}

async function testReader(id: LiveReaderId) {
  error.value = ''
  busy.value = true
  try {
    const adapter = adapterFor(id)
    await adapter.test()
    const summary = await adapter.summarize()
    if (id === 'miniflux') minifluxSummary.value = summary
    else freshrssSummary.value = summary
    status.value = `Connected to ${id === 'miniflux' ? 'Miniflux' : 'FreshRSS'} (${summary.feedCount} feeds).`
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Test failed.'
  } finally {
    busy.value = false
  }
}

function disconnect(id: LiveReaderId) {
  connections.value = clearConnection(id)
  if (id === 'miniflux') {
    minifluxSummary.value = null
    minifluxToken.value = ''
  } else {
    freshrssSummary.value = null
    freshrssPass.value = ''
  }
  status.value = `${id === 'miniflux' ? 'Miniflux' : 'FreshRSS'} disconnected.`
}

function openPush(id: LiveReaderId) {
  pushPullReader.value = id
  pushPullKind.value = 'push'
  pushPullOpen.value = true
}

function openPull(id: LiveReaderId) {
  pushPullReader.value = id
  pushPullKind.value = 'pull'
  pushPullOpen.value = true
}

function openWipe(id: LiveReaderId) {
  wipeReader.value = id
  wipeForReplace.value = false
  wipeOpen.value = true
}

async function onPushPullChoose(mode: 'replace' | 'merge' | 'stage') {
  pushPullOpen.value = false
  error.value = ''
  const id = pushPullReader.value
  if (pushPullKind.value === 'push') {
    if (mode === 'replace') {
      wipeReader.value = id
      wipeForReplace.value = true
      wipeOpen.value = true
      return
    }
    busy.value = true
    try {
      await refreshWorkspace()
      const summary = await pushToReader(adapterFor(id), workspace.value, 'merge')
      status.value = `Pushed (merge) to ${id} — import ok${summary.wiped ? `, wiped ${summary.wiped}` : ''}.`
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Push failed.'
    } finally {
      busy.value = false
    }
    return
  }

  // pull
  if (mode === 'replace') {
    if (
      !window.confirm(
        'Replace your DiveRSS workspace with the reader’s subscription list?',
      )
    ) {
      return
    }
  }
  busy.value = true
  try {
    await refreshWorkspace()
    const summary = await pullFromReader(adapterFor(id), workspace.value, mode)
    if (mode === 'stage') {
      status.value = `Staged ${summary.staged ?? 0} feed(s) in Outbox.`
    } else if (summary.document) {
      workspace.value = summary.document
      await saveWorkspace(summary.document)
      status.value =
        mode === 'replace'
          ? `Workspace replaced (${summary.feedCount} feeds).`
          : `Merged into workspace — added ${summary.added ?? 0}, skipped ${summary.skipped ?? 0}.`
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Pull failed.'
  } finally {
    busy.value = false
  }
}

async function onWipeConfirm() {
  wipeOpen.value = false
  const id = wipeReader.value
  const forReplace = wipeForReplace.value
  wipeForReplace.value = false
  busy.value = true
  error.value = ''
  try {
    const adapter = adapterFor(id)
    const wiped = await wipeFeeds(adapter, {
      backupCompleted: true,
      confirmed: true,
    })
    if (forReplace) {
      await refreshWorkspace()
      await pushToReader(adapter, workspace.value, 'merge')
      status.value = `Replaced on ${id}: wiped ${wiped}, then imported workspace.`
    } else {
      status.value = `Wiped ${wiped} feed(s) on ${id}.`
    }
    await testReader(id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Wipe failed.'
  } finally {
    busy.value = false
  }
}

async function onEmptyCategories(id: LiveReaderId) {
  error.value = ''
  busy.value = true
  try {
    const result = await deleteEmptyCategories(adapterFor(id))
    status.value =
      result.errors.length > 0
        ? `Deleted ${result.deleted} empty categor${result.deleted === 1 ? 'y' : 'ies'}; some failed: ${result.errors[0]}`
        : `Deleted ${result.deleted} empty categor${result.deleted === 1 ? 'y' : 'ies'} (skipped ${result.skipped} non-empty).`
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Category cleanup failed.'
  } finally {
    busy.value = false
  }
}

const feedCount = computed(() => flattenFeeds(workspace.value.outlines).length)
</script>

<template>
  <section class="space-y-8">
    <div class="space-y-1">
      <h1 class="text-xl font-semibold">Tools</h1>
      <p class="text-sm text-slate-600">
        Connect self-hosted readers, push or pull subscription lists, and run
        protected ops. DiveRSS is still not a feed reader —
        <RouterLink class="text-teal-800 underline" to="/">Workspace</RouterLink>
        stays your OPML source of truth ({{ feedCount }} feeds loaded).
      </p>
    </div>

    <div
      class="rounded-lg border border-teal-200/80 bg-teal-50/60 px-3 py-2.5 text-sm text-teal-950"
      role="note"
    >
      <p class="font-medium">Stored on this device</p>
      <p class="mt-1 text-teal-900/90">{{ transparency }}</p>
      <p class="mt-2 text-xs text-teal-800/80">{{ workerHint }}</p>
    </div>

    <p
      class="min-h-5 text-sm"
      :class="error ? 'text-red-700' : 'text-teal-800'"
      :role="error ? 'alert' : status ? 'status' : undefined"
    >
      <span v-if="error">{{ error }}</span>
      <span v-else-if="status">{{ status }}</span>
    </p>

    <!-- Miniflux -->
    <section
      class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
    >
      <div class="border-b border-slate-100 bg-slate-50 px-4 py-3">
        <h2 class="font-semibold text-slate-900">Miniflux</h2>
        <p class="text-xs text-slate-500">
          API token from Settings → API Keys. Base URL is your Miniflux origin.
        </p>
      </div>
      <div class="space-y-3 p-4">
        <label class="block space-y-1 text-sm">
          <span class="text-slate-600">Base URL</span>
          <input
            v-model="minifluxUrl"
            class="w-full rounded-md border border-slate-300 px-3 py-2"
            placeholder="https://miniflux.example"
            autocomplete="url"
          />
        </label>
        <label class="block space-y-1 text-sm">
          <span class="text-slate-600">API token</span>
          <input
            v-model="minifluxToken"
            type="password"
            class="w-full rounded-md border border-slate-300 px-3 py-2"
            autocomplete="off"
          />
        </label>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-md border border-teal-700 px-3 py-1.5 text-sm font-medium text-teal-800 hover:bg-teal-50"
            @click="saveMiniflux"
          >
            Save
          </button>
          <button
            type="button"
            class="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
            :disabled="!minifluxReady || busy"
            @click="testReader('miniflux')"
          >
            Test connection
          </button>
          <button
            v-if="connections.miniflux"
            type="button"
            class="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            @click="disconnect('miniflux')"
          >
            Disconnect
          </button>
        </div>
        <p v-if="minifluxSummary" class="text-xs text-slate-500">
          {{ minifluxSummary.feedCount }} feeds
          <span v-if="minifluxSummary.categoryCount != null">
            · {{ minifluxSummary.categoryCount }} categories</span
          >
          <span v-if="minifluxSummary.lastErrors.length">
            · {{ minifluxSummary.lastErrors.length }} with errors</span
          >
        </p>
        <div v-if="connections.miniflux" class="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            class="rounded-md border border-teal-700 bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
            :disabled="busy"
            @click="openPush('miniflux')"
          >
            Push…
          </button>
          <button
            type="button"
            class="rounded-md border border-teal-700 px-3 py-1.5 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-50"
            :disabled="busy"
            @click="openPull('miniflux')"
          >
            Pull…
          </button>
          <button
            type="button"
            class="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-800 hover:bg-red-50 disabled:opacity-50"
            :disabled="busy"
            @click="openWipe('miniflux')"
          >
            Wipe all feeds…
          </button>
          <button
            type="button"
            class="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
            :disabled="busy"
            @click="onEmptyCategories('miniflux')"
          >
            Delete empty categories
          </button>
        </div>
      </div>
    </section>

    <!-- FreshRSS -->
    <section
      class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
    >
      <div class="border-b border-slate-100 bg-slate-50 px-4 py-3">
        <h2 class="font-semibold text-slate-900">FreshRSS</h2>
        <p class="text-xs text-slate-500">
          Use your FreshRSS username and <em>API password</em> (Profile → API),
          not the login password. Base URL can be the site root or
          <code class="rounded bg-slate-100 px-1">…/api/greader.php</code>.
        </p>
      </div>
      <div class="space-y-3 p-4">
        <label class="block space-y-1 text-sm">
          <span class="text-slate-600">Base URL</span>
          <input
            v-model="freshrssUrl"
            class="w-full rounded-md border border-slate-300 px-3 py-2"
            placeholder="https://freshrss.example"
            autocomplete="url"
          />
        </label>
        <label class="block space-y-1 text-sm">
          <span class="text-slate-600">Username</span>
          <input
            v-model="freshrssUser"
            class="w-full rounded-md border border-slate-300 px-3 py-2"
            autocomplete="username"
          />
        </label>
        <label class="block space-y-1 text-sm">
          <span class="text-slate-600">API password</span>
          <input
            v-model="freshrssPass"
            type="password"
            class="w-full rounded-md border border-slate-300 px-3 py-2"
            autocomplete="off"
          />
        </label>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-md border border-teal-700 px-3 py-1.5 text-sm font-medium text-teal-800 hover:bg-teal-50"
            @click="saveFreshRss"
          >
            Save
          </button>
          <button
            type="button"
            class="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
            :disabled="!freshrssReady || busy"
            @click="testReader('freshrss')"
          >
            Test connection
          </button>
          <button
            v-if="connections.freshrss"
            type="button"
            class="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            @click="disconnect('freshrss')"
          >
            Disconnect
          </button>
        </div>
        <p v-if="freshrssSummary" class="text-xs text-slate-500">
          {{ freshrssSummary.feedCount }} feeds
          <span v-if="freshrssSummary.categoryCount != null">
            · {{ freshrssSummary.categoryCount }} categories</span
          >
        </p>
        <div v-if="connections.freshrss" class="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            class="rounded-md border border-teal-700 bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
            :disabled="busy"
            @click="openPush('freshrss')"
          >
            Push…
          </button>
          <button
            type="button"
            class="rounded-md border border-teal-700 px-3 py-1.5 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-50"
            :disabled="busy"
            @click="openPull('freshrss')"
          >
            Pull…
          </button>
          <button
            type="button"
            class="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-800 hover:bg-red-50 disabled:opacity-50"
            :disabled="busy"
            @click="openWipe('freshrss')"
          >
            Wipe all feeds…
          </button>
          <button
            type="button"
            class="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
            :disabled="busy"
            @click="onEmptyCategories('freshrss')"
          >
            Delete empty categories
          </button>
        </div>
      </div>
    </section>

    <!-- Stubs -->
    <section class="space-y-3">
      <h2 class="text-sm font-semibold tracking-wide text-slate-500 uppercase">
        Coming soon
      </h2>
      <ul class="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <li
          v-for="s in STUBS"
          :key="s.id"
          class="flex items-center justify-between px-4 py-3 text-sm"
        >
          <span class="font-medium text-slate-800">{{ s.name }}</span>
          <span
            class="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-slate-600 uppercase"
            >Coming soon</span
          >
        </li>
      </ul>
    </section>

    <PushPullModal
      :open="pushPullOpen"
      :kind="pushPullKind"
      @cancel="pushPullOpen = false"
      @choose="onPushPullChoose"
    />
    <WipeBackupModal
      :open="wipeOpen"
      :title="wipeForReplace ? 'Replace requires wipe' : 'Wipe all feeds'"
      :busy="busy"
      :export-opml="() => adapterFor(wipeReader).exportOpml()"
      @cancel="wipeOpen = false; wipeForReplace = false"
      @confirm="onWipeConfirm"
    />
  </section>
</template>
