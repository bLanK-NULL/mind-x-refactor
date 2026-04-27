import type Koa from 'koa'
import { authenticateToken } from '../modules/auth/auth.service.js'
import { HttpError } from '../shared/http-error.js'

function unauthorized(): HttpError {
  return new HttpError(401, 'UNAUTHORIZED', 'Missing or invalid authorization token')
}

export async function requireAuth(ctx: Koa.Context, next: Koa.Next): Promise<void> {
  const authorization = ctx.get('Authorization')
  const match = /^Bearer\s+(.+)$/.exec(authorization)

  if (match === null) {
    throw unauthorized()
  }

  ctx.state.user = await authenticateToken(match[1])
  await next()
}
