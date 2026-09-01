import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import CommunitySourcesModal from './CommunitySourcesModal.vue'

describe('CommunitySourcesModal', () => {
  it('renders the browse pane and emits cancel from the Cancel button', async () => {
    const wrapper = mount(CommunitySourcesModal, {
      props: { open: true, sources: [], existingUrls: [] },
      attachTo: document.body,
    })
    await nextTick()

    expect(document.body.textContent).toContain('Community sources')

    const cancelBtn = [...document.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Cancel',
    ) as HTMLElement
    cancelBtn.click()

    expect(wrapper.emitted('cancel')).toBeTruthy()
    wrapper.unmount()
  })

  it('steps back to Browse (not close) on Escape while in the Advanced pane', async () => {
    const wrapper = mount(CommunitySourcesModal, {
      props: { open: true, sources: [], existingUrls: [] },
      attachTo: document.body,
    })
    await nextTick()

    const advancedBtn = [...document.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Advanced…',
    ) as HTMLElement
    advancedBtn.click()
    await nextTick()
    expect(document.body.textContent).toContain('Reset defaults')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()

    expect(wrapper.emitted('cancel')).toBeFalsy()
    expect(document.body.textContent).toContain('Advanced…')
    wrapper.unmount()
  })
})
