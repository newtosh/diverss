import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import AddCategoryModal from './AddCategoryModal.vue'

describe('AddCategoryModal', () => {
  it('emits confirm with the entered name and parent path', async () => {
    const wrapper = mount(AddCategoryModal, {
      props: {
        open: true,
        sections: [{ path: [0], label: 'News' }],
      },
      attachTo: document.body,
    })
    await nextTick()

    const nameInput = document.querySelector('input[type="text"]') as HTMLInputElement
    nameInput.value = 'Gadgets'
    nameInput.dispatchEvent(new Event('input'))
    const select = document.querySelector('select') as HTMLSelectElement
    select.value = '0'
    select.dispatchEvent(new Event('change'))
    await nextTick()

    const addBtn = [...document.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Add category',
    ) as HTMLElement
    addBtn.click()

    expect(wrapper.emitted('confirm')?.[0]?.[0]).toEqual({
      text: 'Gadgets',
      parentPath: [0],
    })
    wrapper.unmount()
  })

  it('emits cancel on Escape', async () => {
    const wrapper = mount(AddCategoryModal, {
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
