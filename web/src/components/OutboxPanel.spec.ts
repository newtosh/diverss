import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import OutboxPanel from './OutboxPanel.vue'
import { clearOutbox } from '@/outbox/store'
import { emptyOpmlDocument } from '@/opml/types'

async function mountPanel(variant: 'drawer' | 'page') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  })
  await router.push('/')
  await router.isReady()
  return mount(OutboxPanel, {
    props: { document: emptyOpmlDocument(), variant },
    global: { plugins: [router] },
  })
}

describe('OutboxPanel', () => {
  afterEach(() => {
    clearOutbox()
  })

  it('renders a distinct close control in the drawer variant', async () => {
    const wrapper = await mountPanel('drawer')
    const close = wrapper.find('[aria-label="Close Deck"]')
    expect(close.exists()).toBe(true)

    const expand = wrapper.findAll('button').find((b) => b.text() === 'Expand')
    expect(expand).toBeTruthy()
    expect(close.element.parentElement).not.toBe(expand!.element.parentElement)
  })

  it('emits close when the close control is clicked', async () => {
    const wrapper = await mountPanel('drawer')
    await wrapper.find('[aria-label="Close Deck"]').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('renders no close control in the page variant', async () => {
    const wrapper = await mountPanel('page')
    expect(wrapper.find('[aria-label="Close Deck"]').exists()).toBe(false)
  })

  it('disables the import button when there is nothing importable', async () => {
    const wrapper = await mountPanel('page')
    const importButton = wrapper
      .findAll('button')
      .find((b) => b.text() === 'Import to Garden')
    expect(importButton).toBeTruthy()
    expect(importButton!.attributes('disabled')).toBeDefined()
    expect(importButton!.attributes('aria-busy')).toBeUndefined()
  })
})
