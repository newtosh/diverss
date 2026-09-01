<script setup lang="ts">
import { Icon } from '@iconify/vue'
import Button from '@/components/ui/Button.vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import DropdownMenuItem from '@/components/ui/DropdownMenuItem.vue'

defineProps<{
  fixOpen?: boolean
  suggestionCount?: number
}>()

const emit = defineEmits<{
  editTitle: []
  moveCategory: []
  toggleFixUrl: []
  delete: []
}>()
</script>

<template>
  <DropdownMenu>
    <template #trigger>
      <Button variant="ghost" icon-only aria-label="Feed actions">
        <Icon icon="tabler:dots-vertical" class="h-4 w-4" aria-hidden="true" />
      </Button>
    </template>

    <DropdownMenuItem @select="emit('editTitle')">
      <Icon icon="tabler:pencil" class="h-4 w-4 text-gr-text-muted" aria-hidden="true" />
      Edit title
    </DropdownMenuItem>
    <DropdownMenuItem @select="emit('moveCategory')">
      <Icon icon="tabler:folder-symlink" class="h-4 w-4 text-gr-text-muted" aria-hidden="true" />
      Move to category…
    </DropdownMenuItem>
    <DropdownMenuItem @select="emit('toggleFixUrl')">
      <Icon icon="tabler:link" class="h-4 w-4 text-gr-text-muted" aria-hidden="true" />
      {{ fixOpen ? 'Hide fix URL' : 'Fix URL' }}
      <span
        v-if="!fixOpen && (suggestionCount ?? 0) > 0"
        class="ml-auto tabular-nums text-xs text-gr-text-muted"
      >
        {{ suggestionCount }}
      </span>
    </DropdownMenuItem>
    <div class="my-1 border-t border-gr-border" role="separator" />
    <DropdownMenuItem variant="danger" @select="emit('delete')">
      <Icon icon="tabler:trash" class="h-4 w-4" aria-hidden="true" />
      Delete
    </DropdownMenuItem>
  </DropdownMenu>
</template>
