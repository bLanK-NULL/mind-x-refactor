import Router from '@koa/router'
import { createAuthRouter } from './modules/auth/auth.routes.js'
import { createProjectsRouter } from './modules/projects/projects.routes.js'

export function createApiRouter(): Router {
  const router = new Router({ prefix: '/api' })

  router.get('/health', (ctx) => {
    ctx.body = { status: 'ok' }
  })

  router.use(createAuthRouter().routes())
  router.use(createProjectsRouter().routes())

  return router
}
