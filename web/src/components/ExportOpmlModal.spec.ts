import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ExportOpmlModal from './ExportOpmlModal.vue'

describe('ExportOpmlModal', () => {
  it('seeds the title from initialTitle and emits confirm with the edited title', async () => {
    const wrapper = mount(ExportOpmlModal, {
      props: { open: false, initialTitle: 'My feeds' },
      attachTo: document.body,
    })
    await wrapper.setProps({ open: true })
    await nextTick()

    const input = document.querySelector('input[type="text"]') as HTMLInputElement
    expect(input.value).toBe('My feeds')

    input.value = 'Exported feeds'
    input.dispatchEvent(new Event('input'))
    await nextTick()

    const downloadBtn = [...document.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Download OPML',
    ) as HTMLElement
    downloadBtn.click()

    expect(wrapper.emitted('confirm')?.[0]).toEqual(['Exported feeds'])
    wrapper.unmount()
  })

  it('emits cancel on Escape', async () => {
    const wrapper = mount(ExportOpmlModal, {
      props: { open: true, initialTitle: 'My feeds' },
      attachTo: document.body,
    })
    await nextTick()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()

    expect(wrapper.emitted('cancel')).toBeTruthy()
    wrapper.unmount()
  })
})
