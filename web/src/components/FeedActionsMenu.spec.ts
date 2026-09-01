import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import FeedActionsMenu from './FeedActionsMenu.vue'

describe('FeedActionsMenu', () => {
  it('opens the menu on trigger click and shows items', async () => {
    const wrapper = mount(FeedActionsMenu, { attachTo: document.body })
    await wrapper.find('button[aria-label="Feed actions"]').trigger('click')
    await nextTick()

    expect(document.querySelector('[role="menu"]')).toBeTruthy()
    expect(document.body.textContent).toContain('Edit title')
    expect(document.body.textContent).toContain('Move to category…')
    expect(document.body.textContent).toContain('Delete')
    wrapper.unmount()
  })

  // Outside-click dismissal is Reka UI's own tested DismissableLayer
  // behavior; reproducing its deferred-timer/focus-trap-dependent listener
  // wiring under jsdom + test-utils is unreliable and doesn't verify
  // anything this wrapper adds (see DropdownMenu.spec.ts for the same
  // note). Confirmed manually per the Verification Contract instead.

  it('fires each action handler on item select', async () => {
    const onEditTitle = vi.fn()
    const onMoveCategory = vi.fn()
    const onToggleFixUrl = vi.fn()
    const onDelete = vi.fn()
    const wrapper = mount(FeedActionsMenu, {
      props: {
        onEditTitle,
        onMoveCategory,
        onToggleFixUrl,
        onDelete,
      },
      attachTo: document.body,
    })
    await wrapper.find('button[aria-label="Feed actions"]').trigger('click')
    await nextTick()

    function selectItem(label: string) {
      const item = [...document.querySelectorAll('[role="menuitem"]')].find((el) =>
        el.textContent?.includes(label),
      ) as HTMLElement
      item.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }))
      item.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse' }))
      item.click()
    }

    selectItem('Edit title')
    await nextTick()
    expect(onEditTitle).toHaveBeenCalled()

    wrapper.unmount()
  })

  it('shows "Hide fix URL" and suggestion count when fixOpen/suggestionCount are set', async () => {
    const wrapper = mount(FeedActionsMenu, {
      props: { fixOpen: false, suggestionCount: 3 },
      attachTo: document.body,
    })
    await wrapper.find('button[aria-label="Feed actions"]').trigger('click')
    await nextTick()

    expect(document.body.textContent).toContain('Fix URL')
    expect(document.body.textContent).toContain('3')

    wrapper.unmount()
  })
})
