import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable, Writable } from 'node:stream'
import { createEmptyDocument } from '@mind-x/mind-engine'
import type { MindDocument } from '@mind-x/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../app.js'
import { signAuthToken } from '../auth/auth.service.js'
import {
  deleteProject,
  findProject,
  insertProject,
  listProjects,
  updateProjectDocument,
  updateProjectName
} from './projects.repository.js'

const mockPool = vi.hoisted(() => ({
  end: vi.fn(),
  execute: vi.fn()
}))

vi.mock('../../db/pool.js', () => ({
  pool: mockPool
}))

type ResponseSnapshot = {
  body: unknown
  status: number
}

type RequestOptions = {
  body?: unknown
  headers?: Record<string, string>
  method?: string
}

type StoredProject = {
  created_at: Date
  document_json: MindDocument | string
  id: string
  name: string
  updated_at: Date
  user_id: string
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

function authHeaders(userId = '00000000-0000-4000-8000-0000000000a1'): Record<string, string> {
  const token = signAuthToken({ id: userId, username: `user-${userId.slice(-2)}` })
  return { authorization: `Bearer ${token}` }
}

function duplicateEntryError(): Error & { code: string; errno: number } {
  return Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY', errno: 1062 })
}

function installProjectStore(): StoredProject[] {
  const projects: StoredProject[] = []

  mockPool.execute.mockImplementation(async (sql: string, params: unknown[] = []) => {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim()

    if (normalizedSql.startsWith('SELECT') && normalizedSql.includes('WHERE user_id = ? ORDER BY updated_at DESC')) {
      const [userId] = params
      return [
        projects
          .filter((project) => project.user_id === userId)
          .sort((left, right) => right.updated_at.getTime() - left.updated_at.getTime())
      ]
    }

    if (normalizedSql.startsWith('SELECT') && normalizedSql.includes('WHERE user_id = ? AND id = ?')) {
      const [userId, projectId] = params
      return [projects.filter((project) => project.user_id === userId && project.id === projectId).slice(0, 1)]
    }

    if (normalizedSql.startsWith('INSERT INTO projects')) {
      const [id, userId, name, documentJson] = params as [string, string, string, string]
      if (projects.some((project) => project.user_id === userId && project.name === name)) {
        throw duplicateEntryError()
      }
      const now = new Date('2026-04-26T12:00:00.000Z')
      projects.push({
        created_at: now,
        document_json: documentJson,
        id,
        name,
        updated_at: now,
        user_id: userId
      })
      return [{ affectedRows: 1 }]
    }

    if (normalizedSql.startsWith('UPDATE projects SET name = ?')) {
      const [name, userId, projectId] = params as [string, string, string]
      const project = projects.find((item) => item.user_id === userId && item.id === projectId)
      if (project === undefined) {
        return [{ affectedRows: 0 }]
      }
      if (projects.some((item) => item.user_id === userId && item.id !== projectId && item.name === name)) {
        throw duplicateEntryError()
      }
      project.name = name
      project.updated_at = new Date('2026-04-26T12:05:00.000Z')
      return [{ affectedRows: 1 }]
    }

    if (normalizedSql.startsWith('UPDATE projects SET document_json = ?')) {
      const [documentJson, userId, projectId] = params as [string, string, string]
      const project = projects.find((item) => item.user_id === userId && item.id === projectId)
      if (project === undefined) {
        return [{ affectedRows: 0 }]
      }
      project.document_json = documentJson
      project.updated_at = new Date('2026-04-26T12:10:00.000Z')
      return [{ affectedRows: 1 }]
    }

    if (normalizedSql.startsWith('DELETE FROM projects WHERE user_id = ? AND id = ?')) {
      const [userId, projectId] = params
      const index = projects.findIndex((project) => project.user_id === userId && project.id === projectId)
      if (index === -1) {
        return [{ affectedRows: 0 }]
      }
      projects.splice(index, 1)
      return [{ affectedRows: 1 }]
    }

    throw new Error(`Unexpected SQL: ${normalizedSql}`)
  })

  return projects
}

describe('project routes', () => {
  beforeEach(() => {
    mockPool.execute.mockReset()
    mockPool.end.mockReset()
  })

  it('rejects unauthenticated project list requests', async () => {
    await expect(requestApp('/api/projects')).resolves.toEqual({
      body: {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization token'
        }
      },
      status: 401
    })
    expect(mockPool.execute).not.toHaveBeenCalled()
  })

  it('creates, lists, saves, loads, renames, and deletes a project for the authenticated user', async () => {
    installProjectStore()
    const headers = authHeaders()

    const createResponse = await requestApp('/api/projects', {
      body: { name: 'Alpha' },
      headers,
      method: 'POST'
    })

    expect(createResponse.status).toBe(201)
    const createdProject = (createResponse.body as { project: { id: string; name: string } }).project
    expect(createdProject).toMatchObject({ name: 'Alpha' })
    expect(createdProject.id).toEqual(expect.any(String))

    await expect(requestApp('/api/projects', { headers })).resolves.toMatchObject({
      body: { projects: [createdProject] },
      status: 200
    })

    const document = createEmptyDocument({
      now: '2026-04-26T12:00:00.000Z',
      projectId: createdProject.id,
      title: 'Alpha'
    })

    await expect(
      requestApp(`/api/projects/${createdProject.id}/document`, {
        body: { document },
        headers,
        method: 'PUT'
      })
    ).resolves.toEqual({
      body: { document },
      status: 200
    })

    await expect(requestApp(`/api/projects/${createdProject.id}/document`, { headers })).resolves.toEqual({
      body: { document },
      status: 200
    })

    await expect(
      requestApp(`/api/projects/${createdProject.id}`, {
        body: { name: 'Beta' },
        headers,
        method: 'PATCH'
      })
    ).resolves.toMatchObject({
      body: { project: { id: createdProject.id, name: 'Beta' } },
      status: 200
    })

    await expect(
      requestApp(`/api/projects/${createdProject.id}`, {
        headers,
        method: 'DELETE'
      })
    ).resolves.toEqual({ body: undefined, status: 204 })

    await expect(requestApp('/api/projects', { headers })).resolves.toEqual({
      body: { projects: [] },
      status: 200
    })
  })

  it('returns not found when an authenticated user updates another user project', async () => {
    installProjectStore()
    const ownerHeaders = authHeaders('00000000-0000-4000-8000-0000000000b2')
    const strangerHeaders = authHeaders('00000000-0000-4000-8000-0000000000a1')
    const createResponse = await requestApp('/api/projects', {
      body: { name: 'Owned' },
      headers: ownerHeaders,
      method: 'POST'
    })
    const projectId = (createResponse.body as { project: { id: string } }).project.id

    await expect(
      requestApp(`/api/projects/${projectId}`, {
        body: { name: 'Stolen' },
        headers: strangerHeaders,
        method: 'PATCH'
      })
    ).resolves.toEqual({
      body: {
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found'
        }
      },
      status: 404
    })
  })

  it('maps duplicate project names to conflict responses', async () => {
    installProjectStore()
    const headers = authHeaders()

    await requestApp('/api/projects', {
      body: { name: 'Alpha' },
      headers,
      method: 'POST'
    })

    await expect(
      requestApp('/api/projects', {
        body: { name: 'Alpha' },
        headers,
        method: 'POST'
      })
    ).resolves.toEqual({
      body: {
        error: {
          code: 'CONFLICT',
          message: 'Project name already exists'
        }
      },
      status: 409
    })
  })

  it('returns validation errors for invalid project names', async () => {
    installProjectStore()

    await expect(
      requestApp('/api/projects', {
        body: { name: '<script>' },
        headers: authHeaders(),
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

  it('rejects saving a document for a different project id', async () => {
    installProjectStore()
    const headers = authHeaders()
    const createResponse = await requestApp('/api/projects', {
      body: { name: 'Alpha' },
      headers,
      method: 'POST'
    })
    const projectId = (createResponse.body as { project: { id: string } }).project.id
    const document = createEmptyDocument({
      now: '2026-04-26T12:00:00.000Z',
      projectId: 'different-project',
      title: 'Alpha'
    })

    await expect(
      requestApp(`/api/projects/${projectId}/document`, {
        body: { document },
        headers,
        method: 'PUT'
      })
    ).resolves.toEqual({
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Document projectId must match route project id'
        }
      },
      status: 422
    })
  })
})

describe('projects repository', () => {
  const document = createEmptyDocument({
    now: '2026-04-26T12:00:00.000Z',
    projectId: 'project-1',
    title: 'Alpha'
  })

  beforeEach(() => {
    mockPool.execute.mockReset()
    mockPool.end.mockReset()
  })

  it('uses user-scoped parameterized SQL for project persistence', async () => {
    mockPool.execute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([
        [
          {
            created_at: new Date('2026-04-26T12:00:00.000Z'),
            document_json: JSON.stringify(document),
            id: 'project-1',
            name: 'Alpha',
            updated_at: new Date('2026-04-26T12:05:00.000Z'),
            user_id: 'user-1'
          }
        ]
      ])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])

    await listProjects('user-1')
    const found = await findProject('user-1', 'project-1')
    await insertProject({ document, id: 'project-1', name: 'Alpha', userId: 'user-1' })
    await updateProjectName({ name: 'Beta', projectId: 'project-1', userId: 'user-1' })
    await updateProjectDocument({ document, projectId: 'project-1', userId: 'user-1' })
    await deleteProject('user-1', 'project-1')

    expect(found?.document).toEqual(document)
    expect(mockPool.execute).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/WHERE user_id = \? ORDER BY updated_at DESC/),
      ['user-1']
    )
    expect(mockPool.execute).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/WHERE user_id = \? AND id = \? LIMIT 1/),
      ['user-1', 'project-1']
    )
    expect(mockPool.execute).toHaveBeenNthCalledWith(
      3,
      expect.stringMatching(/INSERT INTO projects .* VALUES \(\?, \?, \?, \?\)/s),
      ['project-1', 'user-1', 'Alpha', JSON.stringify(document)]
    )
    expect(mockPool.execute).toHaveBeenNthCalledWith(
      4,
      expect.stringMatching(/UPDATE projects SET name = \? WHERE user_id = \? AND id = \?/),
      ['Beta', 'user-1', 'project-1']
    )
    expect(mockPool.execute).toHaveBeenNthCalledWith(
      5,
      expect.stringMatching(/UPDATE projects SET document_json = \? WHERE user_id = \? AND id = \?/),
      [JSON.stringify(document), 'user-1', 'project-1']
    )
    expect(mockPool.execute).toHaveBeenNthCalledWith(
      6,
      expect.stringMatching(/DELETE FROM projects WHERE user_id = \? AND id = \?/),
      ['user-1', 'project-1']
    )
  })

  it('accepts JSON columns returned as parsed objects or strings', async () => {
    mockPool.execute
      .mockResolvedValueOnce([
        [
          {
            created_at: new Date('2026-04-26T12:00:00.000Z'),
            document_json: document,
            id: 'project-1',
            name: 'Alpha',
            updated_at: new Date('2026-04-26T12:05:00.000Z'),
            user_id: 'user-1'
          }
        ]
      ])
      .mockResolvedValueOnce([
        [
          {
            created_at: new Date('2026-04-26T12:00:00.000Z'),
            document_json: JSON.stringify(document),
            id: 'project-1',
            name: 'Alpha',
            updated_at: new Date('2026-04-26T12:05:00.000Z'),
            user_id: 'user-1'
          }
        ]
      ])

    await expect(findProject('user-1', 'project-1')).resolves.toMatchObject({ document })
    await expect(findProject('user-1', 'project-1')).resolves.toMatchObject({ document })
  })
})
