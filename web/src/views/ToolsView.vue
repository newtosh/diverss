<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Icon } from '@iconify/vue'
import {
  clearConnection,
  clearRsshubConnection,
  defaultRsshubConnection,
  loadConnections,
  normalizeBaseUrl,
  saveConnection,
  saveRsshubConnection,
} from '@/tools/connections'
import { createFreshRssAdapter } from '@/tools/readers/freshrss'
import { createMinifluxAdapter } from '@/tools/readers/miniflux'
import { createMockMinifluxAdapter } from '@/tools/readers/mockMiniflux'
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
import Button from '@/components/ui/Button.vue'
import WipeBackupModal from '@/components/tools/WipeBackupModal.vue'
import PushPullModal from '@/components/tools/PushPullModal.vue'
import ReaderAccordion from '@/components/tools/ReaderAccordion.vue'
import FilterPacksPanel from '@/components/tools/FilterPacksPanel.vue'
import ReaderPanelTabs from '@/components/tools/ReaderPanelTabs.vue'
import type { ReaderPanelTabId } from '@/components/tools/ReaderPanelTabs.vue'
import ReaderAdminPanel from '@/components/tools/ReaderAdminPanel.vue'
import type { ReaderId } from '@/tools/types'

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
const expandedId = ref<ReaderId | null>(null)
const accordionReady = ref(false)
/** Local review: in-memory Miniflux with sample feeds (dev builds only). */
const isDev = import.meta.env.DEV
const mockMiniflux = ref(isDev)
const mockAdapter = createMockMinifluxAdapter()
const minifluxTab = ref<ReaderPanelTabId>('connection')
const freshrssTab = ref<ReaderPanelTabId>('connection')

/** RSSHub has no ReaderAdapter (no push/pull/wipe) — expand state stays local, not in expandedId. */
const rsshubExpanded = ref(false)
const rsshubBases = ref<string[]>([])
const rsshubNewBase = ref('')
const rsshubTestResults = ref<Record<string, 'ok' | 'fail' | undefined>>({})
const rsshubTesting = ref<string | null>(null)
const rsshubConnected = computed(() => Boolean(connections.value.rsshub))

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
  'Credentials stay in this browser only (same trust model as your garden). GardenRSS has no account database for reader tokens. Clearing site data removes them.'

type StatusSignal = 'ok' | 'warn' | 'danger' | 'idle'

const SIGNAL_DOT: Record<StatusSignal, string> = {
  ok: 'bg-emerald-500',
  warn: 'bg-amber-400',
  danger: 'bg-red-500',
  idle: 'bg-gr-border',
}

const SIGNAL_LABEL: Record<StatusSignal, string> = {
  ok: 'OK',
  warn: 'Warning',
  danger: 'Problem',
  idle: 'Idle',
}

const proxyStatusShort = computed(() =>
  scoreWorkerUrl()
    ? 'Score API ready · /api/proxy'
    : 'Score API offline · no proxy',
)

const proxyStatusDetail = computed(() =>
  scoreWorkerUrl()
    ? 'Tools uses same-origin /api/proxy when a reader blocks browser CORS (local: VITE_SCORE_URL → Worker).'
    : 'Run npm run dev (SPA + Score) or deploy to Vercel so /api/proxy is available for Tools.',
)

const proxySignal = computed((): StatusSignal =>
  scoreWorkerUrl() ? 'ok' : 'danger',
)

const readersStatusShort = computed(() => {
  const parts: string[] = []
  if (mockMiniflux.value) parts.push('Miniflux (mock)')
  else if (connections.value.miniflux) parts.push('Miniflux')
  if (connections.value.freshrss) parts.push('FreshRSS')
  return parts.length ? parts.join(' · ') : 'No readers connected'
})

const readersSignal = computed((): StatusSignal => {
  const anyConnected =
    mockMiniflux.value ||
    !!connections.value.miniflux ||
    !!connections.value.freshrss
  if (!anyConnected) return 'idle'
  if (error.value) return 'danger'
  const feedErrors =
    (minifluxSummary.value?.lastErrors.length ?? 0) +
    (freshrssSummary.value?.lastErrors.length ?? 0)
  if (feedErrors > 0) return 'warn'
  const pendingVerify =
    (minifluxConnected.value && !minifluxSummary.value) ||
    (!!connections.value.freshrss && !freshrssSummary.value)
  if (pendingVerify) return 'warn'
  return 'ok'
})

const readersSignalDetail = computed(() => {
  if (readersSignal.value === 'idle') return 'No readers connected'
  if (readersSignal.value === 'danger') {
    return error.value || 'Reader connection problem'
  }
  const n =
    (minifluxSummary.value?.lastErrors.length ?? 0) +
    (freshrssSummary.value?.lastErrors.length ?? 0)
  if (readersSignal.value === 'warn' && n > 0) {
    return `${n} feed${n === 1 ? '' : 's'} reporting errors`
  }
  if (readersSignal.value === 'warn') return 'Saved — test connection to verify'
  return 'Reader connected'
})

const mockHint =
  'In-memory Miniflux with sample feeds so client filter feed pickers work without a real server. Changes stay in this tab.'

async function onMockToggle(ev: MouseEvent) {
  if (mockMiniflux.value) disableMockMiniflux()
  else await enableMockMiniflux()
  // Drop focus so the hover tip does not stick after click.
  ;(ev.currentTarget as HTMLButtonElement | null)?.blur()
}

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
  // Seed an unsaved draft from the default when nothing is stored yet (U1) —
  // never write this to storage until the user explicitly saves.
  rsshubBases.value = connections.value.rsshub
    ? [...connections.value.rsshub.bases]
    : [...defaultRsshubConnection().bases]
}

function addRsshubBase() {
  const base = normalizeBaseUrl(rsshubNewBase.value)
  if (!base || rsshubBases.value.includes(base)) return
  rsshubBases.value.push(base)
  rsshubNewBase.value = ''
}

function removeRsshubBase(base: string) {
  rsshubBases.value = rsshubBases.value.filter((b) => b !== base)
  delete rsshubTestResults.value[base]
}

function moveRsshubBase(index: number, direction: -1 | 1) {
  const next = index + direction
  if (next < 0 || next >= rsshubBases.value.length) return
  const bases = [...rsshubBases.value]
  ;[bases[index], bases[next]] = [bases[next]!, bases[index]!]
  rsshubBases.value = bases
}

function saveRsshub() {
  if (rsshubBases.value.length === 0) {
    clearRsshubConnection()
  } else {
    saveRsshubConnection(rsshubBases.value)
  }
  refreshConnections()
  status.value = rsshubBases.value.length
    ? `Saved ${rsshubBases.value.length} RSSHub base(s).`
    : 'RSSHub connection cleared.'
}

function disconnectRsshub() {
  clearRsshubConnection()
  rsshubTestResults.value = {}
  refreshConnections()
  status.value = 'RSSHub connection cleared.'
}

async function testRsshubBase(base: string) {
  rsshubTesting.value = base
  try {
    // no-cors: RSSHub instances rarely send CORS headers, so a normal fetch
    // would report a false "fail" for a perfectly healthy base. An opaque
    // response still proves the host is reachable, which is what a dead
    // proxy fails at (DNS/network error, not a CORS block).
    await fetch(base, { method: 'HEAD', mode: 'no-cors' })
    rsshubTestResults.value = { ...rsshubTestResults.value, [base]: 'ok' }
  } catch {
    rsshubTestResults.value = { ...rsshubTestResults.value, [base]: 'fail' }
  } finally {
    rsshubTesting.value = null
  }
}

async function refreshWorkspace() {
  workspace.value = await loadWorkspace()
}

const minifluxReady = computed(() => {
  if (mockMiniflux.value) return true
  return (
    normalizeBaseUrl(minifluxUrl.value).length > 0 &&
    minifluxToken.value.trim().length > 0
  )
})

const minifluxConnected = computed(
  () => mockMiniflux.value || !!connections.value.miniflux,
)

const freshrssReady = computed(() => {
  return (
    normalizeBaseUrl(freshrssUrl.value).length > 0 &&
    freshrssUser.value.trim().length > 0 &&
    freshrssPass.value.length > 0
  )
})

function adapterFor(id: LiveReaderId): ReaderAdapter {
  if (id === 'miniflux') {
    if (mockMiniflux.value) return mockAdapter
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

function togglePanel(id: ReaderId) {
  expandedId.value = expandedId.value === id ? null : id
}

function initExpanded() {
  if (accordionReady.value) return
  if (connections.value.miniflux) expandedId.value = 'miniflux'
  else if (connections.value.freshrss) expandedId.value = 'freshrss'
  else expandedId.value = null
  accordionReady.value = true
}

const minifluxFeedsAdapter = computed(() => {
  if (mockMiniflux.value) return mockAdapter
  if (!minifluxReady.value || !connections.value.miniflux) return null
  try {
    return adapterFor('miniflux')
  } catch {
    return null
  }
})

async function enableMockMiniflux() {
  mockMiniflux.value = true
  minifluxUrl.value = 'https://mock.miniflux.local'
  minifluxToken.value = 'mock-token'
  expandedId.value = 'miniflux'
  error.value = ''
  try {
    minifluxSummary.value = await mockAdapter.summarize()
    status.value = `Mock Miniflux · ${minifluxSummary.value.feedCount} feeds · apply in-memory`
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Mock failed.'
  }
}

function disableMockMiniflux() {
  mockMiniflux.value = false
  refreshConnections()
  if (!connections.value.miniflux) {
    minifluxUrl.value = ''
    minifluxToken.value = ''
    minifluxSummary.value = null
  }
  status.value = 'Mock Miniflux off'
}

onMounted(async () => {
  refreshConnections()
  if (mockMiniflux.value) {
    minifluxUrl.value = 'https://mock.miniflux.local'
    minifluxToken.value = 'mock-token'
    error.value = ''
    try {
      minifluxSummary.value = await mockAdapter.summarize()
      status.value = `Mock Miniflux · ${minifluxSummary.value.feedCount} feeds · apply in-memory`
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Mock failed.'
    }
  }
  initExpanded()
  if (mockMiniflux.value) expandedId.value = 'miniflux'
  await refreshWorkspace()
})
onActivated(async () => {
  refreshConnections()
  if (mockMiniflux.value && !minifluxSummary.value) {
    try {
      minifluxSummary.value = await mockAdapter.summarize()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Mock failed.'
    }
  }
  await refreshWorkspace()
})

function onFilterStatus(message: string) {
  error.value = ''
  status.value = message
}

function onFilterError(message: string) {
  if (!message) {
    error.value = ''
    return
  }
  error.value = message
  status.value = ''
}

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
    const summary = await refreshReaderSummary(id)
    status.value = `Connected to ${id === 'miniflux' ? 'Miniflux' : 'FreshRSS'} (${summary.feedCount} feeds).`
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Test failed.'
  } finally {
    busy.value = false
  }
}

async function refreshReaderSummary(id: LiveReaderId): Promise<ReaderStatusSummary> {
  const summary = await adapterFor(id).summarize()
  if (id === 'miniflux') minifluxSummary.value = summary
  else freshrssSummary.value = summary
  return summary
}

function disconnect(id: LiveReaderId) {
  if (id === 'miniflux' && mockMiniflux.value) {
    disableMockMiniflux()
    return
  }
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
        'Replace your GardenRSS garden with the reader’s subscription list?',
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
      status.value = `Staged ${summary.staged ?? 0} feed(s) in Deck.`
    } else if (summary.document) {
      workspace.value = summary.document
      await saveWorkspace(summary.document)
      status.value =
        mode === 'replace'
          ? `Garden replaced (${summary.feedCount} feeds).`
          : `Merged into Garden — added ${summary.added ?? 0}, skipped ${summary.skipped ?? 0}.`
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Pull failed.'
  } finally {
    busy.value = false
  }
}

async function onWipeConfirm() {
  const id = wipeReader.value
  const forReplace = wipeForReplace.value
  wipeForReplace.value = false
  busy.value = true
  error.value = ''
  status.value = 'Wiping feeds…'
  try {
    const adapter = adapterFor(id)
    const wipe = await wipeFeeds(adapter, {
      backupCompleted: true,
      confirmed: true,
      onProgress: (done, total) => {
        status.value =
          total === 0 ? 'No feeds to wipe.' : `Wiping… ${done}/${total}`
      },
    })
    wipeOpen.value = false
    status.value = 'Verifying wipe…'
    const summary = await refreshReaderSummary(id)
    if (forReplace) {
      await refreshWorkspace()
      await pushToReader(adapter, workspace.value, 'merge')
      const after = await refreshReaderSummary(id)
      status.value = `Verified wipe of ${wipe.before} feed(s) on ${id}, then imported garden (${after.feedCount} feeds now).`
    } else {
      status.value = `Verified wipe: removed ${wipe.before} feed(s) on ${id}. Reader now has ${summary.feedCount} feed(s).`
    }
  } catch (e) {
    try {
      await refreshReaderSummary(id)
    } catch {
      /* keep wipe error primary */
    }
    error.value = e instanceof Error ? e.message : 'Wipe failed.'
    status.value = ''
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
      <p class="text-sm text-gr-text-muted">
        Connect self-hosted readers, push or pull subscription lists, and run
        protected ops. GardenRSS is still an RSS feed manager — not a feed reader —
        <RouterLink class="text-gr-accent-strong underline" to="/">Garden</RouterLink>
        stays your OPML source of truth ({{ feedCount }} feeds loaded).
      </p>
    </div>

    <div
      class="rounded-lg border border-gr-border bg-gr-surface px-3 py-2.5 shadow-sm"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-semibold text-gr-text">Status</h2>
        <div class="flex flex-wrap items-center justify-end gap-1.5">
          <div v-if="isDev" class="group relative">
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors"
              :class="
                mockMiniflux
                  ? 'border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100/80'
                  : 'border-gr-border bg-gr-surface-2 text-gr-text hover:bg-gr-surface-2'
              "
              :aria-pressed="mockMiniflux"
              aria-describedby="tools-mock-tip"
              @click="onMockToggle"
            >
              <Icon icon="tabler:flask" class="h-3.5 w-3.5" aria-hidden="true" />
              Mock {{ mockMiniflux ? 'on' : 'off' }}
            </button>
            <div
              id="tools-mock-tip"
              role="tooltip"
              class="pointer-events-none absolute right-0 z-20 mt-1.5 w-64 rounded-md border border-gr-border bg-gr-surface p-2.5 text-left text-xs leading-relaxed text-gr-text-muted opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
            >
              <p class="font-medium text-gr-text">Local mock Miniflux</p>
              <p class="mt-1">{{ mockHint }}</p>
            </div>
          </div>
          <div class="group relative">
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-md border border-gr-accent/30 bg-gr-accent/10 px-2 py-1 text-xs font-medium text-gr-accent-strong hover:bg-gr-accent/10"
              aria-describedby="tools-privacy-tip"
            >
              <Icon icon="tabler:device-desktop" class="h-3.5 w-3.5" aria-hidden="true" />
              Stored on this device
            </button>
            <div
              id="tools-privacy-tip"
              role="tooltip"
              class="pointer-events-none absolute right-0 z-20 mt-1.5 w-72 rounded-md border border-gr-border bg-gr-surface p-2.5 text-left text-xs leading-relaxed text-gr-text-muted opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
            >
              <p class="font-medium text-gr-text">Stored on this device</p>
              <p class="mt-1">{{ transparency }}</p>
            </div>
          </div>
        </div>
      </div>

      <dl class="mt-2 space-y-1 text-sm">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <dt class="flex w-[4.75rem] shrink-0 items-center gap-1.5 text-gr-text-muted">
            <span
              class="inline-block h-2 w-2 shrink-0 rounded-full"
              :class="SIGNAL_DOT[proxySignal]"
              :title="SIGNAL_LABEL[proxySignal]"
              aria-hidden="true"
            />
            <span class="sr-only">{{ SIGNAL_LABEL[proxySignal] }}.</span>
            Proxy
          </dt>
          <dd class="min-w-0 text-gr-text" :title="proxyStatusDetail">
            {{ proxyStatusShort }}
          </dd>
        </div>
        <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <dt class="flex w-[4.75rem] shrink-0 items-center gap-1.5 text-gr-text-muted">
            <span
              class="inline-block h-2 w-2 shrink-0 rounded-full"
              :class="SIGNAL_DOT[readersSignal]"
              :title="readersSignalDetail"
              aria-hidden="true"
            />
            <span class="sr-only">{{ SIGNAL_LABEL[readersSignal] }}.</span>
            Readers
          </dt>
          <dd class="min-w-0 text-gr-text" :title="readersSignalDetail">
            {{ readersStatusShort }}
          </dd>
        </div>
      </dl>

      <p
        class="mt-2 min-h-10 text-sm leading-5"
        :class="error ? 'text-red-700' : status || busy ? 'text-gr-accent-strong' : 'text-gr-text-muted'"
        :role="error ? 'alert' : status || busy ? 'status' : undefined"
        aria-live="polite"
        :title="error || status || undefined"
      >
        <span v-if="error">{{ error }}</span>
        <span v-else-if="busy && !status">Working…</span>
        <span v-else-if="status">{{ status }}</span>
        <span v-else>Ready</span>
      </p>
    </div>

    <div class="space-y-3">
      <ReaderAccordion
        title="Miniflux"
        :subtitle="
          mockMiniflux
            ? 'Mock reader (in-memory) — Apply / wipe are local only.'
            : 'API token from Settings → API Keys. Base URL is your Miniflux origin.'
        "
        :hint="
          minifluxSummary
            ? `${minifluxSummary.feedCount} feeds${
                minifluxSummary.categoryCount != null
                  ? ` · ${minifluxSummary.categoryCount} categories`
                  : ''
              }${
                minifluxSummary.lastErrors.length
                  ? ` · ${minifluxSummary.lastErrors.length} with errors`
                  : ''
              }${mockMiniflux ? ' · mock' : ''}`
            : minifluxConnected
              ? mockMiniflux
                ? 'Mock connected'
                : 'Saved in this browser'
              : undefined
        "
        :expanded="expandedId === 'miniflux'"
        @toggle="togglePanel('miniflux')"
      >
        <ReaderPanelTabs v-model="minifluxTab" />

        <div v-show="minifluxTab === 'connection'" class="space-y-3" role="tabpanel">
          <label class="block space-y-1 text-sm">
            <span class="text-gr-text-muted">Base URL</span>
            <input
              v-model="minifluxUrl"
              class="w-full rounded-md border border-gr-border px-3 py-2 disabled:bg-gr-surface-2 disabled:text-gr-text-muted"
              placeholder="https://miniflux.example"
              autocomplete="url"
              :disabled="mockMiniflux"
            />
          </label>
          <label class="block space-y-1 text-sm">
            <span class="text-gr-text-muted">API token</span>
            <input
              v-model="minifluxToken"
              type="password"
              class="w-full rounded-md border border-gr-border px-3 py-2 disabled:bg-gr-surface-2 disabled:text-gr-text-muted"
              autocomplete="off"
              :disabled="mockMiniflux"
            />
          </label>
          <div class="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" :disabled="mockMiniflux" @click="saveMiniflux">
              Save
            </Button>
            <Button
              variant="secondary"
              size="sm"
              :disabled="!minifluxReady || busy"
              @click="testReader('miniflux')"
            >
              Test connection
            </Button>
            <Button
              v-if="minifluxConnected"
              variant="secondary"
              size="sm"
              @click="disconnect('miniflux')"
            >
              {{ mockMiniflux ? 'Turn mock off' : 'Disconnect' }}
            </Button>
          </div>
          <div
            v-if="minifluxConnected"
            class="space-y-2 border-t border-gr-border pt-3"
          >
            <p class="text-xs font-medium text-gr-text-muted">Subscription sync</p>
            <div class="flex flex-wrap gap-2">
              <Button variant="primary" size="sm" :disabled="busy" @click="openPush('miniflux')">
                Push…
              </Button>
              <Button variant="secondary" size="sm" :disabled="busy" @click="openPull('miniflux')">
                Pull…
              </Button>
            </div>
          </div>
        </div>

        <div v-show="minifluxTab === 'filters'" role="tabpanel">
          <FilterPacksPanel
            :adapter="minifluxFeedsAdapter"
            :busy="busy"
            @status="onFilterStatus"
            @error="onFilterError"
          />
        </div>

        <ReaderAdminPanel
          v-show="minifluxTab === 'admin'"
          reader-label="Miniflux"
          :connected="minifluxConnected"
          :busy="busy"
          @wipe="openWipe('miniflux')"
          @empty-categories="onEmptyCategories('miniflux')"
        />
      </ReaderAccordion>

      <ReaderAccordion
        title="FreshRSS"
        subtitle="Use your FreshRSS username and API password (Profile → API), not the login password."
        :hint="
          freshrssSummary
            ? `${freshrssSummary.feedCount} feeds${
                freshrssSummary.categoryCount != null
                  ? ` · ${freshrssSummary.categoryCount} categories`
                  : ''
              }`
            : connections.freshrss
              ? 'Saved in this browser'
              : undefined
        "
        :expanded="expandedId === 'freshrss'"
        @toggle="togglePanel('freshrss')"
      >
        <ReaderPanelTabs v-model="freshrssTab" />

        <div v-show="freshrssTab === 'connection'" class="space-y-3" role="tabpanel">
          <label class="block space-y-1 text-sm">
            <span class="text-gr-text-muted">Base URL</span>
            <input
              v-model="freshrssUrl"
              class="w-full rounded-md border border-gr-border px-3 py-2"
              placeholder="https://freshrss.example"
              autocomplete="url"
            />
          </label>
          <label class="block space-y-1 text-sm">
            <span class="text-gr-text-muted">Username</span>
            <input
              v-model="freshrssUser"
              class="w-full rounded-md border border-gr-border px-3 py-2"
              autocomplete="username"
            />
          </label>
          <label class="block space-y-1 text-sm">
            <span class="text-gr-text-muted">API password</span>
            <input
              v-model="freshrssPass"
              type="password"
              class="w-full rounded-md border border-gr-border px-3 py-2"
              autocomplete="off"
            />
          </label>
          <div class="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" @click="saveFreshRss">Save</Button>
            <Button
              variant="secondary"
              size="sm"
              :disabled="!freshrssReady || busy"
              @click="testReader('freshrss')"
            >
              Test connection
            </Button>
            <Button
              v-if="connections.freshrss"
              variant="secondary"
              size="sm"
              @click="disconnect('freshrss')"
            >
              Disconnect
            </Button>
          </div>
          <div
            v-if="connections.freshrss"
            class="space-y-2 border-t border-gr-border pt-3"
          >
            <p class="text-xs font-medium text-gr-text-muted">Subscription sync</p>
            <div class="flex flex-wrap gap-2">
              <Button variant="primary" size="sm" :disabled="busy" @click="openPush('freshrss')">
                Push…
              </Button>
              <Button
                variant="secondary"
                size="sm"
                :disabled="busy"
                @click="openPull('freshrss')"
              >
                Pull…
              </Button>
            </div>
          </div>
        </div>

        <div v-show="freshrssTab === 'filters'" role="tabpanel">
          <FilterPacksPanel
            :adapter="null"
            :busy="busy"
            @status="onFilterStatus"
            @error="onFilterError"
          />
        </div>

        <ReaderAdminPanel
          v-show="freshrssTab === 'admin'"
          reader-label="FreshRSS"
          :connected="!!connections.freshrss"
          :busy="busy"
          @wipe="openWipe('freshrss')"
          @empty-categories="onEmptyCategories('freshrss')"
        />
      </ReaderAccordion>

      <ReaderAccordion
        title="RSSHub"
        subtitle="Ordered base URLs for feeds generated by an RSSHub-compatible proxy (self-hosted or public). A dead base fails over to the next."
        :hint="
          rsshubConnected
            ? `${rsshubBases.length} base(s) configured`
            : 'Not configured — using an unsaved default'
        "
        :expanded="rsshubExpanded"
        @toggle="rsshubExpanded = !rsshubExpanded"
      >
        <ul class="space-y-2">
          <li
            v-for="(base, i) in rsshubBases"
            :key="base"
            class="flex items-center gap-2 rounded-md border border-gr-border px-3 py-2"
          >
            <span class="min-w-0 flex-1 truncate text-sm">{{ base }}</span>
            <span
              v-if="rsshubTestResults[base] === 'ok'"
              class="text-xs font-medium text-emerald-600"
              >Reachable</span
            >
            <span
              v-else-if="rsshubTestResults[base] === 'fail'"
              class="text-xs font-medium text-red-600"
              >Unreachable</span
            >
            <Button
              variant="secondary"
              size="sm"
              :disabled="rsshubTesting === base"
              @click="testRsshubBase(base)"
            >
              {{ rsshubTesting === base ? 'Testing…' : 'Test' }}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              :disabled="i === 0"
              aria-label="Move up"
              @click="moveRsshubBase(i, -1)"
            >
              <Icon icon="tabler:chevron-up" class="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              :disabled="i === rsshubBases.length - 1"
              aria-label="Move down"
              @click="moveRsshubBase(i, 1)"
            >
              <Icon icon="tabler:chevron-down" class="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button variant="secondary" size="sm" @click="removeRsshubBase(base)">
              Remove
            </Button>
          </li>
        </ul>
        <div class="flex flex-wrap gap-2">
          <input
            v-model="rsshubNewBase"
            class="min-w-0 flex-1 rounded-md border border-gr-border px-3 py-2 text-sm"
            placeholder="https://rsshub.example"
            autocomplete="url"
            @keydown.enter.prevent="addRsshubBase"
          />
          <Button variant="secondary" size="sm" @click="addRsshubBase">Add base</Button>
        </div>
        <div class="flex flex-wrap gap-2 border-t border-gr-border pt-3">
          <Button variant="secondary" size="sm" @click="saveRsshub">Save</Button>
          <Button v-if="rsshubConnected" variant="secondary" size="sm" @click="disconnectRsshub">
            Disconnect
          </Button>
        </div>
      </ReaderAccordion>

      <ReaderAccordion
        v-for="s in STUBS"
        :key="s.id"
        :title="s.name"
        stub
        hint="Browse filter packs and copy pattern/JSON; live sync coming later."
        :expanded="expandedId === s.id"
        @toggle="togglePanel(s.id)"
      >
        <FilterPacksPanel
          :adapter="null"
          :busy="busy"
          @status="onFilterStatus"
          @error="onFilterError"
        />
      </ReaderAccordion>
    </div>

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
