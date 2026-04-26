import Router from '@koa/router'
import { loginRequestSchema, type LoginRequest } from '@mind-x/shared'
import { requireAuth } from '../../middleware/auth.js'
import { validateBody } from '../../middleware/validate.js'
import { login } from './auth.service.js'

export function createAuthRouter(): Router {
  const router = new Router({ prefix: '/auth' })

  router.post('/login', validateBody(loginRequestSchema), async (ctx) => {
    ctx.body = await login(ctx.request.body as LoginRequest)
  })

  router.get('/me', requireAuth, (ctx) => {
    ctx.body = { user: ctx.state.user }
  })

  return router
}
