import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ReaderPanelTabs from './ReaderPanelTabs.vue'

describe('ReaderPanelTabs', () => {
  it('renders a tab for each section with correct aria-selected', () => {
    const wrapper = mount(ReaderPanelTabs, {
      props: { modelValue: 'connection' },
    })
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs.map((t) => t.text())).toEqual([
      'Connection',
      'Filters',
      'Health',
      'Admin',
    ])
    expect(tabs[0]!.attributes('aria-selected')).toBe('true')
    expect(tabs[1]!.attributes('aria-selected')).toBe('false')
  })

  it('emits update:modelValue when a tab is clicked', async () => {
    const wrapper = mount(ReaderPanelTabs, {
      props: { modelValue: 'connection' },
      attachTo: document.body,
    })
    const tabs = wrapper.findAll('[role="tab"]')
    await tabs[1]!.trigger('mousedown', { button: 0 })
    await nextTick()

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['filters'])
    wrapper.unmount()
  })
})
