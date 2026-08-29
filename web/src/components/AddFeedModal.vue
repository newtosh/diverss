<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import Button from '@/components/ui/Button.vue'
import ScanningStatusPill from '@/components/ScanningStatusPill.vue'
import {
  scanUrls,
  scanWorkerUrl,
  type ScanResult,
  type ScanTimeframe,
} from '@/scan/client'
import { pingBandClass, pingFrequencyFor, radarIcon } from '@/scan/pingFrequency'
import { healthPill, isFetchBlocked, reasonLabel } from '@/scan/presentation'
import type { OutlinePath } from '@/opml/mutate'

export interface AddFeedPayload {
  text: string
  xmlUrl: string
  htmlUrl?: string
  /** null / empty = document root (ungrouped). */
  sectionPath: OutlinePath | null
  scan?: ScanResult
}

const props = withDefaults(
  defineProps<{
    open: boolean
    sections: { path: OutlinePath; label: string }[]
    existingUrls?: Set<string> | string[]
    timeframe?: ScanTimeframe
    canVerify?: boolean
  }>(),
  {
    existingUrls: () => [],
    timeframe: '7d',
    canVerify: false,
  },
)

const emit = defineEmits<{
  cancel: []
  confirm: [payload: AddFeedPayload]
}>()

const xmlUrl = ref('')
const title = ref('')
const sectionKey = ref('')
const checking = ref(false)
const checkError = ref('')
const scan = ref<ScanResult | null>(null)
const verifiedUrl = ref('')

const existing = computed(() => {
  if (props.existingUrls instanceof Set) return props.existingUrls
  return new Set(props.existingUrls.map((u) => u.trim()).filter(Boolean))
})

const normalizedUrl = computed(() => xmlUrl.value.trim())

const urlOk = computed(() => {
  try {
    const u = new URL(normalizedUrl.value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
})

const isDuplicate = computed(
  () => urlOk.value && existing.value.has(normalizedUrl.value),
)

const canAdd = computed(() => {
  if (!urlOk.value || !title.value.trim()) return false
  if (isDuplicate.value) return false
  return true
})

function titleFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || 'Feed'
  } catch {
    return 'Feed'
  }
}

function reset() {
  xmlUrl.value = ''
  title.value = ''
  sectionKey.value = ''
  checking.value = false
  checkError.value = ''
  scan.value = null
  verifiedUrl.value = ''
}

function onKeydown(ev: KeyboardEvent) {
  if (!props.open) return
  if (ev.key === 'Escape') {
    ev.preventDefault()
    emit('cancel')
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      reset()
      window.addEventListener('keydown', onKeydown)
    } else {
      window.removeEventListener('keydown', onKeydown)
    }
  },
)

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})

watch(xmlUrl, () => {
  if (verifiedUrl.value && verifiedUrl.value !== normalizedUrl.value) {
    scan.value = null
    verifiedUrl.value = ''
    checkError.value = ''
  }
})

async function checkFeed() {
  checkError.value = ''
  scan.value = null
  if (!urlOk.value) {
    checkError.value = 'Enter a valid http(s) feed URL.'
    return
  }
  if (!props.canVerify || !scanWorkerUrl()) {
    checkError.value = 'Scan Worker is not configured — you can still add the feed.'
    if (!title.value.trim()) title.value = titleFromUrl(normalizedUrl.value)
    return
  }
  checking.value = true
  try {
    const results = await scanUrls([normalizedUrl.value])
    const r = results[0]
    if (!r) {
      checkError.value = 'No scan result returned.'
      return
    }
    scan.value = r
    verifiedUrl.value = r.xmlUrl || normalizedUrl.value
    if (r.xmlUrl && r.xmlUrl !== normalizedUrl.value) {
      xmlUrl.value = r.xmlUrl
    }
    if (!title.value.trim()) {
      title.value = (r.title?.trim() || titleFromUrl(verifiedUrl.value)).trim()
    }
    if (r.health === 'unhealthy') {
      checkError.value = reasonLabel(r.reason, r.detail)
    }
  } catch (e) {
    checkError.value = e instanceof Error ? e.message : 'Check failed.'
  } finally {
    checking.value = false
  }
}

function parseSectionKey(key: string): OutlinePath | null {
  if (!key) return null
  return key.split('.').map((n) => Number(n))
}

function onConfirm() {
  if (!canAdd.value) return
  const path = parseSectionKey(sectionKey.value)
  const payload: AddFeedPayload = {
    text: title.value.trim(),
    xmlUrl: normalizedUrl.value,
    sectionPath: path,
  }
  if (scan.value && verifiedUrl.value === normalizedUrl.value) {
    payload.scan = scan.value
  }
  emit('confirm', payload)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      @click.self="emit('cancel')"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-feed-title"
        class="flex max-h-[min(36rem,90vh)] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-gr-border bg-gr-surface shadow-lg"
      >
        <div class="border-b border-gr-border px-4 py-3">
          <h2 id="add-feed-title" class="text-base font-semibold text-gr-text">
            Add a feed
          </h2>
          <p class="mt-0.5 text-sm text-gr-text-muted">
            Check the feed URL, then choose a category (optional).
          </p>
        </div>

        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <label class="block space-y-1">
            <span class="text-sm font-medium text-gr-text">Feed URL</span>
            <div class="flex flex-col gap-2 sm:flex-row">
              <input
                v-model="xmlUrl"
                type="url"
                class="min-w-0 flex-1 rounded-md border border-gr-border px-3 py-2 text-sm"
                placeholder="https://example.com/feed.xml"
                autocomplete="off"
                :disabled="checking"
                @keydown.enter.prevent="checkFeed"
              />
              <Button
                variant="secondary"
                class="shrink-0"
                :disabled="checking || !urlOk"
                @click="checkFeed"
              >
                Check feed
              </Button>
            </div>
            <p v-if="isDuplicate" class="mt-1 text-xs text-amber-900">
              This URL is already in the workspace.
            </p>
          </label>

          <div
            v-if="checking || scan || checkError"
            class="rounded-md border border-gr-border bg-gr-surface-2/80 px-3 py-2.5"
          >
            <div class="flex flex-wrap items-center gap-2">
              <ScanningStatusPill v-if="checking" />
              <template v-else-if="scan">
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
                  :class="healthPill(scan).className"
                  :title="healthPill(scan).title"
                >
                  {{ healthPill(scan).label }}
                </span>
                <span
                  v-if="pingFrequencyFor(scan, timeframe)"
                  class="inline-flex items-center gap-0.5 text-xs font-medium tabular-nums"
                  :class="
                    pingBandClass(pingFrequencyFor(scan, timeframe)!.band)
                  "
                  :title="pingFrequencyFor(scan, timeframe)!.tooltip"
                >
                  <Icon
                    :icon="radarIcon(pingFrequencyFor(scan, timeframe)!.band)"
                    class="h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                  {{ pingFrequencyFor(scan, timeframe)!.score }}
                </span>
              </template>
            </div>
            <p
              v-if="checkError && !checking"
              class="mt-1.5 text-xs"
              :class="
                scan && isFetchBlocked(scan)
                  ? 'text-violet-800'
                  : scan?.health === 'unhealthy'
                    ? 'text-red-700'
                    : 'text-amber-900'
              "
            >
              {{ checkError }}
            </p>
          </div>

          <label class="block space-y-1">
            <span class="text-sm font-medium text-gr-text">Title</span>
            <input
              v-model="title"
              type="text"
              class="w-full rounded-md border border-gr-border px-3 py-2 text-sm"
              placeholder="Feed title"
              autocomplete="off"
            />
          </label>

          <label class="block space-y-1">
            <span class="text-sm font-medium text-gr-text">Category</span>
            <select
              v-model="sectionKey"
              class="w-full rounded-md border border-gr-border bg-gr-surface px-3 py-2 text-sm"
            >
              <option value="">Ungrouped (top level)</option>
              <option
                v-for="s in sections"
                :key="s.path.join('.')"
                :value="s.path.join('.')"
              >
                {{ s.label }}
              </option>
            </select>
            <span v-if="sections.length === 0" class="text-xs text-gr-text-muted">
              No categories yet — feed will be added at the top level.
            </span>
          </label>
        </div>

        <div class="flex justify-end gap-2 border-t border-gr-border px-4 py-3">
          <Button variant="secondary" @click="emit('cancel')">Cancel</Button>
          <Button variant="primary" :disabled="!canAdd || checking" @click="onConfirm">
            Add feed
          </Button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
