import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import PruneFeedsModal from './PruneFeedsModal.vue'

describe('PruneFeedsModal', () => {
  it('lists candidates and emits confirm once one is selected', async () => {
    const wrapper = mount(PruneFeedsModal, {
      props: {
        open: true,
        candidates: [
          { xmlUrl: 'https://a.example/feed', text: 'Feed A', health: 'unhealthy', badge: 'Unhealthy' },
        ],
        selected: { 'https://a.example/feed': true },
      },
      attachTo: document.body,
    })
    await nextTick()

    expect(document.body.textContent).toContain('Feed A')

    const removeBtn = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Remove'),
    ) as HTMLButtonElement
    expect(removeBtn.disabled).toBe(false)
    removeBtn.click()

    expect(wrapper.emitted('confirm')).toBeTruthy()
    wrapper.unmount()
  })

  it('emits cancel on Escape', async () => {
    const wrapper = mount(PruneFeedsModal, {
      props: { open: true, candidates: [], selected: {} },
      attachTo: document.body,
    })
    await nextTick()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()

    expect(wrapper.emitted('cancel')).toBeTruthy()
    wrapper.unmount()
  })
})
