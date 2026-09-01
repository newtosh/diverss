import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MoveFeedModal from './MoveFeedModal.vue'

describe('MoveFeedModal', () => {
  it('emits confirm with the chosen folder path', async () => {
    const wrapper = mount(MoveFeedModal, {
      props: {
        open: true,
        feedTitle: 'Example Feed',
        sections: [{ path: [1], label: 'Tech' }],
      },
      attachTo: document.body,
    })
    await nextTick()

    expect(document.body.textContent).toContain('Example Feed')

    const select = document.querySelector('select') as HTMLSelectElement
    select.value = '1'
    select.dispatchEvent(new Event('change'))
    await nextTick()

    const moveBtn = [...document.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Move feed',
    ) as HTMLElement
    moveBtn.click()

    expect(wrapper.emitted('confirm')?.[0]?.[0]).toEqual([1])
    wrapper.unmount()
  })

  it('emits cancel on Escape', async () => {
    const wrapper = mount(MoveFeedModal, {
      props: { open: true, feedTitle: 'Example Feed', sections: [] },
      attachTo: document.body,
    })
    await nextTick()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()

    expect(wrapper.emitted('cancel')).toBeTruthy()
    wrapper.unmount()
  })
})
