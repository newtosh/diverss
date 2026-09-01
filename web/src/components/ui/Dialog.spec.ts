import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import Dialog from './Dialog.vue'

describe('Dialog', () => {
  it('renders content when open and not when closed', async () => {
    const wrapper = mount(Dialog, {
      props: { open: false, title: 'Confirm' },
      slots: { default: 'Body text' },
      attachTo: document.body,
    })
    expect(document.body.textContent).not.toContain('Body text')

    await wrapper.setProps({ open: true })
    await nextTick()
    expect(document.body.textContent).toContain('Body text')
    expect(document.body.textContent).toContain('Confirm')

    wrapper.unmount()
  })

  it('emits update:open false on Escape while open', async () => {
    const wrapper = mount(Dialog, {
      props: { open: true },
      slots: { default: 'Body text' },
      attachTo: document.body,
    })
    await nextTick()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()

    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])

    wrapper.unmount()
  })

  it('renders footer slot only when provided', async () => {
    const wrapper = mount(Dialog, {
      props: { open: true },
      slots: { default: 'Body', footer: 'Actions' },
      attachTo: document.body,
    })
    await nextTick()
    expect(document.body.textContent).toContain('Actions')
    wrapper.unmount()
  })
})
