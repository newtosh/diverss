import { createRouter, createWebHashHistory } from 'vue-router'
import WorkspaceView from '@/views/WorkspaceView.vue'
import CatalogView from '@/views/CatalogView.vue'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'workspace', component: WorkspaceView },
    { path: '/catalog', name: 'catalog', component: CatalogView },
  ],
})

export default router
