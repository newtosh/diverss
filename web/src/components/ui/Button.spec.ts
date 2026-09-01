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

  it('renders sm icon-only with the same vertical padding as sm label buttons, not a fixed floor', () => {
    const wrapper = mount(Button, {
      props: { variant: 'ghost', iconOnly: true, size: 'sm' },
      slots: { default: 'X' },
    })
    expect(wrapper.classes()).toContain('p-1.5')
    expect(wrapper.classes()).not.toContain('px-2.5')
    expect(wrapper.classes()).not.toContain('min-h-8')
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

  it('disables and marks aria-busy while loading, and shows a spinner', () => {
    const wrapper = mount(Button, {
      props: { variant: 'primary', loading: true },
      slots: { default: 'Save' },
    })
    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('hides the label for an icon-only button while loading', () => {
    const wrapper = mount(Button, {
      props: { variant: 'ghost', iconOnly: true, loading: true },
      slots: { default: 'X' },
    })
    expect(wrapper.text()).not.toContain('X')
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('is not disabled or busy when loading is false', () => {
    const wrapper = mount(Button, {
      props: { variant: 'primary' },
      slots: { default: 'Save' },
    })
    expect(wrapper.attributes('disabled')).toBeUndefined()
    expect(wrapper.attributes('aria-busy')).toBeUndefined()
  })
})
