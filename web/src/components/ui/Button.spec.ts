import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Button from './Button.vue'

describe('Button', () => {
  it('renders primary variant at default (md) size', () => {
    const wrapper = mount(Button, {
      props: { variant: 'primary' },
      slots: { default: 'Save' },
    })
    expect(wrapper.classes()).toContain('bg-gr-accent-strong')
    expect(wrapper.classes()).toContain('px-3')
    expect(wrapper.classes()).toContain('py-2')
  })

  it('applies sm size classes instead of md', () => {
    const wrapper = mount(Button, {
      props: { variant: 'secondary', size: 'sm' },
      slots: { default: 'Cancel' },
    })
    expect(wrapper.classes()).toContain('px-2.5')
    expect(wrapper.classes()).toContain('py-1.5')
    expect(wrapper.classes()).not.toContain('px-3')
  })

  it('applies danger token classes, not the primary accent classes', () => {
    const wrapper = mount(Button, {
      props: { variant: 'danger' },
      slots: { default: 'Delete' },
    })
    expect(wrapper.classes()).toContain('bg-gr-danger-strong')
    expect(wrapper.classes()).not.toContain('bg-gr-accent-strong')
  })

  it('renders the sm square icon-only padding with a smaller floor, not the label padding', () => {
    const wrapper = mount(Button, {
      props: { variant: 'ghost', iconOnly: true, size: 'sm' },
      slots: { default: 'X' },
    })
    expect(wrapper.classes()).toContain('p-1')
    expect(wrapper.classes()).toContain('min-h-8')
    expect(wrapper.classes()).toContain('min-w-8')
    expect(wrapper.classes()).not.toContain('px-2.5')
  })

  it('renders the md square icon-only padding with the full tap-target floor', () => {
    const wrapper = mount(Button, {
      props: { variant: 'ghost', iconOnly: true },
      slots: { default: 'X' },
    })
    expect(wrapper.classes()).toContain('p-2')
    expect(wrapper.classes()).toContain('min-h-10')
    expect(wrapper.classes()).toContain('min-w-10')
  })

  it('renders the native disabled attribute and disabled styling', () => {
    const wrapper = mount(Button, {
      props: { variant: 'primary', disabled: true },
      slots: { default: 'Save' },
    })
    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.classes()).toContain('disabled:opacity-50')
  })

  it('renders icon slot content before the default slot with fixed icon classes', () => {
    const wrapper = mount(Button, {
      props: { variant: 'primary' },
      slots: { icon: '<span class="test-icon" />', default: 'Save' },
    })
    const icon = wrapper.find('.test-icon')
    expect(icon.exists()).toBe(true)
    expect(icon.element.parentElement?.className).toContain('h-4')
    expect(wrapper.html().indexOf('test-icon')).toBeLessThan(
      wrapper.html().indexOf('Save'),
    )
  })

  it('renders no reserved icon wrapper when the icon slot is omitted', () => {
    const wrapper = mount(Button, {
      props: { variant: 'primary' },
      slots: { default: 'Save' },
    })
    expect(wrapper.find('.inline-flex.shrink-0').exists()).toBe(false)
  })
})
