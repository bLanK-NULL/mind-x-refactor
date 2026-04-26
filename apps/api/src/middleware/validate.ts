import type Koa from 'koa'
import type { z } from 'zod'

export function validateBody<TSchema extends z.ZodTypeAny>(schema: TSchema): Koa.Middleware {
  return async (ctx, next) => {
    ctx.request.body = schema.parse(ctx.request.body)
    await next()
  }
}
