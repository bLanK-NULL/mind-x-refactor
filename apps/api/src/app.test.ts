import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable, Writable } from 'node:stream'
import type Router from '@koa/router'
import { z } from 'zod'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from './app.js'
import { HttpError } from './shared/http-error.js'

type ResponseSnapshot = {
  body: unknown
  status: number
}

type RequestOptions = {
  configureRouter?: (router: Router) => void
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
  const app = createApp({ configureRouter: options.configureRouter })
  const req = Readable.from([]) as IncomingMessage
  req.method = options.method ?? 'GET'
  req.url = path
  req.headers = { host: 'localhost' }

  return new Promise((resolve, reject) => {
    const res = new MockResponse(resolve) as unknown as ServerResponse
    app.callback()(req, res).catch(reject)
  })
}

describe('createApp', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('serves the API health route', async () => {
    await expect(requestApp('/api/health')).resolves.toEqual({
      body: { status: 'ok' },
      status: 200
    })
  })

  it('returns JSON for missing routes', async () => {
    await expect(requestApp('/missing')).resolves.toEqual({
      body: {
        error: {
          code: 'NOT_FOUND',
          message: 'Route not found'
        }
      },
      status: 404
    })
  })

  it('returns JSON for method mismatches', async () => {
    await expect(requestApp('/api/health', { method: 'POST' })).resolves.toEqual({
      body: {
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: 'Method not allowed'
        }
      },
      status: 405
    })
  })

  it('returns JSON for HttpError routes', async () => {
    await expect(
      requestApp('/api/conflict', {
        configureRouter: (router) => {
          router.get('/conflict', () => {
            throw new HttpError(409, 'CONFLICT', 'Name already exists', { field: 'name' })
          })
        }
      })
    ).resolves.toEqual({
      body: {
        error: {
          code: 'CONFLICT',
          details: { field: 'name' },
          message: 'Name already exists'
        }
      },
      status: 409
    })
  })

  it('logs the final response status for HttpError routes', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await requestApp('/api/conflict', {
      configureRouter: (router) => {
        router.get('/conflict', () => {
          throw new HttpError(409, 'CONFLICT', 'Name already exists')
        })
      }
    })

    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/^GET \/api\/conflict 409 - \d+ms$/))
  })

  it('returns JSON for ZodError routes', async () => {
    await expect(
      requestApp('/api/invalid', {
        configureRouter: (router) => {
          router.get('/invalid', () => {
            z.object({ name: z.string().min(1) }).parse({ name: '' })
          })
        }
      })
    ).resolves.toMatchObject({
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          details: {
            fieldErrors: {
              name: ['String must contain at least 1 character(s)']
            },
            formErrors: []
          },
          message: 'Request validation failed'
        }
      },
      status: 422
    })
  })

  it('returns JSON for unknown errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(
      requestApp('/api/crash', {
        configureRouter: (router) => {
          router.get('/crash', () => {
            throw new Error('boom')
          })
        }
      })
    ).resolves.toEqual({
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error'
        }
      },
      status: 500
    })
  })
})
