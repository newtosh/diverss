import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import App from '../App.vue'
import WorkspaceView from '../views/WorkspaceView.vue'
import CatalogView from '../views/CatalogView.vue'

describe('App', () => {
  it('renders DiveRSS brand and scuba-mask affordance', async () => {
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

    expect(wrapper.text()).toContain('DiveRSS')
    expect(wrapper.text()).toContain('Workspace')
    expect(wrapper.text()).toContain('Catalog')
  })
})
