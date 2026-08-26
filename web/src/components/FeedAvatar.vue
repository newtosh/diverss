<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { siteAvatarUrl, siteInitial } from '@/lib/siteAvatar'

const props = withDefaults(
  defineProps<{
    text: string
    xmlUrl: string
    htmlUrl?: string
    size?: 'sm' | 'md'
  }>(),
  { size: 'md' },
)

const failed = ref(false)
const src = computed(() => siteAvatarUrl(props.xmlUrl, props.htmlUrl))
const initial = computed(() => siteInitial(props.text))

watch(
  () => [props.xmlUrl, props.htmlUrl] as const,
  () => {
    failed.value = false
  },
)

const boxClass = computed(() =>
  props.size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm',
)
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100 text-slate-600 ring-1 ring-slate-200/80"
    :class="boxClass"
    aria-hidden="true"
  >
    <img
      v-if="src && !failed"
      :src="src"
      alt=""
      class="h-full w-full object-contain p-1"
      loading="lazy"
      decoding="async"
      @error="failed = true"
    />
    <span v-else class="font-semibold">{{ initial }}</span>
  </span>
</template>
