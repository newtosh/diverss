<script setup lang="ts">
import { onActivated, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import OutboxPanel from '@/components/OutboxPanel.vue'
import type { OpmlDocument } from '@/opml/types'
import { emptyOpmlDocument } from '@/opml/types'
import { loadWorkspace, saveWorkspace, workspaceEpoch } from '@/db/workspace'

const workspace = ref<OpmlDocument>(emptyOpmlDocument())
const ready = ref(false)
const status = ref('')
const error = ref('')

async function refresh() {
  workspace.value = await loadWorkspace()
  ready.value = true
}

onMounted(() => {
  void refresh()
})
onActivated(() => {
  void refresh()
})

watch(workspaceEpoch, () => {
  if (!ready.value) return
  void refresh()
})

async function onImported(summary: {
  document: OpmlDocument
  added: number
  skippedAlreadyPresent: number
  createdCategories: string[]
}) {
  error.value = ''
  workspace.value = summary.document
  await saveWorkspace(summary.document)
  const parts: string[] = []
  if (summary.added) parts.push(`${summary.added} added`)
  if (summary.skippedAlreadyPresent) {
    parts.push(`${summary.skippedAlreadyPresent} already present`)
  }
  if (summary.createdCategories.length) {
    parts.push(
      `${summary.createdCategories.length} categor${summary.createdCategories.length === 1 ? 'y' : 'ies'} created`,
    )
  }
  status.value = parts.length ? parts.join(' · ') : 'Nothing to import.'
}
</script>

<template>
  <section v-if="ready" class="space-y-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div class="space-y-1">
        <h1 class="text-xl font-semibold">Deck</h1>
        <p class="text-sm text-gr-text-muted">
          Stage feeds from
          <RouterLink class="text-gr-accent-strong underline" to="/catalog"
            >Catalog</RouterLink
          >, remap categories, then import into your
          <RouterLink class="text-gr-accent-strong underline" to="/"
            >Garden</RouterLink
          >.
        </p>
      </div>
      <p
        class="min-h-5 text-right text-sm"
        :class="error ? 'text-gr-danger-strong' : 'text-gr-accent-strong'"
        :role="error ? 'alert' : status ? 'status' : undefined"
      >
        <span v-if="error">{{ error }}</span>
        <span v-else-if="status">{{ status }}</span>
      </p>
    </div>

    <div
      class="overflow-hidden rounded-lg border border-gr-border bg-gr-surface shadow-sm"
    >
      <OutboxPanel
        :document="workspace"
        variant="page"
        @imported="onImported"
      />
    </div>
  </section>
  <p v-else class="text-sm text-gr-text-muted">Loading deck…</p>
</template>
