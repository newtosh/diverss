<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import FeedActionsMenu from '@/components/FeedActionsMenu.vue'
import FeedAvatar from '@/components/FeedAvatar.vue'
import FeedUrlSuggestions from '@/components/FeedUrlSuggestions.vue'
import ScoringStatusPill from '@/components/ScoringStatusPill.vue'
import type { OpmlOutline } from '@/opml/types'
import { countFeeds } from '@/opml/types'
import type { OutlinePath } from '@/opml/mutate'
import type { ScoreResult, ScoreTimeframe } from '@/score/client'
import { pingBandClass, pingFrequencyFor, radarIcon } from '@/score/pingFrequency'
import { rowWarningClass, healthPill } from '@/score/presentation'
import {
  countMatchingFeeds,
  feedMatchesListFilter,
  type ListHealthFilter,
  outlineMatchesListFilter,
} from '@/lib/listFilter'
import type { FeedSuggestion } from '@/suggest/proxyUnwrap'

const props = withDefaults(
  defineProps<{
    outlines: OpmlOutline[]
    path: OutlinePath
    editingPath: string | null
    editDraft: string
    scores: Record<string, ScoreResult>
    collapsed: Record<string, boolean>
    timeframe: ScoreTimeframe
    filterQuery?: string
    filterHealth?: ListHealthFilter
    suggestionsByUrl?: Record<string, FeedSuggestion[]>
    suggestionScores?: Record<string, ScoreResult>
    scoringSuggestions?: boolean
    discoveringUrl?: string | null
    rescoringUrl?: string | null
    reopenFixUrl?: string | null
    discoverErrorByUrl?: Record<string, string>
    canDiscover?: boolean
    /** When true, skip root-level feeds (parent already rendered them). */
    sectionsOnly?: boolean
    /** Selected feed xmlUrls for multi-select. */
    selectedUrls?: readonly string[]
    /** Feeds in the active Score run (show loading even if a prior score exists). */
    scoringUrls?: Readonly<Record<string, true>>
  }>(),
  {
    sectionsOnly: false,
    timeframe: '7d',
    filterQuery: '',
    filterHealth: 'all',
    suggestionsByUrl: () => ({}),
    suggestionScores: () => ({}),
    scoringSuggestions: false,
    discoveringUrl: null,
    rescoringUrl: null,
    reopenFixUrl: null,
    discoverErrorByUrl: () => ({}),
    canDiscover: false,
    selectedUrls: () => [],
    scoringUrls: () => ({}),
  },
)

const emit = defineEmits<{
  'update:editDraft': [value: string]
  startEdit: [path: OutlinePath, text: string]
  commitEdit: [path: OutlinePath]
  cancelEdit: []
  prune: [path: OutlinePath]
  moveFeed: [path: OutlinePath]
  toggleSelect: [xmlUrl: string, shiftKey: boolean, modKey: boolean]
  toggleFolder: [pathKey: string]
  useSuggestedUrl: [path: OutlinePath, xmlUrl: string]
  discoverFeeds: [path: OutlinePath]
  markUnhealthy: [path: OutlinePath]
}>()

function pathKey(path: OutlinePath): string {
  return path.join('.')
}

const selectedSet = computed(() => new Set(props.selectedUrls))

function isSelected(xmlUrl: string): boolean {
  return selectedSet.value.has(xmlUrl)
}

function isSelectModifier(ev: MouseEvent): boolean {
  return ev.shiftKey || ev.ctrlKey || ev.metaKey
}

function isSelectControlTarget(t: EventTarget | null): boolean {
  return Boolean(
    (t as HTMLElement | null)?.closest(
      'a, button, [role="menu"], [role="menuitem"], [role="checkbox"]',
    ),
  )
}

/** Prevent native text-span selection when Shift/Ctrl/Cmd drive multi-select. */
function onFeedRowPointerDown(_xmlUrl: string, ev: MouseEvent) {
  if (!isSelectModifier(ev) || isSelectControlTarget(ev.target)) return
  ev.preventDefault()
}

function onFeedRowClick(xmlUrl: string, ev: MouseEvent) {
  if (!isSelectModifier(ev) || isSelectControlTarget(ev.target)) return
  ev.preventDefault()
  window.getSelection()?.removeAllRanges()
  emit('toggleSelect', xmlUrl, ev.shiftKey, ev.ctrlKey || ev.metaKey)
}

function onSelectToggle(xmlUrl: string, ev: MouseEvent) {
  ev.preventDefault()
  ev.stopPropagation()
  emit('toggleSelect', xmlUrl, ev.shiftKey, ev.ctrlKey || ev.metaKey)
}

function isCollapsed(key: string): boolean {
  return Boolean(props.collapsed[key])
}

function feedVisible(feed: {
  text: string
  xmlUrl: string
  htmlUrl?: string
  kind: 'feed'
}): boolean {
  return feedMatchesListFilter(
    feed,
    props.scores,
    props.filterQuery,
    props.filterHealth,
  )
}

function folderVisible(node: OpmlOutline): boolean {
  return outlineMatchesListFilter(
    node,
    props.scores,
    props.filterQuery,
    props.filterHealth,
  )
}

function matchingCount(node: OpmlOutline): number {
  return countMatchingFeeds(
    node,
    props.scores,
    props.filterQuery,
    props.filterHealth,
  )
}

/** xmlUrl → row fix panel open */
const fixUrlOpen = ref<Record<string, boolean>>({})

function isFixOpen(xmlUrl: string): boolean {
  return Boolean(fixUrlOpen.value[xmlUrl])
}

function toggleFixUrl(xmlUrl: string, path: OutlinePath) {
  const next = !fixUrlOpen.value[xmlUrl]
  fixUrlOpen.value = { ...fixUrlOpen.value, [xmlUrl]: next }
  if (
    next &&
    props.canDiscover &&
    (props.suggestionsByUrl[xmlUrl]?.length ?? 0) === 0 &&
    props.discoveringUrl !== xmlUrl
  ) {
    emit('discoverFeeds', path)
  }
}

function closeFixUrl(xmlUrl: string) {
  if (!fixUrlOpen.value[xmlUrl]) return
  const next = { ...fixUrlOpen.value }
  delete next[xmlUrl]
  fixUrlOpen.value = next
}

function canMarkUnhealthy(xmlUrl: string): boolean {
  return props.scores[xmlUrl]?.health === 'stale'
}

/** Row is mid discover / suggestion score / post-fix re-score / bulk Score. */
function isScoreBusy(xmlUrl: string): boolean {
  if (props.scoringUrls?.[xmlUrl]) return true
  if (props.rescoringUrl === xmlUrl) return true
  if (props.discoveringUrl === xmlUrl) return true
  return Boolean(props.scoringSuggestions && isFixOpen(xmlUrl))
}

function fixStatusNote(xmlUrl: string): string | undefined {
  if (props.reopenFixUrl !== xmlUrl) return undefined
  const h = props.scores[xmlUrl]?.health
  if (h === 'stale') {
    return 'This feed is still stale — try another URL or search again.'
  }
  if (h === 'unhealthy') {
    return 'This feed is still unhealthy — try another URL or search again.'
  }
  return undefined
}

watch(
  () => props.reopenFixUrl,
  (url) => {
    if (!url) return
    fixUrlOpen.value = { ...fixUrlOpen.value, [url]: true }
  },
)
</script>

<template>
  <div class="space-y-3">
    <template v-for="(node, i) in outlines" :key="pathKey([...path, i])">
      <!-- Section card -->
      <section
        v-if="node.kind === 'folder' && folderVisible(node)"
        class="overflow-hidden rounded-lg border border-slate-200/80 bg-slate-100/70 shadow-sm"
      >
        <div
          class="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-200/40"
        >
          <template v-if="editingPath === pathKey([...path, i])">
            <div class="flex min-w-0 flex-1 items-center gap-1.5">
              <input
                class="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                :value="editDraft"
                aria-label="Category name"
                autofocus
                @input="
                  emit(
                    'update:editDraft',
                    ($event.target as HTMLInputElement).value,
                  )
                "
                @keydown.enter.prevent="emit('commitEdit', [...path, i])"
                @keydown.escape.prevent="emit('cancelEdit')"
              />
              <button
                type="button"
                class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-teal-800 hover:bg-teal-50 hover:text-teal-950"
                aria-label="Save category name"
                @click="emit('commitEdit', [...path, i])"
              >
                <Icon icon="tabler:check" class="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Cancel rename"
                @click="emit('cancelEdit')"
              >
                <Icon icon="tabler:x" class="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </template>
          <template v-else>
            <button
              type="button"
              class="inline-flex h-5 w-5 shrink-0 items-center justify-center text-slate-500 transition-transform duration-150 hover:text-slate-800"
              :class="isCollapsed(pathKey([...path, i])) ? '' : 'rotate-90'"
              :aria-expanded="!isCollapsed(pathKey([...path, i]))"
              :aria-label="
                isCollapsed(pathKey([...path, i]))
                  ? `Expand ${node.text}`
                  : `Collapse ${node.text}`
              "
              @click="emit('toggleFolder', pathKey([...path, i]))"
            >
              ▸
            </button>
            <button
              type="button"
              class="min-w-0 flex-1 truncate text-left text-sm font-medium text-slate-800"
              :aria-expanded="!isCollapsed(pathKey([...path, i]))"
              @click="emit('toggleFolder', pathKey([...path, i]))"
            >
              {{ node.text }}
            </button>
            <button
              type="button"
              class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-200/60 hover:text-slate-800"
              :aria-label="`Rename ${node.text}`"
              @click="emit('startEdit', [...path, i], node.text)"
            >
              <Icon icon="tabler:pencil" class="h-4 w-4" aria-hidden="true" />
            </button>
            <span
              class="shrink-0 rounded-full bg-white/90 px-2 py-0.5 text-xs font-normal tabular-nums text-slate-600 ring-1 ring-slate-200/80"
            >
              {{ matchingCount(node) }}
              <template v-if="matchingCount(node) !== countFeeds(node)">
                / {{ countFeeds(node) }}
              </template>
            </span>
            <button
              type="button"
              class="shrink-0 text-sm text-red-700 hover:text-red-900"
              @click="emit('prune', [...path, i])"
            >
              Remove category
            </button>
          </template>
        </div>

        <div
          v-show="!isCollapsed(pathKey([...path, i]))"
          class="space-y-3 border-t border-slate-200/60 bg-white p-2 sm:p-3"
        >
          <ul
            v-if="node.children.some((c) => c.kind === 'feed' && feedVisible(c))"
            class="divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-100"
          >
            <template
              v-for="(child, j) in node.children"
              :key="pathKey([...path, i, j])"
            >
              <li
                v-if="child.kind === 'feed' && feedVisible(child)"
                class="flex flex-col transition-colors"
                :class="[
                  rowWarningClass(scores[child.xmlUrl]),
                  isSelected(child.xmlUrl)
                    ? 'bg-teal-50/70 shadow-[inset_0_3px_0_0_rgb(13,148,136)]'
                    : undefined,
                ]"
                @mousedown="onFeedRowPointerDown(child.xmlUrl, $event)"
                @click="onFeedRowClick(child.xmlUrl, $event)"
              >
                <div
                  class="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div class="flex min-w-0 flex-1 items-center gap-3">
                    <button
                      type="button"
                      role="checkbox"
                      class="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors"
                      :class="
                        isSelected(child.xmlUrl)
                          ? 'border-teal-700 bg-teal-700 text-white'
                          : 'border-slate-300 bg-white text-transparent hover:border-teal-600'
                      "
                      :aria-checked="isSelected(child.xmlUrl)"
                      :aria-label="`Select ${child.text}`"
                      @click="onSelectToggle(child.xmlUrl, $event)"
                    >
                      <Icon
                        icon="tabler:check"
                        class="h-3 w-3"
                        aria-hidden="true"
                      />
                    </button>
                    <FeedAvatar
                      :text="child.text"
                      :xml-url="child.xmlUrl"
                      :html-url="child.htmlUrl"
                    />
                    <div class="min-w-0 flex-1 space-y-1.5">
                      <template v-if="editingPath === pathKey([...path, i, j])">
                        <div class="flex items-center gap-1.5">
                          <input
                            class="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                            :value="editDraft"
                            aria-label="Feed title"
                            autofocus
                            @input="
                              emit(
                                'update:editDraft',
                                ($event.target as HTMLInputElement).value,
                              )
                            "
                            @keydown.enter.prevent="emit('commitEdit', [...path, i, j])"
                            @keydown.escape.prevent="emit('cancelEdit')"
                          />
                          <button
                            type="button"
                            class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-teal-800 hover:bg-teal-50"
                            aria-label="Save title"
                            @click="emit('commitEdit', [...path, i, j])"
                          >
                            <Icon icon="tabler:check" class="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
                            aria-label="Cancel edit"
                            @click="emit('cancelEdit')"
                          >
                            <Icon icon="tabler:x" class="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </template>
                      <p v-else class="text-sm font-medium text-slate-900">
                        {{ child.text }}
                      </p>
                      <p class="truncate text-xs text-slate-500">{{ child.xmlUrl }}</p>
                      <div class="flex flex-wrap items-center gap-1.5">
                        <ScoringStatusPill v-if="isScoreBusy(child.xmlUrl)" />
                        <template v-else>
                          <span
                            class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
                            :class="healthPill(scores[child.xmlUrl]).className"
                            :title="healthPill(scores[child.xmlUrl]).title"
                          >
                            {{ healthPill(scores[child.xmlUrl]).label }}
                          </span>
                          <span
                            v-if="pingFrequencyFor(scores[child.xmlUrl], timeframe)"
                            class="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums ring-1 ring-inset"
                            :class="
                              pingBandClass(
                                pingFrequencyFor(scores[child.xmlUrl], timeframe)!.band,
                              )
                            "
                            :title="
                              pingFrequencyFor(scores[child.xmlUrl], timeframe)!.tooltip
                            "
                          >
                            <Icon
                              :icon="
                                radarIcon(
                                  pingFrequencyFor(scores[child.xmlUrl], timeframe)!.band,
                                )
                              "
                              class="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            {{ pingFrequencyFor(scores[child.xmlUrl], timeframe)!.score }}
                          </span>
                          <span
                            v-else-if="
                              scores[child.xmlUrl]?.health === 'ok' &&
                              scores[child.xmlUrl]?.velocityUnknown
                            "
                            class="text-xs text-slate-500"
                          >
                            Cadence unknown
                          </span>
                        </template>
                      </div>
                    </div>
                  </div>
                  <FeedActionsMenu
                    :fix-open="isFixOpen(child.xmlUrl)"
                    :suggestion-count="suggestionsByUrl[child.xmlUrl]?.length ?? 0"
                    @edit-title="emit('startEdit', [...path, i, j], child.text)"
                    @move-category="emit('moveFeed', [...path, i, j])"
                    @toggle-fix-url="toggleFixUrl(child.xmlUrl, [...path, i, j])"
                    @delete="emit('prune', [...path, i, j])"
                  />
                </div>
                <div
                  v-if="isFixOpen(child.xmlUrl)"
                  class="border-t border-slate-200/80 px-3 pb-3 pt-2 sm:pl-14"
                >
                  <FeedUrlSuggestions
                    :suggestions="suggestionsByUrl[child.xmlUrl] ?? []"
                    :scores="suggestionScores"
                    :timeframe="timeframe"
                    :discovering="discoveringUrl === child.xmlUrl"
                    :scoring="scoringSuggestions"
                    :can-discover="canDiscover"
                    :can-mark-unhealthy="canMarkUnhealthy(child.xmlUrl)"
                    :discover-error="discoverErrorByUrl[child.xmlUrl]"
                    :status-note="fixStatusNote(child.xmlUrl)"
                    @use="emit('useSuggestedUrl', [...path, i, j], $event)"
                    @discover="emit('discoverFeeds', [...path, i, j])"
                    @mark-unhealthy="
                      closeFixUrl(child.xmlUrl);
                      emit('markUnhealthy', [...path, i, j])
                    "
                    @collapse="closeFixUrl(child.xmlUrl)"
                  />
                </div>
              </li>
            </template>
          </ul>

          <OutlineList
            v-if="node.children.some((c) => c.kind === 'folder' && folderVisible(c))"
            :outlines="node.children"
            :path="[...path, i]"
            :editing-path="editingPath"
            :edit-draft="editDraft"
            :scores="scores"
            :collapsed="collapsed"
            :timeframe="timeframe"
            :filter-query="filterQuery"
            :filter-health="filterHealth"
            :suggestions-by-url="suggestionsByUrl"
            :suggestion-scores="suggestionScores"
            :scoring-suggestions="scoringSuggestions"
            :discovering-url="discoveringUrl"
            :rescoring-url="rescoringUrl"
            :reopen-fix-url="reopenFixUrl"
            :discover-error-by-url="discoverErrorByUrl"
            :can-discover="canDiscover"
            :selected-urls="selectedUrls"
            :scoring-urls="scoringUrls"
            sections-only
            @update:edit-draft="emit('update:editDraft', $event)"
            @start-edit="(p, t) => emit('startEdit', p, t)"
            @commit-edit="(p) => emit('commitEdit', p)"
            @cancel-edit="emit('cancelEdit')"
            @prune="(p) => emit('prune', p)"
            @move-feed="(p) => emit('moveFeed', p)"
            @toggle-select="(u, shift, mod) => emit('toggleSelect', u, shift, mod)"
            @toggle-folder="(k) => emit('toggleFolder', k)"
            @use-suggested-url="(p, u) => emit('useSuggestedUrl', p, u)"
            @discover-feeds="(p) => emit('discoverFeeds', p)"
            @mark-unhealthy="(p) => emit('markUnhealthy', p)"
          />
        </div>
      </section>

      <!-- Root-level ungrouped feed (skipped when sectionsOnly) -->
      <article
        v-else-if="!sectionsOnly && node.kind === 'feed' && feedVisible(node)"
        class="overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-sm transition-colors"
        :class="[
          rowWarningClass(scores[node.xmlUrl]),
          isSelected(node.xmlUrl)
            ? 'border-teal-500/80 bg-teal-50/70 shadow-[inset_0_3px_0_0_rgb(13,148,136)]'
            : undefined,
        ]"
        @mousedown="onFeedRowPointerDown(node.xmlUrl, $event)"
        @click="onFeedRowClick(node.xmlUrl, $event)"
      >
        <div
          class="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              role="checkbox"
              class="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors"
              :class="
                isSelected(node.xmlUrl)
                  ? 'border-teal-700 bg-teal-700 text-white'
                  : 'border-slate-300 bg-white text-transparent hover:border-teal-600'
              "
              :aria-checked="isSelected(node.xmlUrl)"
              :aria-label="`Select ${node.text}`"
              @click="onSelectToggle(node.xmlUrl, $event)"
            >
              <Icon icon="tabler:check" class="h-3 w-3" aria-hidden="true" />
            </button>
            <FeedAvatar
              :text="node.text"
              :xml-url="node.xmlUrl"
              :html-url="node.htmlUrl"
            />
            <div class="min-w-0 flex-1 space-y-1.5">
              <template v-if="editingPath === pathKey([...path, i])">
                <div class="flex items-center gap-1.5">
                  <input
                    class="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                    :value="editDraft"
                    aria-label="Feed title"
                    autofocus
                    @input="emit('update:editDraft', ($event.target as HTMLInputElement).value)"
                    @keydown.enter.prevent="emit('commitEdit', [...path, i])"
                    @keydown.escape.prevent="emit('cancelEdit')"
                  />
                  <button
                    type="button"
                    class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-teal-800 hover:bg-teal-50"
                    aria-label="Save title"
                    @click="emit('commitEdit', [...path, i])"
                  >
                    <Icon icon="tabler:check" class="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
                    aria-label="Cancel edit"
                    @click="emit('cancelEdit')"
                  >
                    <Icon icon="tabler:x" class="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </template>
              <p v-else class="text-sm font-medium text-slate-900">
                {{ node.text }}
              </p>
              <p class="truncate text-xs text-slate-500">{{ node.xmlUrl }}</p>
              <div class="flex flex-wrap items-center gap-1.5">
                <ScoringStatusPill v-if="isScoreBusy(node.xmlUrl)" />
                <template v-else>
                  <span
                    class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
                    :class="healthPill(scores[node.xmlUrl]).className"
                    :title="healthPill(scores[node.xmlUrl]).title"
                  >
                    {{ healthPill(scores[node.xmlUrl]).label }}
                  </span>
                  <span
                    v-if="pingFrequencyFor(scores[node.xmlUrl], timeframe)"
                    class="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums ring-1 ring-inset"
                    :class="
                      pingBandClass(pingFrequencyFor(scores[node.xmlUrl], timeframe)!.band)
                    "
                    :title="pingFrequencyFor(scores[node.xmlUrl], timeframe)!.tooltip"
                  >
                    <Icon
                      :icon="
                        radarIcon(pingFrequencyFor(scores[node.xmlUrl], timeframe)!.band)
                      "
                      class="h-3.5 w-3.5"
                      aria-hidden="true"
                    />
                    {{ pingFrequencyFor(scores[node.xmlUrl], timeframe)!.score }}
                  </span>
                  <span
                    v-else-if="
                      scores[node.xmlUrl]?.health === 'ok' &&
                      scores[node.xmlUrl]?.velocityUnknown
                    "
                    class="text-xs text-slate-500"
                  >
                    Cadence unknown
                  </span>
                </template>
              </div>
            </div>
          </div>
          <FeedActionsMenu
            :fix-open="isFixOpen(node.xmlUrl)"
            :suggestion-count="suggestionsByUrl[node.xmlUrl]?.length ?? 0"
            @edit-title="emit('startEdit', [...path, i], node.text)"
            @move-category="emit('moveFeed', [...path, i])"
            @toggle-fix-url="toggleFixUrl(node.xmlUrl, [...path, i])"
            @delete="emit('prune', [...path, i])"
          />
        </div>
        <div
          v-if="isFixOpen(node.xmlUrl)"
          class="border-t border-slate-200/80 px-3 pb-3 pt-2 sm:pl-14"
        >
          <FeedUrlSuggestions
            :suggestions="suggestionsByUrl[node.xmlUrl] ?? []"
            :scores="suggestionScores"
            :timeframe="timeframe"
            :discovering="discoveringUrl === node.xmlUrl"
            :scoring="scoringSuggestions"
            :can-discover="canDiscover"
            :can-mark-unhealthy="canMarkUnhealthy(node.xmlUrl)"
            :discover-error="discoverErrorByUrl[node.xmlUrl]"
            :status-note="fixStatusNote(node.xmlUrl)"
            @use="emit('useSuggestedUrl', [...path, i], $event)"
            @discover="emit('discoverFeeds', [...path, i])"
            @mark-unhealthy="
              closeFixUrl(node.xmlUrl);
              emit('markUnhealthy', [...path, i])
            "
            @collapse="closeFixUrl(node.xmlUrl)"
          />
        </div>
      </article>
    </template>
  </div>
</template>
