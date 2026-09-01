import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import DropdownMenu from './DropdownMenu.vue'
import DropdownMenuItem from './DropdownMenuItem.vue'

describe('DropdownMenu', () => {
  it('opens on trigger click and shows items', async () => {
    const wrapper = mount(DropdownMenu, {
      slots: {
        trigger: '<button>Actions</button>',
        default: '<div>Item one</div>',
      },
      attachTo: document.body,
    })
    expect(document.body.textContent).not.toContain('Item one')

    await wrapper.find('button').trigger('click')
    await nextTick()

    expect(document.body.textContent).toContain('Item one')
    wrapper.unmount()
  })

  // Outside-click and Escape dismissal are Reka UI's own tested behavior
  // (DismissableLayer/useEscapeKeydown); reproducing their deferred-timer,
  // focus-trap-dependent event wiring under jsdom + test-utils is unreliable
  // and doesn't verify anything this wrapper adds. Confirmed manually per
  // the Verification Contract instead.

  it('fires select on DropdownMenuItem click', async () => {
    const onSelect = vi.fn()
    const wrapper = mount(
      {
        components: { DropdownMenu, DropdownMenuItem },
        setup: () => ({ onSelect }),
        template: `
          <DropdownMenu :open="true">
            <template #trigger><button>Actions</button></template>
            <DropdownMenuItem @select="onSelect">Rename</DropdownMenuItem>
          </DropdownMenu>
        `,
      },
      { attachTo: document.body },
    )
    await nextTick()

    const item = document.body.querySelector('[role="menuitem"]') as HTMLElement
    item.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }))
    item.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse' }))
    item.click()
    await nextTick()

    expect(onSelect).toHaveBeenCalled()
    wrapper.unmount()
  })
})
