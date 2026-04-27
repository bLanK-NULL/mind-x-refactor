import { describe, expect, it } from 'vitest'
import {
  apiErrorBodySchema,
  createProjectRequestSchema,
  mindDocumentSchema,
  renameProjectRequestSchema
} from './index.js'

describe('mindDocumentSchema', () => {
  it('accepts a versioned mind document', () => {
    const parsed = mindDocumentSchema.parse({
      version: 1,
      meta: {
        projectId: 'project-1',
        title: 'Planning',
        theme: 'light',
        updatedAt: '2026-04-26T00:00:00.000Z'
      },
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [
        {
          id: 'node-1',
          type: 'topic',
          position: { x: 0, y: 0 },
          data: { title: 'Root' }
        }
      ],
      edges: []
    })

    expect(parsed.nodes[0].data.title).toBe('Root')
  })

  it('accepts colorful and vivid document themes', () => {
    for (const theme of ['colorful', 'vivid']) {
      const parsed = mindDocumentSchema.parse({
        version: 1,
        meta: {
          projectId: 'project-1',
          title: 'Planning',
          theme,
          updatedAt: '2026-04-26T00:00:00.000Z'
        },
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [
          {
            id: 'node-1',
            type: 'topic',
            position: { x: 0, y: 0 },
            data: { title: 'Root' }
          }
        ],
        edges: []
      })

      expect(parsed.meta.theme).toBe(theme)
    }
  })

  it('rejects unsupported document themes', () => {
    const result = mindDocumentSchema.safeParse({
      version: 1,
      meta: {
        projectId: 'project-1',
        title: 'Planning',
        theme: 'rainbow',
        updatedAt: '2026-04-26T00:00:00.000Z'
      },
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [
        {
          id: 'node-1',
          type: 'topic',
          position: { x: 0, y: 0 },
          data: { title: 'Root' }
        }
      ],
      edges: []
    })

    expect(result.success).toBe(false)
  })

  it('rejects HTML titles', () => {
    const result = mindDocumentSchema.safeParse({
      version: 1,
      meta: {
        projectId: 'project-1',
        title: 'Planning',
        theme: 'light',
        updatedAt: '2026-04-26T00:00:00.000Z'
      },
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [
        {
          id: 'node-1',
          type: 'topic',
          position: { x: 0, y: 0 },
          data: { title: '<img src=x onerror=alert(1)>' }
        }
      ],
      edges: []
    })

    expect(result.success).toBe(false)
  })

  it('rejects HTML in meta titles', () => {
    const result = mindDocumentSchema.safeParse({
      version: 1,
      meta: {
        projectId: 'project-1',
        title: '<script>alert(1)</script>',
        theme: 'light',
        updatedAt: '2026-04-26T00:00:00.000Z'
      },
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [
        {
          id: 'node-1',
          type: 'topic',
          position: { x: 0, y: 0 },
          data: { title: 'Root' }
        }
      ],
      edges: []
    })

    expect(result.success).toBe(false)
  })

  it('accepts all supported edge components and reserved direction data', () => {
    for (const component of ['plain', 'dashed', 'arrow', 'dashed-arrow']) {
      const parsed = mindDocumentSchema.parse({
        version: 1,
        meta: {
          projectId: 'project-1',
          title: 'Planning',
          theme: 'light',
          updatedAt: '2026-04-26T00:00:00.000Z'
        },
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [
          { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } },
          { id: 'child', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'Child' } }
        ],
        edges: [
          {
            id: `root->child-${component}`,
            source: 'root',
            target: 'child',
            type: 'mind-parent',
            component,
            data: { direction: 'source-target' }
          }
        ]
      })

      expect(parsed.edges[0].component).toBe(component)
      expect(parsed.edges[0].data?.direction).toBe('source-target')
    }
  })

  it('accepts an edge without a component for existing documents', () => {
    const parsed = mindDocumentSchema.parse({
      version: 1,
      meta: {
        projectId: 'project-1',
        title: 'Planning',
        theme: 'light',
        updatedAt: '2026-04-26T00:00:00.000Z'
      },
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [
        { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } },
        { id: 'child', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'Child' } }
      ],
      edges: [{ id: 'root->child', source: 'root', target: 'child', type: 'mind-parent' }]
    })

    expect(parsed.edges[0].component).toBeUndefined()
  })

  it('rejects unsupported edge components and directions', () => {
    const baseDocument = {
      version: 1,
      meta: {
        projectId: 'project-1',
        title: 'Planning',
        theme: 'light',
        updatedAt: '2026-04-26T00:00:00.000Z'
      },
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [
        { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } },
        { id: 'child', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'Child' } }
      ]
    }

    expect(
      mindDocumentSchema.safeParse({
        ...baseDocument,
        edges: [{ id: 'root->child', source: 'root', target: 'child', type: 'mind-parent', component: 'zigzag' }]
      }).success
    ).toBe(false)

    expect(
      mindDocumentSchema.safeParse({
        ...baseDocument,
        edges: [
          {
            id: 'root->child',
            source: 'root',
            target: 'child',
            type: 'mind-parent',
            component: 'arrow',
            data: { direction: 'target-source' }
          }
        ]
      }).success
    ).toBe(false)
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
