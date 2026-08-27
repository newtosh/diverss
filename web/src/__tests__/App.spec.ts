import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import App from '../App.vue'
import WorkspaceView from '../views/WorkspaceView.vue'
import CatalogView from '../views/CatalogView.vue'

describe('App', () => {
  it('renders GardenRSS brand and Garden nav', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: WorkspaceView },
        { path: '/catalog', component: CatalogView },
      ],
    })
    await router.push('/')
    await router.isReady()

    const wrapper = mount(App, {
      global: { plugins: [router] },
    })

    expect(wrapper.text()).toContain('GardenRSS')
    expect(wrapper.text()).toContain('Garden')
    expect(wrapper.text()).toContain('Catalog')
    expect(wrapper.text()).toContain('Deck')
    expect(wrapper.text()).toContain('RSS feed manager')
  })
})
