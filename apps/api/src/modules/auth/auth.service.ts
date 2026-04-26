import jwt, { type JwtPayload } from 'jsonwebtoken'
import type { LoginRequest, LoginResponse, UserDto } from '@mind-x/shared'
import { env } from '../../config/env.js'
import { pool } from '../../db/pool.js'
import { HttpError } from '../../shared/http-error.js'
import { verifyPassword } from './password.js'

type UserRow = {
  id: string
  password_hash: string
  username: string
}

type AuthTokenPayload = JwtPayload & {
  userId: string
  username: string
}

function invalidCredentialsError(): HttpError {
  return new HttpError(401, 'UNAUTHORIZED', 'Invalid username or password')
}

function invalidTokenError(): HttpError {
  return new HttpError(401, 'UNAUTHORIZED', 'Missing or invalid authorization token')
}

export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  const [rows] = (await pool.execute(
    'SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1',
    [credentials.username]
  )) as [UserRow[], unknown]
  const user = rows[0]

  if (user === undefined) {
    throw invalidCredentialsError()
  }

  const passwordMatches = await verifyPassword(credentials.password, user.password_hash)
  if (!passwordMatches) {
    throw invalidCredentialsError()
  }

  return {
    token: signAuthToken({ id: user.id, username: user.username }),
    user: { id: user.id, username: user.username }
  }
}

export function signAuthToken(user: UserDto): string {
  return jwt.sign({ userId: user.id, username: user.username }, env.JWT_SECRET, { expiresIn: '7d' })
}

export function verifyAuthToken(token: string): UserDto {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET)
    if (!isAuthTokenPayload(decoded)) {
      throw invalidTokenError()
    }

    return { id: decoded.userId, username: decoded.username }
  } catch {
    throw invalidTokenError()
  }
}

function isAuthTokenPayload(decoded: string | JwtPayload): decoded is AuthTokenPayload {
  return (
    typeof decoded === 'object' &&
    decoded !== null &&
    typeof decoded.userId === 'string' &&
    typeof decoded.username === 'string'
  )
}
