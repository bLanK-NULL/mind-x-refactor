import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/features/auth/stores/auth'
import EditorView from '@/features/editor/views/EditorView.vue'
import LoginView from '@/features/auth/views/LoginView.vue'
import ProjectsView from '@/features/projects/views/ProjectsView.vue'
import { sanitizeRedirect } from './redirect'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: LoginView
  },
  {
    path: '/',
    redirect: '/projects'
  },
  {
    path: '/projects',
    name: 'projects',
    component: ProjectsView,
    meta: { requiresAuth: true }
  },
  {
    path: '/projects/:id',
    name: 'editor',
    component: EditorView,
    meta: { requiresAuth: true }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/projects'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (auth.isAuthenticated && auth.user === null) {
    await auth.hydrate()
  }

  if (to.meta.requiresAuth === true && !auth.isAuthenticated) {
    return {
      path: '/login',
      query: {
        redirect: to.fullPath
      }
    }
  }

  if (to.name === 'login' && auth.isAuthenticated) {
    return sanitizeRedirect(to.query.redirect)
  }

  return true
})

export default router
