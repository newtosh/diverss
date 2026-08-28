import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FeedActionsMenu from './FeedActionsMenu.vue'

describe('FeedActionsMenu', () => {
  it('opens the menu on trigger click, positioning against the Button-wrapped trigger element', async () => {
    const wrapper = mount(FeedActionsMenu, { attachTo: document.body })
    await wrapper.find('button[aria-label="Feed actions"]').trigger('click')
    await Promise.resolve()

    expect(document.querySelector('[role="menu"]')).toBeTruthy()
    wrapper.unmount()
  })

  it('closes the menu on an outside pointerdown', async () => {
    const wrapper = mount(FeedActionsMenu, { attachTo: document.body })
    await wrapper.find('button[aria-label="Feed actions"]').trigger('click')
    await Promise.resolve()
    expect(document.querySelector('[role="menu"]')).toBeTruthy()

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await Promise.resolve()

    expect(document.querySelector('[role="menu"]')).toBeFalsy()
    wrapper.unmount()
  })
})
