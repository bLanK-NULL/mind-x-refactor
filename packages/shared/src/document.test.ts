import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ATTACHMENT_CONTENT_STYLE,
  DEFAULT_CODE_CONTENT_STYLE,
  DEFAULT_EDGE_STYLE,
  DEFAULT_IMAGE_CONTENT_STYLE,
  DEFAULT_LINK_CONTENT_STYLE,
  DEFAULT_NODE_SHELL_STYLE,
  DEFAULT_NODE_SIZE_BY_TYPE,
  DEFAULT_TASK_CONTENT_STYLE,
  DEFAULT_TOPIC_CONTENT_STYLE,
  DEFAULT_TOPIC_STYLE,
  apiErrorBodySchema,
  createProjectRequestSchema,
  migrateMindDocument,
  migrateMindDocumentToV3,
  mindDocumentSchema,
  mindDocumentV1Schema,
  mindDocumentV2Schema,
  mindDocumentV3Schema,
  renameProjectRequestSchema,
  saveDocumentRequestSchema
} from './index.js'

function v2Document(overrides: Record<string, unknown> = {}) {
  return {
    version: 2,
    meta: {
      projectId: 'project-1',
      title: 'Planning',
      updatedAt: '2026-04-26T00:00:00.000Z'
    },
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [
      {
        id: 'root',
        type: 'topic',
        position: { x: 0, y: 0 },
        data: { title: 'Root' },
        style: DEFAULT_TOPIC_STYLE
      }
    ],
    edges: [],
    ...overrides
  }
}

function v3Document(overrides: Record<string, unknown> = {}) {
  return {
    version: 3,
    meta: {
      projectId: 'project-1',
      title: 'Planning',
      updatedAt: '2026-04-26T00:00:00.000Z'
    },
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [
      {
        id: 'root',
        type: 'topic',
        position: { x: 0, y: 0 },
        size: DEFAULT_NODE_SIZE_BY_TYPE.topic,
        shellStyle: DEFAULT_NODE_SHELL_STYLE,
        data: { title: 'Root' },
        contentStyle: DEFAULT_TOPIC_CONTENT_STYLE
      }
    ],
    edges: [],
    ...overrides
  }
}

function v1Document(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    meta: {
      projectId: 'project-1',
      title: 'Planning',
      theme: 'vivid',
      updatedAt: '2026-04-26T00:00:00.000Z'
    },
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [
      {
        id: 'root',
        type: 'topic',
        position: { x: 0, y: 0 },
        data: { title: 'Root' }
      },
      {
        id: 'child',
        type: 'topic',
        position: { x: 240, y: 0 },
        size: { width: 180, height: 72 },
        data: { title: 'Child' }
      }
    ],
    edges: [
      {
        id: 'root->child',
        source: 'root',
        target: 'child',
        type: 'mind-parent',
        component: 'dashed-arrow',
        data: { direction: 'source-target' }
      },
      {
        id: 'child->root',
        source: 'child',
        target: 'root',
        type: 'mind-parent',
        component: 'plain',
        data: { direction: 'source-target' }
      }
    ],
    ...overrides
  }
}

describe('mind document versions', () => {
  it('accepts a v2 document with explicit object styles and no document theme', () => {
    const parsed = mindDocumentSchema.parse(v2Document())

    expect(parsed.version).toBe(2)
    expect(parsed.meta).toEqual({
      projectId: 'project-1',
      title: 'Planning',
      updatedAt: '2026-04-26T00:00:00.000Z'
    })
    expect(parsed.nodes[0].style).toEqual(DEFAULT_TOPIC_STYLE)
  })

  it('keeps the v1 schema available for migration inputs', () => {
    const parsed = mindDocumentV1Schema.parse(v1Document())

    expect(parsed.version).toBe(1)
    expect(parsed.meta.theme).toBe('vivid')
    expect(parsed.nodes[1].size).toEqual({ width: 180, height: 72 })
    expect(parsed.edges[0].component).toBe('dashed-arrow')
  })

  it('migrates v1 documents to v2 defaults and discards theme and edge component data', () => {
    const migrated = migrateMindDocument(v1Document())

    expect(migrated).toEqual({
      version: 2,
      meta: {
        projectId: 'project-1',
        title: 'Planning',
        updatedAt: '2026-04-26T00:00:00.000Z'
      },
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [
        {
          id: 'root',
          type: 'topic',
          position: { x: 0, y: 0 },
          data: { title: 'Root' },
          style: DEFAULT_TOPIC_STYLE
        },
        {
          id: 'child',
          type: 'topic',
          position: { x: 240, y: 0 },
          size: { width: 180, height: 72 },
          data: { title: 'Child' },
          style: DEFAULT_TOPIC_STYLE
        }
      ],
      edges: [
        {
          id: 'root->child',
          source: 'root',
          target: 'child',
          type: 'mind-parent',
          style: DEFAULT_EDGE_STYLE
        },
        {
          id: 'child->root',
          source: 'child',
          target: 'root',
          type: 'mind-parent',
          style: DEFAULT_EDGE_STYLE
        }
      ]
    })
    expect(migrated.nodes[1].size).toEqual({ width: 180, height: 72 })
  })

  it('migrates default styles as fresh objects for each node and edge', () => {
    const migrated = migrateMindDocument(v1Document())

    expect(migrated.nodes).toHaveLength(2)
    expect(migrated.edges).toHaveLength(2)
    expect(migrated.nodes[0].style).not.toBe(migrated.nodes[1].style)
    expect(migrated.nodes[0].style).not.toBe(DEFAULT_TOPIC_STYLE)
    expect(migrated.nodes[1].style).not.toBe(DEFAULT_TOPIC_STYLE)
    expect(migrated.edges[0].style).not.toBe(migrated.edges[1].style)
    expect(migrated.edges[0].style).not.toBe(DEFAULT_EDGE_STYLE)
    expect(migrated.edges[1].style).not.toBe(DEFAULT_EDGE_STYLE)
    expect(migrated.edges[0].style.animation).not.toBe(migrated.edges[1].style.animation)
    expect(migrated.edges[0].style.animation).not.toBe(DEFAULT_EDGE_STYLE.animation)
    expect(migrated.edges[1].style.animation).not.toBe(DEFAULT_EDGE_STYLE.animation)
    expect(migrated.edges[0].style.endpointStyle).not.toBe(migrated.edges[1].style.endpointStyle)
    expect(migrated.edges[0].style.endpointStyle).not.toBe(DEFAULT_EDGE_STYLE.endpointStyle)
    expect(migrated.edges[1].style.endpointStyle).not.toBe(DEFAULT_EDGE_STYLE.endpointStyle)
    expect(migrated.edges[0].style.labelStyle).not.toBe(migrated.edges[1].style.labelStyle)
    expect(migrated.edges[0].style.labelStyle).not.toBe(DEFAULT_EDGE_STYLE.labelStyle)
    expect(migrated.edges[1].style.labelStyle).not.toBe(DEFAULT_EDGE_STYLE.labelStyle)
  })

  it('returns parsed v2 documents unchanged through migration', () => {
    const document = v2Document({
      edges: [
        {
          id: 'root->child',
          source: 'root',
          target: 'child',
          type: 'mind-parent',
          style: {
            ...DEFAULT_EDGE_STYLE,
            arrow: 'end',
            colorToken: 'warning',
            linePattern: 'dotted',
            routing: 'straight',
            width: 'thick'
          }
        }
      ],
      nodes: [
        {
          id: 'root',
          type: 'topic',
          position: { x: 0, y: 0 },
          data: { title: 'Root' },
          style: {
            ...DEFAULT_TOPIC_STYLE,
            borderStyle: 'dashed',
            colorToken: 'purple',
            shape: 'pill',
            shadowLevel: 'md',
            size: 'lg',
            textWeight: 'bold',
            tone: 'solid'
          }
        },
        {
          id: 'child',
          type: 'topic',
          position: { x: 240, y: 0 },
          data: { title: 'Child' },
          style: DEFAULT_TOPIC_STYLE
        }
      ]
    })

    expect(migrateMindDocument(document)).toEqual(mindDocumentV2Schema.parse(document))
  })

  it('accepts v3 documents with every supported node type', () => {
    const document = v3Document({
      nodes: [
        {
          id: 'topic',
          type: 'topic',
          position: { x: 0, y: 0 },
          size: DEFAULT_NODE_SIZE_BY_TYPE.topic,
          shellStyle: DEFAULT_NODE_SHELL_STYLE,
          data: { title: 'Topic' },
          contentStyle: DEFAULT_TOPIC_CONTENT_STYLE
        },
        {
          id: 'image',
          type: 'image',
          position: { x: 260, y: 0 },
          size: DEFAULT_NODE_SIZE_BY_TYPE.image,
          shellStyle: DEFAULT_NODE_SHELL_STYLE,
          data: { url: 'https://example.com/image.png' },
          contentStyle: DEFAULT_IMAGE_CONTENT_STYLE
        },
        {
          id: 'link',
          type: 'link',
          position: { x: 520, y: 0 },
          size: DEFAULT_NODE_SIZE_BY_TYPE.link,
          shellStyle: DEFAULT_NODE_SHELL_STYLE,
          data: { title: 'Docs', url: 'https://example.com/docs' },
          contentStyle: DEFAULT_LINK_CONTENT_STYLE
        },
        {
          id: 'attachment',
          type: 'attachment',
          position: { x: 780, y: 0 },
          size: DEFAULT_NODE_SIZE_BY_TYPE.attachment,
          shellStyle: DEFAULT_NODE_SHELL_STYLE,
          data: { fileName: 'brief.pdf', url: 'https://example.com/brief.pdf' },
          contentStyle: DEFAULT_ATTACHMENT_CONTENT_STYLE
        },
        {
          id: 'code',
          type: 'code',
          position: { x: 1040, y: 0 },
          size: DEFAULT_NODE_SIZE_BY_TYPE.code,
          shellStyle: DEFAULT_NODE_SHELL_STYLE,
          data: { code: 'const answer = 42' },
          contentStyle: DEFAULT_CODE_CONTENT_STYLE
        },
        {
          id: 'task',
          type: 'task',
          position: { x: 1380, y: 0 },
          size: DEFAULT_NODE_SIZE_BY_TYPE.task,
          shellStyle: DEFAULT_NODE_SHELL_STYLE,
          data: { items: [{ id: 'task-1', title: 'Write plan', done: true }] },
          contentStyle: DEFAULT_TASK_CONTENT_STYLE
        }
      ]
    })

    expect(mindDocumentV3Schema.parse(document)).toEqual(document)
  })

  it('migrates v2 topic documents to v3 topic documents', () => {
    const migrated = migrateMindDocumentToV3(v2Document())

    expect(migrated).toMatchObject({
      version: 3,
      nodes: [
        {
          id: 'root',
          type: 'topic',
          size: DEFAULT_NODE_SIZE_BY_TYPE.topic,
          shellStyle: {
            borderStyle: DEFAULT_TOPIC_STYLE.borderStyle,
            colorToken: DEFAULT_TOPIC_STYLE.colorToken,
            shadowLevel: DEFAULT_TOPIC_STYLE.shadowLevel,
            shape: DEFAULT_TOPIC_STYLE.shape,
            tone: DEFAULT_TOPIC_STYLE.tone
          },
          data: { title: 'Root' },
          contentStyle: { textWeight: DEFAULT_TOPIC_STYLE.textWeight }
        }
      ]
    })
  })

  it('rejects invalid v3 URLs and empty task lists', () => {
    expect(
      mindDocumentV3Schema.safeParse(
        v3Document({
          nodes: [
            {
              id: 'image',
              type: 'image',
              position: { x: 0, y: 0 },
              size: DEFAULT_NODE_SIZE_BY_TYPE.image,
              shellStyle: DEFAULT_NODE_SHELL_STYLE,
              data: { url: 'not a url' },
              contentStyle: DEFAULT_IMAGE_CONTENT_STYLE
            }
          ]
        })
      ).success
    ).toBe(false)

    expect(
      mindDocumentV3Schema.safeParse(
        v3Document({
          nodes: [
            {
              id: 'task',
              type: 'task',
              position: { x: 0, y: 0 },
              size: DEFAULT_NODE_SIZE_BY_TYPE.task,
              shellStyle: DEFAULT_NODE_SHELL_STYLE,
              data: { items: [] },
              contentStyle: DEFAULT_TASK_CONTENT_STYLE
            }
          ]
        })
      ).success
    ).toBe(false)
  })

  it('rejects invalid object color tokens and missing v2 styles', () => {
    expect(
      mindDocumentSchema.safeParse(
        v2Document({
          nodes: [
            {
              id: 'root',
              type: 'topic',
              position: { x: 0, y: 0 },
              data: { title: 'Root' },
              style: { ...DEFAULT_TOPIC_STYLE, colorToken: 'teal' }
            }
          ]
        })
      ).success
    ).toBe(false)

    expect(
      mindDocumentSchema.safeParse(
        v2Document({
          nodes: [
            {
              id: 'root',
              type: 'topic',
              position: { x: 0, y: 0 },
              data: { title: 'Root' }
            }
          ]
        })
      ).success
    ).toBe(false)
  })

  it('rejects invalid and missing v2 edge styles', () => {
    expect(
      mindDocumentSchema.safeParse(
        v2Document({
          edges: [
            {
              id: 'root->child',
              source: 'root',
              target: 'child',
              type: 'mind-parent',
              style: { ...DEFAULT_EDGE_STYLE, colorToken: 'teal' }
            }
          ]
        })
      ).success
    ).toBe(false)

    expect(
      mindDocumentSchema.safeParse(
        v2Document({
          edges: [
            {
              id: 'root->child',
              source: 'root',
              target: 'child',
              type: 'mind-parent'
            }
          ]
        })
      ).success
    ).toBe(false)
  })

  it('rejects unknown v2 style keys including nested edge style keys', () => {
    expect(
      mindDocumentSchema.safeParse(
        v2Document({
          nodes: [
            {
              id: 'root',
              type: 'topic',
              position: { x: 0, y: 0 },
              data: { title: 'Root' },
              style: { ...DEFAULT_TOPIC_STYLE, rogue: true }
            }
          ]
        })
      ).success
    ).toBe(false)

    expect(
      mindDocumentSchema.safeParse(
        v2Document({
          edges: [
            {
              id: 'root->child',
              source: 'root',
              target: 'child',
              type: 'mind-parent',
              style: { ...DEFAULT_EDGE_STYLE, rogue: true }
            }
          ]
        })
      ).success
    ).toBe(false)

    expect(
      mindDocumentSchema.safeParse(
        v2Document({
          edges: [
            {
              id: 'root->child',
              source: 'root',
              target: 'child',
              type: 'mind-parent',
              style: { ...DEFAULT_EDGE_STYLE, labelStyle: { visible: false, rogue: true } }
            }
          ]
        })
      ).success
    ).toBe(false)
  })

  it('rejects legacy edge component fields on v2 documents', () => {
    expect(
      mindDocumentSchema.safeParse(
        v2Document({
          edges: [
            {
              id: 'root->child',
              source: 'root',
              target: 'child',
              type: 'mind-parent',
              component: 'dashed-arrow',
              style: DEFAULT_EDGE_STYLE
            }
          ]
        })
      ).success
    ).toBe(false)
  })

  it('accepts v2 save document request bodies', () => {
    const document = v2Document()
    const parsed = saveDocumentRequestSchema.parse({ document })

    expect(parsed.document).toEqual(mindDocumentV2Schema.parse(document))
  })

  it('rejects v1 save document request bodies', () => {
    const result = saveDocumentRequestSchema.safeParse({ document: v1Document() })

    expect(result.success).toBe(false)
  })

  it('returns a failed safeParse result for invalid document request styles instead of throwing', () => {
    const invalidDocument = v2Document({
      nodes: [
        {
          id: 'root',
          type: 'topic',
          position: { x: 0, y: 0 },
          data: { title: 'Root' },
          style: { ...DEFAULT_TOPIC_STYLE, colorToken: 'teal' }
        }
      ]
    })
    let result: unknown

    expect(() => {
      result = saveDocumentRequestSchema.safeParse({ document: invalidDocument })
    }).not.toThrow()
    expect(result).toMatchObject({ success: false })
  })

  it('rejects HTML titles', () => {
    const result = mindDocumentSchema.safeParse(
      v2Document({
        nodes: [
          {
            id: 'node-1',
            type: 'topic',
            position: { x: 0, y: 0 },
            data: { title: '<img src=x onerror=alert(1)>' },
            style: DEFAULT_TOPIC_STYLE
          }
        ]
      })
    )

    expect(result.success).toBe(false)
  })

  it('rejects HTML in meta titles', () => {
    const result = mindDocumentSchema.safeParse(
      v2Document({
        meta: {
          projectId: 'project-1',
          title: '<script>alert(1)</script>',
          updatedAt: '2026-04-26T00:00:00.000Z'
        }
      })
    )

    expect(result.success).toBe(false)
  })
})

describe('project request schemas', () => {
  it('rejects HTML in project names', () => {
    expect(createProjectRequestSchema.safeParse({ name: '<b>Roadmap</b>' }).success).toBe(false)
    expect(renameProjectRequestSchema.safeParse({ name: 'Roadmap > Draft' }).success).toBe(false)
  })
})

describe('apiErrorBodySchema', () => {
  it('accepts a structured API error', () => {
    const parsed = apiErrorBodySchema.parse({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Name is required',
        details: { field: 'name' }
      }
    })

    expect(parsed.error.code).toBe('VALIDATION_ERROR')
  })
})
