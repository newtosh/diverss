import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import AddFeedModal from './AddFeedModal.vue'

describe('AddFeedModal', () => {
  it('emits confirm with the entered URL and title once the form is valid', async () => {
    const wrapper = mount(AddFeedModal, {
      props: {
        open: true,
        sections: [{ path: [0], label: 'News' }],
      },
      attachTo: document.body,
    })
    await nextTick()

    const urlInput = document.querySelector('input[type="url"]') as HTMLInputElement
    urlInput.value = 'https://example.com/feed.xml'
    urlInput.dispatchEvent(new Event('input'))
    await nextTick()

    const titleInput = document.querySelector('input[type="text"]') as HTMLInputElement
    titleInput.value = 'Example Feed'
    titleInput.dispatchEvent(new Event('input'))
    await nextTick()

    const addBtn = [...document.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Add feed',
    ) as HTMLButtonElement
    expect(addBtn.disabled).toBe(false)
    addBtn.click()

    expect(wrapper.emitted('confirm')?.[0]?.[0]).toMatchObject({
      text: 'Example Feed',
      xmlUrl: 'https://example.com/feed.xml',
      sectionPath: null,
    })
    wrapper.unmount()
  })

  it('emits cancel on Escape', async () => {
    const wrapper = mount(AddFeedModal, {
      props: { open: true, sections: [] },
      attachTo: document.body,
    })
    await nextTick()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()

    expect(wrapper.emitted('cancel')).toBeTruthy()
    wrapper.unmount()
  })
})
