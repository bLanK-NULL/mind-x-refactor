import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EDGE_STYLE,
  DEFAULT_TOPIC_STYLE,
  apiErrorBodySchema,
  createProjectRequestSchema,
  migrateMindDocument,
  mindDocumentSchema,
  mindDocumentV1Schema,
  mindDocumentV2Schema,
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
        }
      ]
    })
    expect(migrated.nodes[1].size).toEqual({ width: 180, height: 72 })
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

  it('migrates save document request bodies to v2', () => {
    const parsed = saveDocumentRequestSchema.parse({ document: v1Document() })

    expect(parsed.document.version).toBe(2)
    expect(parsed.document.nodes[0].style).toEqual(DEFAULT_TOPIC_STYLE)
    expect(parsed.document.edges[0].style).toEqual(DEFAULT_EDGE_STYLE)
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
