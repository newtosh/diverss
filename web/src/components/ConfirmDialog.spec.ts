import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ConfirmDialog from './ConfirmDialog.vue'
import { confirm } from '@/lib/confirm'

describe('ConfirmDialog', () => {
  it('renders the message and resolves true on confirm', async () => {
    const wrapper = mount(ConfirmDialog, { attachTo: document.body })
    const pending = confirm('Delete this feed?', { confirmLabel: 'Delete', danger: true })
    await nextTick()

    expect(document.body.textContent).toContain('Delete this feed?')
    const confirmBtn = [...document.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Delete',
    ) as HTMLElement
    confirmBtn.click()

    expect(await pending).toBe(true)
    wrapper.unmount()
  })

  it('resolves false on cancel', async () => {
    const wrapper = mount(ConfirmDialog, { attachTo: document.body })
    const pending = confirm('Remove category?')
    await nextTick()

    const cancelBtn = [...document.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Cancel',
    ) as HTMLElement
    cancelBtn.click()

    expect(await pending).toBe(false)
    wrapper.unmount()
  })

  it('resolves false on Escape', async () => {
    const wrapper = mount(ConfirmDialog, { attachTo: document.body })
    const pending = confirm('Remove category?')
    await nextTick()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()

    expect(await pending).toBe(false)
    wrapper.unmount()
  })
})
