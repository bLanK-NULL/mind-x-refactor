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

type AuthenticatedUserRow = {
  id: string
  username: string
}

type AuthTokenPayload = JwtPayload & {
  userId: string
  username: string
}

export const DUMMY_PASSWORD_HASH = '$2a$12$yav5dP29d8qy6UDxPZ.z5OOfjWr1Wrzxio6yVRbDZ33l2JqHpv3DK'

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

  const passwordMatches = await verifyPassword(credentials.password, user?.password_hash ?? DUMMY_PASSWORD_HASH)
  if (user === undefined || !passwordMatches) {
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

export async function authenticateToken(token: string): Promise<UserDto> {
  const tokenUser = verifyAuthToken(token)
  const [rows] = (await pool.execute('SELECT id, username FROM users WHERE id = ? LIMIT 1', [
    tokenUser.id
  ])) as [AuthenticatedUserRow[], unknown]
  const user = rows[0]

  if (user === undefined) {
    throw invalidTokenError()
  }

  return { id: user.id, username: user.username }
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
