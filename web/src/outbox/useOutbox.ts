import { computed, onMounted, onUnmounted, shallowRef } from 'vue'
import {
  getOutboxEntries,
  isOutboxDrawerOpen,
  subscribeOutbox,
} from './store'
import type { OutboxEntry } from './types'

/** Reactive view of the session Outbox module store. */
export function useOutbox() {
  const tick = shallowRef(0)
  let unsubscribe: (() => void) | undefined

  function bump() {
    tick.value++
  }

  onMounted(() => {
    unsubscribe = subscribeOutbox(bump)
  })
  onUnmounted(() => {
    unsubscribe?.()
  })

  const entries = computed((): readonly OutboxEntry[] => {
    void tick.value
    return getOutboxEntries()
  })

  const count = computed(() => entries.value.length)

  const drawerOpen = computed(() => {
    void tick.value
    return isOutboxDrawerOpen()
  })

  const importableCount = computed(
    () => entries.value.filter((e) => !e.alreadyInWorkspace).length,
  )

  return { entries, count, drawerOpen, importableCount }
}
