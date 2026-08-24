<script setup lang="ts">
import type { OpmlOutline } from '@/opml/types'
import type { OutlinePath } from '@/opml/mutate'

defineProps<{
  outlines: OpmlOutline[]
  path: OutlinePath
  editingPath: string | null
  editDraft: string
}>()

const emit = defineEmits<{
  'update:editDraft': [value: string]
  startEdit: [path: OutlinePath, text: string]
  commitEdit: [path: OutlinePath]
  prune: [path: OutlinePath]
}>()

function pathKey(path: OutlinePath): string {
  return path.join('.')
}
</script>

<template>
  <template v-for="(node, i) in outlines" :key="pathKey([...path, i])">
    <li
      v-if="node.kind === 'folder'"
      class="bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700"
      :style="{ paddingLeft: `${path.length * 12 + 12}px` }"
    >
      {{ node.text }}
      <ul class="mt-1 divide-y divide-slate-100 border-t border-slate-100 bg-white">
        <OutlineList
          :outlines="node.children"
          :path="[...path, i]"
          :editing-path="editingPath"
          :edit-draft="editDraft"
          @update:edit-draft="emit('update:editDraft', $event)"
          @start-edit="(p, t) => emit('startEdit', p, t)"
          @commit-edit="(p) => emit('commitEdit', p)"
          @prune="(p) => emit('prune', p)"
        />
      </ul>
    </li>
    <li
      v-else
      class="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
      :style="{ paddingLeft: `${path.length * 12 + 12}px` }"
    >
      <div class="min-w-0 flex-1 space-y-1">
        <template v-if="editingPath === pathKey([...path, i])">
          <input
            class="w-full rounded border border-slate-300 px-2 py-1 text-sm"
            :value="editDraft"
            @input="emit('update:editDraft', ($event.target as HTMLInputElement).value)"
            @keydown.enter.prevent="emit('commitEdit', [...path, i])"
            @blur="emit('commitEdit', [...path, i])"
          />
        </template>
        <button
          v-else
          type="button"
          class="text-left text-sm font-medium text-slate-900 hover:underline"
          @click="emit('startEdit', [...path, i], node.text)"
        >
          {{ node.text }}
        </button>
        <p class="truncate text-xs text-slate-500">{{ node.xmlUrl }}</p>
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          class="text-sm text-slate-600 hover:text-slate-900"
          @click="emit('startEdit', [...path, i], node.text)"
        >
          Edit title
        </button>
        <button
          type="button"
          class="text-sm text-red-700 hover:text-red-900"
          @click="emit('prune', [...path, i])"
        >
          Remove
        </button>
      </div>
    </li>
  </template>
</template>
