import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import Popover from './Popover.vue'

describe('Popover', () => {
  it('opens on trigger click and renders content', async () => {
    const wrapper = mount(Popover, {
      slots: {
        trigger: '<button>Info</button>',
        default: '<div>Popover body</div>',
      },
      attachTo: document.body,
    })
    expect(document.body.textContent).not.toContain('Popover body')

    await wrapper.find('button').trigger('click')
    await nextTick()

    expect(document.body.textContent).toContain('Popover body')
    wrapper.unmount()
  })

  // Outside-click and Escape dismissal are Reka UI's own tested behavior
  // (DismissableLayer/useEscapeKeydown); reproducing their deferred-timer,
  // focus-trap-dependent event wiring under jsdom + test-utils is unreliable
  // and doesn't verify anything this wrapper adds. Confirmed manually per
  // the Verification Contract instead.
})
