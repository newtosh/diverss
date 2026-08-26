<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import ScoringStatusPill from '@/components/ScoringStatusPill.vue'
import {
  scoreUrls,
  scoreWorkerUrl,
  type ScoreResult,
  type ScoreTimeframe,
} from '@/score/client'
import { pingBandClass, pingFrequencyFor, radarIcon } from '@/score/pingFrequency'
import { healthPill, reasonLabel } from '@/score/presentation'
import type { OutlinePath } from '@/opml/mutate'

export interface AddFeedPayload {
  text: string
  xmlUrl: string
  htmlUrl?: string
  /** null / empty = document root (ungrouped). */
  sectionPath: OutlinePath | null
  score?: ScoreResult
}

const props = withDefaults(
  defineProps<{
    open: boolean
    sections: { path: OutlinePath; label: string }[]
    existingUrls?: Set<string> | string[]
    timeframe?: ScoreTimeframe
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
const score = ref<ScoreResult | null>(null)
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
  score.value = null
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
    score.value = null
    verifiedUrl.value = ''
    checkError.value = ''
  }
})

async function checkFeed() {
  checkError.value = ''
  score.value = null
  if (!urlOk.value) {
    checkError.value = 'Enter a valid http(s) feed URL.'
    return
  }
  if (!props.canVerify || !scoreWorkerUrl()) {
    checkError.value = 'Score Worker is not configured — you can still add the feed.'
    if (!title.value.trim()) title.value = titleFromUrl(normalizedUrl.value)
    return
  }
  checking.value = true
  try {
    const results = await scoreUrls([normalizedUrl.value])
    const r = results[0]
    if (!r) {
      checkError.value = 'No score result returned.'
      return
    }
    score.value = r
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
  if (score.value && verifiedUrl.value === normalizedUrl.value) {
    payload.score = score.value
  }
  emit('confirm', payload)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      role="presentation"
      @click.self="emit('cancel')"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-feed-title"
        class="flex max-h-[min(36rem,90vh)] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
      >
        <div class="border-b border-slate-100 px-4 py-3">
          <h2 id="add-feed-title" class="text-base font-semibold text-slate-900">
            Add a feed
          </h2>
          <p class="mt-0.5 text-sm text-slate-600">
            Check the feed URL, then choose a category (optional).
          </p>
        </div>

        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <label class="block space-y-1">
            <span class="text-sm font-medium text-slate-700">Feed URL</span>
            <div class="flex flex-col gap-2 sm:flex-row">
              <input
                v-model="xmlUrl"
                type="url"
                class="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="https://example.com/feed.xml"
                autocomplete="off"
                :disabled="checking"
                @keydown.enter.prevent="checkFeed"
              />
              <button
                type="button"
                class="shrink-0 rounded-md border border-teal-700 bg-white px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-50"
                :disabled="checking || !urlOk"
                @click="checkFeed"
              >
                Check feed
              </button>
            </div>
            <p v-if="isDuplicate" class="mt-1 text-xs text-amber-900">
              This URL is already in the workspace.
            </p>
          </label>

          <div
            v-if="checking || score || checkError"
            class="rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2.5"
          >
            <div class="flex flex-wrap items-center gap-2">
              <ScoringStatusPill v-if="checking" />
              <template v-else-if="score">
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
                  :class="healthPill(score).className"
                  :title="healthPill(score).title"
                >
                  {{ healthPill(score).label }}
                </span>
                <span
                  v-if="pingFrequencyFor(score, timeframe)"
                  class="inline-flex items-center gap-0.5 text-xs font-medium tabular-nums"
                  :class="
                    pingBandClass(pingFrequencyFor(score, timeframe)!.band)
                  "
                  :title="pingFrequencyFor(score, timeframe)!.tooltip"
                >
                  <Icon
                    :icon="radarIcon(pingFrequencyFor(score, timeframe)!.band)"
                    class="h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                  {{ pingFrequencyFor(score, timeframe)!.score }}
                </span>
              </template>
            </div>
            <p
              v-if="checkError && !checking"
              class="mt-1.5 text-xs"
              :class="
                score?.health === 'unhealthy' ? 'text-red-700' : 'text-amber-900'
              "
            >
              {{ checkError }}
            </p>
          </div>

          <label class="block space-y-1">
            <span class="text-sm font-medium text-slate-700">Title</span>
            <input
              v-model="title"
              type="text"
              class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Feed title"
              autocomplete="off"
            />
          </label>

          <label class="block space-y-1">
            <span class="text-sm font-medium text-slate-700">Category</span>
            <select
              v-model="sectionKey"
              class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
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
            <span v-if="sections.length === 0" class="text-xs text-slate-500">
              No categories yet — feed will be added at the top level.
            </span>
          </label>
        </div>

        <div class="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            @click="emit('cancel')"
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
            :disabled="!canAdd || checking"
            @click="onConfirm"
          >
            Add feed
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
