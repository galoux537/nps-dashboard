import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue')
  },
  {
    path: '/reports',
    name: 'Reports',
    component: () => import('../views/Reports.vue')
  },
  {
    path: '/engagement',
    name: 'Engagement',
    component: () => import('../views/Engagement.vue')
  },
  {
    path: '/empresas',
    name: 'Empresas',
    component: () => import('../views/Empresas.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router 