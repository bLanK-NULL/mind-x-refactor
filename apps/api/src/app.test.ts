import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable, Writable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { createApp } from './app.js'

type ResponseSnapshot = {
  body: unknown
  status: number
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

async function requestApp(path: string): Promise<ResponseSnapshot> {
  const app = createApp()
  const req = Readable.from([]) as IncomingMessage
  req.method = 'GET'
  req.url = path
  req.headers = { host: 'localhost' }

  return new Promise((resolve, reject) => {
    const res = new MockResponse(resolve) as unknown as ServerResponse
    app.callback()(req, res).catch(reject)
  })
}

describe('createApp', () => {
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
})
