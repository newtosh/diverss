import { createRouter, createWebHashHistory } from 'vue-router'
import WorkspaceView from '@/views/WorkspaceView.vue'
import CatalogView from '@/views/CatalogView.vue'
import OutboxView from '@/views/OutboxView.vue'
import ToolsView from '@/views/ToolsView.vue'

const scrollByPath = new Map<string, number>()

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'workspace', component: WorkspaceView },
    { path: '/catalog', name: 'catalog', component: CatalogView },
    { path: '/outbox', name: 'outbox', component: OutboxView },
    { path: '/tools', name: 'tools', component: ToolsView },
  ],
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    const y = scrollByPath.get(to.fullPath)
    if (typeof y === 'number') return { left: 0, top: y }
    return { left: 0, top: 0 }
  },
})

router.beforeEach((_to, from) => {
  if (from.matched.length) {
    scrollByPath.set(from.fullPath, window.scrollY)
  }
})

export default router
