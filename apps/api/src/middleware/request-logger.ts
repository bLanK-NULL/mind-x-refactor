import type Koa from 'koa'

export async function requestLogger(ctx: Koa.Context, next: Koa.Next): Promise<void> {
  const start = Date.now()
  try {
    await next()
  } finally {
    const ms = Date.now() - start
    console.log(`${ctx.method} ${ctx.url} ${ctx.status} - ${ms}ms`)
  }
}
