import Router from '@koa/router'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import { HttpError } from './shared/http-error.js'
import { errorHandler } from './middleware/error-handler.js'
import { requestLogger } from './middleware/request-logger.js'

export function createApp(): Koa {
  const app = new Koa()
  const router = new Router({ prefix: '/api' })

  router.get('/health', (ctx) => {
    ctx.body = { status: 'ok' }
  })

  app.use(errorHandler)
  app.use(requestLogger)
  app.use(bodyParser())
  app.use(router.routes())
  app.use(router.allowedMethods())
  app.use(() => {
    throw new HttpError(404, 'NOT_FOUND', 'Route not found')
  })

  app.on('error', (error) => {
    console.error(error)
  })

  return app
}
