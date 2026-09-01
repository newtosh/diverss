<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { siteAvatarUrl, siteHostname, siteHue, siteInitial } from '@/lib/siteAvatar'

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
  props.size === 'sm' ? 'h-9 w-9 text-xs' : 'h-12 w-12 text-sm',
)

// Per-host tint stands in for real favicon color extraction — the favicon
// CDN sends no CORS header, so canvas pixel reads are blocked.
const tintStyle = computed(() => {
  const hue = siteHue(siteHostname(props.xmlUrl, props.htmlUrl) ?? props.text)
  return {
    backgroundColor: `color-mix(in srgb, hsl(${hue} 55% 45%) 22%, var(--color-gr-surface-2))`,
  }
})
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl text-gr-text ring-1 ring-gr-border"
    :class="boxClass"
    :style="tintStyle"
    aria-hidden="true"
  >
    <img
      v-if="src && !failed"
      :src="src"
      alt=""
      class="h-full w-full object-contain p-1.5"
      loading="lazy"
      decoding="async"
      @error="failed = true"
    />
    <span v-else class="font-semibold">{{ initial }}</span>
  </span>
</template>
