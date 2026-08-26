<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { downloadOpmlBackup } from '@/tools/backup'

const props = defineProps<{
  open: boolean
  title: string
  busy?: boolean
  exportOpml: () => Promise<string>
}>()

const emit = defineEmits<{
  cancel: []
  confirm: []
}>()

const backupDone = ref(false)
const confirmed = ref(false)
const exporting = ref(false)
const error = ref('')

watch(
  () => props.open,
  (open) => {
    if (open) {
      backupDone.value = false
      confirmed.value = false
      error.value = ''
    }
  },
)

const canConfirm = computed(
  () => backupDone.value && confirmed.value && !props.busy && !exporting.value,
)

async function onDownload() {
  error.value = ''
  exporting.value = true
  try {
    const opml = await props.exportOpml()
    downloadOpmlBackup(opml, props.title)
    backupDone.value = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Backup export failed.'
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      @click.self="emit('cancel')"
    >
      <div
        class="w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-lg"
      >
        <h2 class="text-lg font-semibold text-slate-900">{{ title }}</h2>
        <p class="mt-2 text-sm text-slate-600">
          Download a backup of the reader’s current OPML first. Wipe cannot run
          until the backup is saved and you confirm.
        </p>

        <div class="mt-4 space-y-3">
          <button
            type="button"
            class="rounded-md border border-teal-700 px-3 py-1.5 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-50"
            :disabled="exporting || busy"
            @click="onDownload"
          >
            {{ exporting ? 'Exporting…' : 'Download OPML backup' }}
          </button>
          <label class="flex items-start gap-2 text-sm text-slate-800">
            <input v-model="backupDone" type="checkbox" class="mt-0.5" />
            <span>I saved the backup file</span>
          </label>
          <label class="flex items-start gap-2 text-sm text-slate-800">
            <input
              v-model="confirmed"
              type="checkbox"
              class="mt-0.5"
              :disabled="!backupDone"
            />
            <span
              >I understand this permanently removes feeds on the reader</span
            >
          </label>
          <p v-if="error" class="text-sm text-red-700" role="alert">
            {{ error }}
          </p>
        </div>

        <div class="mt-5 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            @click="emit('cancel')"
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-md border border-red-700 bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-40"
            :disabled="!canConfirm"
            @click="emit('confirm')"
          >
            {{ busy ? 'Working…' : 'Wipe feeds' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
