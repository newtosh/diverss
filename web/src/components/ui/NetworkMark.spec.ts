import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import NetworkMark from './NetworkMark.vue'

describe('NetworkMark', () => {
  it('renders the static mark by default with no loading animation class', () => {
    const wrapper = mount(NetworkMark)
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.classes()).not.toContain('motion-safe:animate-gr-bloom')
  })

  it('applies the bloom animation class when state="loading"', () => {
    const wrapper = mount(NetworkMark, { props: { state: 'loading' } })
    expect(wrapper.classes()).toContain('motion-safe:animate-gr-bloom')
  })

  it('renders distinct dimensions for sm vs lg', () => {
    const sm = mount(NetworkMark, { props: { size: 'sm' } })
    expect(sm.classes()).toContain('h-5')

    const lg = mount(NetworkMark, { props: { size: 'lg' } })
    expect(lg.classes()).toContain('h-16')
  })
})
