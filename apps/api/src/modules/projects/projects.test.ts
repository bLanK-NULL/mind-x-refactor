import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable, Writable } from 'node:stream'
import { createEmptyDocument } from '@mind-x/mind-engine'
import {
  DEFAULT_EDGE_STYLE,
  DEFAULT_NODE_SHELL_STYLE,
  DEFAULT_NODE_SIZE_BY_TYPE,
  DEFAULT_TOPIC_CONTENT_STYLE,
  type MindDocument,
  type MindDocumentV1
} from '@mind-x/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../app.js'
import { signAuthToken } from '../auth/auth.service.js'
import {
  deleteProject,
  findProject,
  findProjectSummary,
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

const authenticatedUsers = new Map<string, string>()

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
  const username = `user-${userId.slice(-2)}`
  authenticatedUsers.set(userId, username)
  const token = signAuthToken({ id: userId, username })
  return { authorization: `Bearer ${token}` }
}

function duplicateEntryError(): Error & { code: string; errno: number } {
  return Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY', errno: 1062 })
}

function legacyDocument(projectId: string): MindDocumentV1 {
  return {
    version: 1,
    meta: {
      projectId,
      title: 'Legacy',
      theme: 'vivid',
      updatedAt: '2026-04-26T12:00:00.000Z'
    },
    viewport: { x: 4, y: 8, zoom: 1 },
    nodes: [
      { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } },
      { id: 'child', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'Child' } }
    ],
    edges: [{ id: 'root->child', source: 'root', target: 'child', type: 'mind-parent', component: 'dashed-arrow' }]
  }
}

function withDanglingEdge(document: MindDocument): MindDocument {
  return {
    ...document,
    nodes: [
      {
        data: { title: 'Root' },
        id: 'root',
        position: { x: 0, y: 0 },
        size: DEFAULT_NODE_SIZE_BY_TYPE.topic,
        shellStyle: DEFAULT_NODE_SHELL_STYLE,
        contentStyle: DEFAULT_TOPIC_CONTENT_STYLE,
        type: 'topic'
      }
    ],
    edges: [
      {
        id: 'root->missing',
        source: 'root',
        target: 'missing-node',
        type: 'mind-parent',
        style: DEFAULT_EDGE_STYLE
      }
    ]
  }
}

function installProjectStore(): StoredProject[] {
  const projects: StoredProject[] = []

  mockPool.execute.mockImplementation(async (sql: string, params: unknown[] = []) => {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim()

    if (normalizedSql === 'SELECT id, username FROM users WHERE id = ? LIMIT 1') {
      const [userId] = params as [string]
      const username = authenticatedUsers.get(userId)
      return [username === undefined ? [] : [{ id: userId, username }]]
    }

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
      if (project.name === name) {
        return [{ affectedRows: 0 }]
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
      if (project.document_json === documentJson) {
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
    authenticatedUsers.clear()
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

  it('treats same-name project renames as successful no-op updates', async () => {
    installProjectStore()
    const headers = authHeaders()
    const createResponse = await requestApp('/api/projects', {
      body: { name: 'Alpha' },
      headers,
      method: 'POST'
    })
    const projectId = (createResponse.body as { project: { id: string } }).project.id

    await expect(
      requestApp(`/api/projects/${projectId}`, {
        body: { name: 'Alpha' },
        headers,
        method: 'PATCH'
      })
    ).resolves.toMatchObject({
      body: { project: { id: projectId, name: 'Alpha' } },
      status: 200
    })
  })

  it('renames projects without parsing stored documents', async () => {
    const projects = installProjectStore()
    const headers = authHeaders()
    const createResponse = await requestApp('/api/projects', {
      body: { name: 'Alpha' },
      headers,
      method: 'POST'
    })
    const projectId = (createResponse.body as { project: { id: string } }).project.id
    const project = projects.find((item) => item.id === projectId)
    expect(project).toBeDefined()
    project!.document_json = '{'

    await expect(
      requestApp(`/api/projects/${projectId}`, {
        body: { name: 'Beta' },
        headers,
        method: 'PATCH'
      })
    ).resolves.toMatchObject({
      body: { project: { id: projectId, name: 'Beta' } },
      status: 200
    })
  })

  it('treats unchanged document saves as successful no-op updates', async () => {
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
      projectId,
      title: 'Alpha'
    })

    await requestApp(`/api/projects/${projectId}/document`, {
      body: { document },
      headers,
      method: 'PUT'
    })

    await expect(
      requestApp(`/api/projects/${projectId}/document`, {
        body: { document },
        headers,
        method: 'PUT'
      })
    ).resolves.toEqual({
      body: { document },
      status: 200
    })
  })

  it('rejects legacy v1 document saves', async () => {
    installProjectStore()
    const headers = authHeaders()
    const createResponse = await requestApp('/api/projects', {
      body: { name: 'Legacy' },
      headers,
      method: 'POST'
    })
    const projectId = (createResponse.body as { project: { id: string } }).project.id
    const legacy = legacyDocument(projectId)

    await expect(
      requestApp(`/api/projects/${projectId}/document`, {
        body: { document: legacy },
        headers,
        method: 'PUT'
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

    const loadResponse = await requestApp(`/api/projects/${projectId}/document`, { headers })
    expect(loadResponse.status).toBe(200)
    const loaded = (loadResponse.body as { document: MindDocument }).document
    expect(loaded.version).toBe(3)
    expect(loaded.meta.projectId).toBe(projectId)
    expect(loaded.meta.title).toBe('Legacy')
    expect(loaded.nodes).toEqual([])
    expect(loaded.edges).toEqual([])
  })

  it('returns JSON not found responses for unknown nested project routes', async () => {
    installProjectStore()

    await expect(requestApp('/api/projects/project-1/nope', { headers: authHeaders() })).resolves.toEqual({
      body: {
        error: {
          code: 'NOT_FOUND',
          message: 'Route not found'
        }
      },
      status: 404
    })
  })

  it('keeps JSON method mismatch responses for project routes', async () => {
    installProjectStore()

    await expect(
      requestApp('/api/projects/project-1/document', {
        headers: authHeaders(),
        method: 'PATCH'
      })
    ).resolves.toEqual({
      body: {
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: 'Method not allowed'
        }
      },
      status: 405
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

  it('rejects saving malformed graph documents without persisting them', async () => {
    installProjectStore()
    const headers = authHeaders()
    const createResponse = await requestApp('/api/projects', {
      body: { name: 'Alpha' },
      headers,
      method: 'POST'
    })
    const projectId = (createResponse.body as { project: { id: string } }).project.id
    const loadBeforeResponse = await requestApp(`/api/projects/${projectId}/document`, { headers })
    const originalDocument = (loadBeforeResponse.body as { document: MindDocument }).document
    const invalidDocument = withDanglingEdge(originalDocument)

    await expect(
      requestApp(`/api/projects/${projectId}/document`, {
        body: { document: invalidDocument },
        headers,
        method: 'PUT'
      })
    ).resolves.toEqual({
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Document graph is invalid'
        }
      },
      status: 422
    })

    await expect(requestApp(`/api/projects/${projectId}/document`, { headers })).resolves.toEqual({
      body: { document: originalDocument },
      status: 200
    })
  })

  it('returns not found when saving malformed graph documents for unknown projects', async () => {
    installProjectStore()
    const projectId = 'missing-project'
    const document = withDanglingEdge(
      createEmptyDocument({
        now: '2026-04-26T12:00:00.000Z',
        projectId,
        title: 'Alpha'
      })
    )

    await expect(
      requestApp(`/api/projects/${projectId}/document`, {
        body: { document },
        headers: authHeaders(),
        method: 'PUT'
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

  it('returns a clean error when stored project documents are invalid', async () => {
    const projects = installProjectStore()
    const headers = authHeaders()
    const createResponse = await requestApp('/api/projects', {
      body: { name: 'Alpha' },
      headers,
      method: 'POST'
    })
    const projectId = (createResponse.body as { project: { id: string } }).project.id
    const project = projects.find((item) => item.id === projectId)
    expect(project).toBeDefined()
    project!.document_json = '{'

    await expect(requestApp(`/api/projects/${projectId}/document`, { headers })).resolves.toEqual({
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Stored project document is invalid'
        }
      },
      status: 500
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
      .mockResolvedValueOnce([
        [
          {
            created_at: new Date('2026-04-26T12:00:00.000Z'),
            id: 'project-1',
            name: 'Alpha',
            updated_at: new Date('2026-04-26T12:05:00.000Z')
          }
        ]
      ])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])

    await listProjects('user-1')
    const found = await findProject('user-1', 'project-1')
    const foundSummary = await findProjectSummary('user-1', 'project-1')
    await insertProject({ document, id: 'project-1', name: 'Alpha', userId: 'user-1' })
    await updateProjectName({ name: 'Beta', projectId: 'project-1', userId: 'user-1' })
    await updateProjectDocument({ document, projectId: 'project-1', userId: 'user-1' })
    await deleteProject('user-1', 'project-1')

    expect(found?.document).toEqual(document)
    expect(foundSummary).toMatchObject({ id: 'project-1', name: 'Alpha' })
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
      expect.stringMatching(/SELECT id, name, created_at, updated_at FROM projects WHERE user_id = \? AND id = \? LIMIT 1/),
      ['user-1', 'project-1']
    )
    expect(mockPool.execute).toHaveBeenNthCalledWith(
      4,
      expect.stringMatching(/INSERT INTO projects .* VALUES \(\?, \?, \?, \?\)/s),
      ['project-1', 'user-1', 'Alpha', JSON.stringify(document)]
    )
    expect(mockPool.execute).toHaveBeenNthCalledWith(
      5,
      expect.stringMatching(/UPDATE projects SET name = \? WHERE user_id = \? AND id = \?/),
      ['Beta', 'user-1', 'project-1']
    )
    expect(mockPool.execute).toHaveBeenNthCalledWith(
      6,
      expect.stringMatching(/UPDATE projects SET document_json = \? WHERE user_id = \? AND id = \?/),
      [JSON.stringify(document), 'user-1', 'project-1']
    )
    expect(mockPool.execute).toHaveBeenNthCalledWith(
      7,
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

  it('migrates v1 JSON columns to v3 records', async () => {
    const legacy = legacyDocument('project-1')
    mockPool.execute.mockResolvedValueOnce([
      [
        {
          created_at: new Date('2026-04-26T12:00:00.000Z'),
          document_json: JSON.stringify(legacy),
          id: 'project-1',
          name: 'Legacy',
          updated_at: new Date('2026-04-26T12:05:00.000Z'),
          user_id: 'user-1'
        }
      ]
    ])

    await expect(findProject('user-1', 'project-1')).resolves.toMatchObject({
      document: {
        version: 3,
        nodes: [
          expect.objectContaining({
            size: DEFAULT_NODE_SIZE_BY_TYPE.topic,
            shellStyle: DEFAULT_NODE_SHELL_STYLE,
            contentStyle: DEFAULT_TOPIC_CONTENT_STYLE
          }),
          expect.objectContaining({
            size: DEFAULT_NODE_SIZE_BY_TYPE.topic,
            shellStyle: DEFAULT_NODE_SHELL_STYLE,
            contentStyle: DEFAULT_TOPIC_CONTENT_STYLE
          })
        ],
        edges: [expect.objectContaining({ style: DEFAULT_EDGE_STYLE })]
      }
    })
  })

  it('rejects invalid stored documents with a storage-specific error', async () => {
    mockPool.execute.mockResolvedValueOnce([
      [
        {
          created_at: new Date('2026-04-26T12:00:00.000Z'),
          document_json: '{',
          id: 'project-1',
          name: 'Alpha',
          updated_at: new Date('2026-04-26T12:05:00.000Z'),
          user_id: 'user-1'
        }
      ]
    ])

    await expect(findProject('user-1', 'project-1')).rejects.toThrow('Stored project document is invalid')
  })
})
