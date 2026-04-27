import Router from '@koa/router'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import { HttpError } from './shared/http-error.js'
import { errorHandler } from './middleware/error-handler.js'
import { requestLogger } from './middleware/request-logger.js'
import { createApiRouter } from './routes.js'

type CreateAppOptions = {
  configureRouter?: (router: Router) => void
}

export function createApp(options: CreateAppOptions = {}): Koa {
  const app = new Koa()
  const router = createApiRouter()

  options.configureRouter?.(router)

  app.use(requestLogger)
  app.use(errorHandler)
  app.use(bodyParser())
  app.use(router.routes())
  app.use(async (ctx, next) => {
    await next()

    if (ctx.status !== 404 || ctx.body !== undefined) {
      return
    }

    throw new HttpError(404, 'NOT_FOUND', 'Route not found')
  })
  app.use(
    router.allowedMethods({
      throw: true,
      methodNotAllowed: () => new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed')
    })
  )

  app.on('error', (error) => {
    console.error(error)
  })

  return app
}
