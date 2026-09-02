<script setup lang="ts">
import { Icon } from '@iconify/vue'

withDefaults(
  defineProps<{
    /** 'loading' plays the bloom pulse; 'static' (default) is the plain identity mark. */
    state?: 'static' | 'loading'
    /** 'sm' is an inline glyph; 'lg' is sized for hero/empty-state placement. */
    size?: 'sm' | 'lg'
  }>(),
  {
    state: 'static',
    size: 'sm',
  },
)
</script>

<template>
  <Icon
    icon="tabler:flower"
    :class="[
      size === 'lg' ? 'h-16 w-16 sm:h-20 sm:w-20' : 'h-5 w-5',
      state === 'loading' ? 'motion-safe:animate-gr-bloom' : '',
    ]"
    class="text-gr-accent"
    aria-hidden="true"
  />
</template>
