import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable, Writable } from 'node:stream'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createApp } from '../../app.js'
import { seedUsers } from '../../db/seed.js'
import { DUMMY_PASSWORD_HASH } from './auth.service.js'
import { hashPassword } from './password.js'

const mockPool = vi.hoisted(() => ({
  end: vi.fn(),
  execute: vi.fn()
}))

const mockVerifyPassword = vi.hoisted(() => vi.fn())

vi.mock('../../db/pool.js', () => ({
  pool: mockPool
}))

vi.mock('./password.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./password.js')>()

  return {
    ...original,
    verifyPassword: mockVerifyPassword
  }
})

type ResponseSnapshot = {
  body: unknown
  status: number
}

type RequestOptions = {
  body?: unknown
  headers?: Record<string, string>
  method?: string
}

class MockResponse extends Writable {
  statusCode = 404
  statusMessage = ''
  headersSent = false
  writableEnded = false
  private readonly chunks: Buffer[] = []
  private readonly headers = new Map<string, number | string | string[]>()

  constructor(private readonly resolve: (snapshot: ResponseSnapshot) => void) {
    super()
  }

  setHeader(name: string, value: number | string | string[]): this {
    this.headers.set(name.toLowerCase(), value)
    return this
  }

  getHeader(name: string): number | string | string[] | undefined {
    return this.headers.get(name.toLowerCase())
  }

  removeHeader(name: string): void {
    this.headers.delete(name.toLowerCase())
  }

  _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    callback()
  }

  end(chunk?: Buffer | string): this {
    if (chunk !== undefined) {
      this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }

    this.headersSent = true
    this.writableEnded = true
    const rawBody = Buffer.concat(this.chunks).toString('utf8')
    this.resolve({
      body: rawBody.length > 0 ? JSON.parse(rawBody) : undefined,
      status: this.statusCode
    })
    return this
  }
}

async function requestApp(path: string, options: RequestOptions = {}): Promise<ResponseSnapshot> {
  const rawBody = options.body === undefined ? undefined : JSON.stringify(options.body)
  const app = createApp()
  const req = Readable.from(rawBody === undefined ? [] : [rawBody]) as IncomingMessage
  req.method = options.method ?? 'GET'
  req.url = path
  req.headers = {
    host: 'localhost',
    ...(rawBody === undefined
      ? {}
      : {
          'content-length': Buffer.byteLength(rawBody).toString(),
          'content-type': 'application/json'
        }),
    ...options.headers
  }

  return new Promise((resolve, reject) => {
    const res = new MockResponse(resolve) as unknown as ServerResponse
    app.callback()(req, res).catch(reject)
  })
}

describe('auth routes', () => {
  beforeEach(() => {
    mockPool.execute.mockReset()
    mockPool.end.mockReset()
    mockVerifyPassword.mockReset()
  })

  it('logs in with valid credentials and returns a signed token with user data', async () => {
    const passwordHash = await hashPassword('123456')
    mockPool.execute.mockResolvedValueOnce([
      [{ id: '00000000-0000-4000-8000-000000000001', username: 'blank', password_hash: passwordHash }]
    ])
    mockVerifyPassword.mockResolvedValueOnce(true)

    const response = await requestApp('/api/auth/login', {
      body: { password: '123456', username: 'blank' },
      method: 'POST'
    })

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      user: { id: '00000000-0000-4000-8000-000000000001', username: 'blank' }
    })
    expect(response.body).toHaveProperty('token')
    expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('WHERE username = ?'), ['blank'])
    expect(mockVerifyPassword).toHaveBeenCalledWith('123456', passwordHash)
  })

  it('rejects invalid credentials with a normalized unauthorized error', async () => {
    mockPool.execute.mockResolvedValueOnce([[]])
    mockVerifyPassword.mockResolvedValueOnce(false)

    await expect(
      requestApp('/api/auth/login', {
        body: { password: 'wrong', username: 'blank' },
        method: 'POST'
      })
    ).resolves.toEqual({
      body: {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid username or password'
        }
      },
      status: 401
    })
    expect(mockVerifyPassword).toHaveBeenCalledWith('wrong', DUMMY_PASSWORD_HASH)
  })

  it('verifies a password hash before rejecting both unknown users and bad passwords', async () => {
    const passwordHash = await hashPassword('123456')
    mockVerifyPassword.mockResolvedValue(false)

    mockPool.execute.mockResolvedValueOnce([[]])
    await expect(
      requestApp('/api/auth/login', {
        body: { password: 'wrong', username: 'missing' },
        method: 'POST'
      })
    ).resolves.toMatchObject({ status: 401 })

    mockPool.execute.mockResolvedValueOnce([
      [{ id: '00000000-0000-4000-8000-000000000001', username: 'blank', password_hash: passwordHash }]
    ])
    await expect(
      requestApp('/api/auth/login', {
        body: { password: 'wrong', username: 'blank' },
        method: 'POST'
      })
    ).resolves.toMatchObject({ status: 401 })

    expect(mockVerifyPassword).toHaveBeenNthCalledWith(1, 'wrong', DUMMY_PASSWORD_HASH)
    expect(mockVerifyPassword).toHaveBeenNthCalledWith(2, 'wrong', passwordHash)
  })

  it('returns the current user for a valid bearer token', async () => {
    const passwordHash = await hashPassword('123456')
    mockPool.execute.mockResolvedValueOnce([
      [{ id: '00000000-0000-4000-8000-000000000001', username: 'blank', password_hash: passwordHash }]
    ])
    mockVerifyPassword.mockResolvedValueOnce(true)
    const loginResponse = await requestApp('/api/auth/login', {
      body: { password: '123456', username: 'blank' },
      method: 'POST'
    })
    const token = (loginResponse.body as { token: string }).token

    await expect(
      requestApp('/api/auth/me', {
        headers: { authorization: `Bearer ${token}` }
      })
    ).resolves.toEqual({
      body: {
        user: { id: '00000000-0000-4000-8000-000000000001', username: 'blank' }
      },
      status: 200
    })
  })

  it('rejects missing or invalid bearer tokens with unauthorized errors', async () => {
    await expect(requestApp('/api/auth/me')).resolves.toEqual({
      body: {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization token'
        }
      },
      status: 401
    })

    await expect(
      requestApp('/api/auth/me', {
        headers: { authorization: 'Bearer not-a-real-token' }
      })
    ).resolves.toEqual({
      body: {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization token'
        }
      },
      status: 401
    })
  })

  it('returns validation errors for malformed login bodies', async () => {
    await expect(
      requestApp('/api/auth/login', {
        body: { username: '' },
        method: 'POST'
      })
    ).resolves.toMatchObject({
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed'
        }
      },
      status: 422
    })
  })
})

describe('seedUsers', () => {
  beforeEach(() => {
    mockPool.execute.mockReset()
    mockPool.end.mockReset()
  })

  it('upserts the seed accounts with parameterized SQL', async () => {
    mockPool.execute.mockResolvedValue([{}])

    await seedUsers()

    expect(mockPool.execute).toHaveBeenCalledTimes(2)
    expect(mockPool.execute).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('ON DUPLICATE KEY UPDATE'),
      expect.arrayContaining(['00000000-0000-4000-8000-000000000001', 'blank'])
    )
    expect(mockPool.execute).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('ON DUPLICATE KEY UPDATE'),
      expect.arrayContaining(['00000000-0000-4000-8000-000000000002', 'admin'])
    )
    for (const call of mockPool.execute.mock.calls) {
      expect(call[0]).toContain('VALUES (?, ?, ?)')
      expect((call[1] as unknown[])[2]).toMatch(/^\$2[aby]\$/)
    }
  })
})
