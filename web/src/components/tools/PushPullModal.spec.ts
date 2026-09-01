import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import PushPullModal from './PushPullModal.vue'

function findButton(text: string) {
  return [...document.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === text,
  ) as HTMLButtonElement
}

describe('PushPullModal', () => {
  it('emits choose with the selected mode for push', async () => {
    const wrapper = mount(PushPullModal, {
      props: { open: true, kind: 'push' },
      attachTo: document.body,
    })
    await nextTick()

    const replaceRadio = document.querySelector(
      'input[type="radio"][value="replace"]',
    ) as HTMLInputElement
    replaceRadio.checked = true
    replaceRadio.dispatchEvent(new Event('change'))
    await nextTick()

    findButton('Continue').click()

    expect(wrapper.emitted('choose')?.[0]).toEqual(['replace'])
    wrapper.unmount()
  })

  it('shows the stage option only for pull', async () => {
    const wrapper = mount(PushPullModal, {
      props: { open: true, kind: 'pull' },
      attachTo: document.body,
    })
    await nextTick()

    expect(document.body.textContent).toContain('Stage')
    wrapper.unmount()
  })

  it('emits cancel on Escape', async () => {
    const wrapper = mount(PushPullModal, {
      props: { open: true, kind: 'push' },
      attachTo: document.body,
    })
    await nextTick()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()

    expect(wrapper.emitted('cancel')).toBeTruthy()
    wrapper.unmount()
  })
})
