import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import WipeBackupModal from './WipeBackupModal.vue'

function findButton(text: string) {
  return [...document.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === text,
  ) as HTMLButtonElement
}

describe('WipeBackupModal', () => {
  it('gates confirm behind a downloaded backup and both checkboxes', async () => {
    const exportOpml = vi.fn().mockResolvedValue('<opml></opml>')
    const wrapper = mount(WipeBackupModal, {
      props: { open: true, title: 'Wipe all feeds', exportOpml },
      attachTo: document.body,
    })
    await nextTick()

    expect(findButton('Wipe feeds').disabled).toBe(true)

    findButton('Download OPML backup').click()
    await nextTick()
    await nextTick()
    expect(exportOpml).toHaveBeenCalled()

    const checkboxes = [...document.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[]
    checkboxes[0]!.checked = true
    checkboxes[0]!.dispatchEvent(new Event('change'))
    await nextTick()
    checkboxes[1]!.checked = true
    checkboxes[1]!.dispatchEvent(new Event('change'))
    await nextTick()

    expect(findButton('Wipe feeds').disabled).toBe(false)
    findButton('Wipe feeds').click()

    expect(wrapper.emitted('confirm')).toBeTruthy()
    wrapper.unmount()
  })

  it('emits cancel on Escape', async () => {
    const wrapper = mount(WipeBackupModal, {
      props: { open: true, title: 'Wipe all feeds', exportOpml: vi.fn() },
      attachTo: document.body,
    })
    await nextTick()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()

    expect(wrapper.emitted('cancel')).toBeTruthy()
    wrapper.unmount()
  })

  it('emits cancel when Cancel is clicked', async () => {
    const wrapper = mount(WipeBackupModal, {
      props: { open: true, title: 'Wipe all feeds', exportOpml: vi.fn() },
      attachTo: document.body,
    })
    await nextTick()

    findButton('Cancel').click()

    expect(wrapper.emitted('cancel')).toBeTruthy()
    wrapper.unmount()
  })
})
