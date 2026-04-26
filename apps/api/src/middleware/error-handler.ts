import type Koa from 'koa'
import { ZodError } from 'zod'
import { HttpError } from '../shared/http-error.js'

export async function errorHandler(ctx: Koa.Context, next: Koa.Next): Promise<void> {
  try {
    await next()
  } catch (error) {
    if (error instanceof HttpError) {
      ctx.status = error.status
      ctx.body = { error: { code: error.code, message: error.message, details: error.details } }
      return
    }

    if (error instanceof ZodError) {
      ctx.status = 422
      ctx.body = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.flatten()
        }
      }
      return
    }

    ctx.status = 500
    ctx.body = { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }
    ctx.app.emit('error', error, ctx)
  }
}
