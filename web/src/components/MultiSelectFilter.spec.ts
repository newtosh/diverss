import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MultiSelectFilter from './MultiSelectFilter.vue'

const options = [
  { id: 'a', label: 'Apple' },
  { id: 'b', label: 'Blocked' },
]

describe('MultiSelectFilter', () => {
  it('shows All when nothing selected, the label when one is, and a count otherwise', async () => {
    const wrapper = mount(MultiSelectFilter, {
      props: { modelValue: [], options, groupAriaLabel: 'Test' },
    })
    expect(wrapper.text()).toContain('All')

    await wrapper.setProps({ modelValue: ['a'] })
    expect(wrapper.text()).toContain('Apple')

    await wrapper.setProps({ modelValue: ['a', 'b'] })
    expect(wrapper.text()).toContain('2 selected')
  })

  it('toggles an option on click, emitting the updated selection', async () => {
    const wrapper = mount(MultiSelectFilter, {
      props: { modelValue: ['a'], options, groupAriaLabel: 'Test' },
      attachTo: document.body,
    })
    await wrapper.find('button[aria-label="Test"]').trigger('click')
    const blockedButton = [...document.body.querySelectorAll('button')].find(
      (b) => b.textContent?.includes('Blocked'),
    )
    blockedButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toEqual(['a', 'b'])
    wrapper.unmount()
  })
})
