# Theme Object Style System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade mind documents to v2 with persisted node and edge object styles while removing document-persisted theme.

**Architecture:** `@mind-x/shared` owns the v1/v2 schemas, style tokens, defaults, and migration. Engine, API, and web only operate on v2 documents after their input boundaries call shared migration. The web renderer resolves object style tokens to local CSS variables, while app theme continues to affect only global UI and canvas surfaces.

**Tech Stack:** TypeScript, Zod, Vue 3, Pinia, Ant Design Vue, Vitest, Immer patches, Koa, MySQL repository layer.

---

## File Structure

- Modify `packages/shared/src/document.ts`: define v1 schema, v2 schema, object style schemas, default style constants, migration helper, and exported v2 types.
- Modify `packages/shared/src/api.ts`: make save request validation migrate unknown document input to v2.
- Modify `packages/shared/src/document.test.ts`: replace v1-only tests with v1, v2, migration, and invalid style coverage.
- Modify `packages/mind-engine/src/documentFactory.ts`: create empty v2 documents without `meta.theme`.
- Modify `packages/mind-engine/src/graph.ts`: remove edge component creation options; create parent edges with default v2 edge style.
- Modify `packages/mind-engine/src/commands.ts`: remove edge component inheritance, add node and edge style patch commands, create explicit default styles.
- Modify `packages/mind-engine/src/commands.test.ts`: update v2 fixtures and cover style commands.
- Modify `packages/mind-engine/src/graph.test.ts` and `packages/mind-engine/src/history.test.ts`: update fixtures that still include v1 theme or edge components.
- Modify `apps/api/src/modules/projects/projects.repository.ts`: migrate stored JSON to v2 at read boundary.
- Modify `apps/api/src/modules/projects/projects.service.ts`: validate saved documents through migration before graph assertion and persistence.
- Modify `apps/api/src/modules/projects/projects.test.ts`: assert API normalizes v1 input and returns v2.
- Modify `apps/web/src/services/syncService.ts`: migrate server responses and local drafts to v2.
- Modify `apps/web/src/services/syncService.test.ts`: cover v1 server and draft migration.
- Modify `apps/web/src/services/saveFailureDraft.ts` and `apps/web/src/services/saveFailureDraft.test.ts`: keep type usage v2-compatible and cover no theme mutation.
- Modify `apps/web/src/stores/editor.ts`: remove document theme action, add selected node and edge style actions.
- Modify `apps/web/src/stores/editor.test.ts`: replace theme mutation tests and edge component tests with object style tests.
- Create `apps/web/src/components/editor/objectStyles.ts`: resolve topic and edge styles to class names and CSS custom properties.
- Create `apps/web/src/components/editor/objectStyles.test.ts`: test resolver output and fallback behavior.
- Delete `apps/web/src/components/editor/edgeComponents.ts` and `apps/web/src/components/editor/edgeComponents.test.ts`: edge component presets no longer exist in v2.
- Modify `apps/web/src/components/editor/TopicNode.vue`: apply topic style variables and classes.
- Modify `apps/web/src/components/editor/EdgeRenderer.vue`: apply edge style variables, arrow, line pattern, width, and routing.
- Modify `apps/web/src/components/editor/SelectionLayer.vue`: keep selected outlines independent from object style dimensions.
- Modify `apps/web/src/components/editor/EdgeInspector.vue`: replace component radio group with edge style controls.
- Create `apps/web/src/components/editor/NodeInspector.vue`: topic node style controls.
- Create `apps/web/src/components/editor/StyleField.vue`: shared compact labeled field wrapper for inspector controls.
- Create `apps/web/src/components/editor/ColorTokenPicker.vue`: shared object color token selector.
- Modify `apps/web/src/components/editor/MindEditor.vue`: open node or edge inspector and wire style changes.
- Modify `apps/web/src/views/EditorView.vue`: stop reading or writing `document.meta.theme`.
- Modify `apps/web/src/services/exportPng.test.ts`: update v2 fixtures.

## Task 1: Shared V2 Document Schema And Migration

**Files:**
- Modify: `packages/shared/src/document.ts`
- Modify: `packages/shared/src/api.ts`
- Modify: `packages/shared/src/document.test.ts`

- [ ] **Step 1: Write failing shared tests for v2 shape and v1 migration**

Replace the current theme and edge component tests in `packages/shared/src/document.test.ts` with v2-focused fixtures. Keep the HTML title tests, but update all valid document fixtures to include `version: 2`, no `meta.theme`, and explicit styles.

Use these helpers at the top of the test file after imports:

```ts
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
```

Add these tests:

```ts
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

  it('migrates save document request bodies to v2', () => {
    const parsed = saveDocumentRequestSchema.parse({ document: v1Document() })

    expect(parsed.document.version).toBe(2)
    expect(parsed.document.nodes[0].style).toEqual(DEFAULT_TOPIC_STYLE)
    expect(parsed.document.edges[0].style).toEqual(DEFAULT_EDGE_STYLE)
  })
})
```

- [ ] **Step 2: Run shared tests to verify they fail**

Run:

```bash
npm test -- packages/shared/src/document.test.ts
```

Expected: FAIL with TypeScript or assertion errors because `DEFAULT_TOPIC_STYLE`, `DEFAULT_EDGE_STYLE`, `mindDocumentV1Schema`, `mindDocumentV2Schema`, and `migrateMindDocument` do not exist yet.

- [ ] **Step 3: Implement v1 and v2 schemas, defaults, and migration**

Replace `packages/shared/src/document.ts` with this structure, preserving the existing plain text, point, size, and viewport rules:

```ts
import { z } from 'zod'

export const createPlainTextSchema = (maxLength = 500) =>
  z.string().min(1).max(maxLength).refine((value) => !/[<>]/.test(value), {
    message: 'HTML is not allowed'
  })

export const plainTextSchema = createPlainTextSchema()

export const pointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite()
})

export const sizeSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive()
})

export const viewportSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  zoom: z.number().min(0.2).max(3)
})
```

Add the v1 compatibility schemas:

```ts
export const legacyThemeNameSchema = z.enum(['light', 'dark', 'colorful', 'vivid'])
export const edgeComponentSchema = z.enum(['plain', 'dashed', 'arrow', 'dashed-arrow'])
export const edgeDirectionSchema = z.literal('source-target')

export const mindNodeV1Schema = z.object({
  id: z.string().min(1),
  type: z.literal('topic'),
  position: pointSchema,
  size: sizeSchema.optional(),
  data: z.object({
    title: plainTextSchema
  })
})

export const mindEdgeV1Schema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  type: z.literal('mind-parent'),
  component: edgeComponentSchema.optional(),
  data: z
    .object({
      direction: edgeDirectionSchema.optional()
    })
    .optional()
})

export const mindDocumentV1Schema = z.object({
  version: z.literal(1),
  meta: z.object({
    projectId: z.string().min(1),
    title: plainTextSchema,
    theme: legacyThemeNameSchema,
    updatedAt: z.string().datetime()
  }),
  viewport: viewportSchema,
  nodes: z.array(mindNodeV1Schema),
  edges: z.array(mindEdgeV1Schema)
})
```

Add object styles and v2 schemas:

```ts
export const OBJECT_COLOR_TOKENS = ['default', 'primary', 'success', 'warning', 'danger', 'info', 'purple'] as const

export const objectColorTokenSchema = z.enum(OBJECT_COLOR_TOKENS)

export const topicNodeStyleSchema = z.object({
  colorToken: objectColorTokenSchema,
  tone: z.enum(['soft', 'solid', 'outline']),
  shape: z.enum(['rounded', 'rectangle', 'pill']),
  size: z.enum(['sm', 'md', 'lg']),
  borderStyle: z.enum(['none', 'solid', 'dashed']),
  shadowLevel: z.enum(['none', 'sm', 'md']),
  textWeight: z.enum(['regular', 'medium', 'bold'])
})

export const edgeLabelStyleSchema = z.object({
  visible: z.literal(false)
})

export const edgeEndpointStyleSchema = z.object({
  source: z.literal('none'),
  target: z.literal('none')
})

export const edgeAnimationStyleSchema = z.object({
  enabled: z.literal(false)
})

export const edgeStyleSchema = z.object({
  colorToken: objectColorTokenSchema,
  linePattern: z.enum(['solid', 'dashed', 'dotted']),
  arrow: z.enum(['none', 'end']),
  width: z.enum(['thin', 'regular', 'thick']),
  routing: z.enum(['curved', 'straight', 'elbow']),
  labelStyle: edgeLabelStyleSchema,
  endpointStyle: edgeEndpointStyleSchema,
  animation: edgeAnimationStyleSchema
})

export const DEFAULT_TOPIC_STYLE = {
  borderStyle: 'solid',
  colorToken: 'default',
  shadowLevel: 'sm',
  shape: 'rounded',
  size: 'md',
  textWeight: 'medium',
  tone: 'soft'
} as const satisfies z.infer<typeof topicNodeStyleSchema>

export const DEFAULT_EDGE_STYLE = {
  animation: { enabled: false },
  arrow: 'none',
  colorToken: 'default',
  endpointStyle: { source: 'none', target: 'none' },
  labelStyle: { visible: false },
  linePattern: 'solid',
  routing: 'curved',
  width: 'regular'
} as const satisfies z.infer<typeof edgeStyleSchema>

export const mindNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('topic'),
  position: pointSchema,
  size: sizeSchema.optional(),
  data: z.object({
    title: plainTextSchema
  }),
  style: topicNodeStyleSchema
})

export const mindEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  type: z.literal('mind-parent'),
  style: edgeStyleSchema
})

export const mindDocumentV2Schema = z.object({
  version: z.literal(2),
  meta: z.object({
    projectId: z.string().min(1),
    title: plainTextSchema,
    updatedAt: z.string().datetime()
  }),
  viewport: viewportSchema,
  nodes: z.array(mindNodeSchema),
  edges: z.array(mindEdgeSchema)
})

export const mindDocumentSchema = mindDocumentV2Schema
```

Add migration and exported types:

```ts
export function migrateMindDocument(input: unknown): MindDocument {
  const v2Result = mindDocumentV2Schema.safeParse(input)
  if (v2Result.success) {
    return v2Result.data
  }

  const v1 = mindDocumentV1Schema.parse(input)
  return mindDocumentV2Schema.parse({
    version: 2,
    meta: {
      projectId: v1.meta.projectId,
      title: v1.meta.title,
      updatedAt: v1.meta.updatedAt
    },
    viewport: v1.viewport,
    nodes: v1.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      ...(node.size ? { size: node.size } : {}),
      data: node.data,
      style: DEFAULT_TOPIC_STYLE
    })),
    edges: v1.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      style: DEFAULT_EDGE_STYLE
    }))
  })
}

export type Point = z.infer<typeof pointSchema>
export type Size = z.infer<typeof sizeSchema>
export type Viewport = z.infer<typeof viewportSchema>
export type ObjectColorToken = z.infer<typeof objectColorTokenSchema>
export type TopicNodeStyle = z.infer<typeof topicNodeStyleSchema>
export type EdgeStyle = z.infer<typeof edgeStyleSchema>
export type EdgeLabelStyle = z.infer<typeof edgeLabelStyleSchema>
export type EdgeEndpointStyle = z.infer<typeof edgeEndpointStyleSchema>
export type EdgeAnimationStyle = z.infer<typeof edgeAnimationStyleSchema>
export type MindNode = z.infer<typeof mindNodeSchema>
export type MindEdge = z.infer<typeof mindEdgeSchema>
export type MindDocument = z.infer<typeof mindDocumentV2Schema>
export type MindDocumentV1 = z.infer<typeof mindDocumentV1Schema>
export type ThemeName = z.infer<typeof legacyThemeNameSchema>
export type PlainText = z.infer<typeof plainTextSchema>
```

- [ ] **Step 4: Update save request validation to migrate at the request boundary**

In `packages/shared/src/api.ts`, replace the save document request schema with:

```ts
export const saveDocumentRequestSchema = z.object({
  document: z.unknown().transform((document) => migrateMindDocument(document))
})
```

Also update the import:

```ts
import { createPlainTextSchema, migrateMindDocument } from './document.js'
```

- [ ] **Step 5: Run shared tests and typecheck for shared**

Run:

```bash
npm test -- packages/shared/src/document.test.ts
npx tsc -b packages/shared
```

Expected: both commands pass.

- [ ] **Step 6: Commit shared document contract**

```bash
git add packages/shared/src/document.ts packages/shared/src/api.ts packages/shared/src/document.test.ts
git commit -m "feat(shared): add v2 object style document contract"
```

## Task 2: Engine V2 Creation, Graph, And Style Commands

**Files:**
- Modify: `packages/mind-engine/src/documentFactory.ts`
- Modify: `packages/mind-engine/src/graph.ts`
- Modify: `packages/mind-engine/src/commands.ts`
- Modify: `packages/mind-engine/src/commands.test.ts`
- Modify: `packages/mind-engine/src/graph.test.ts`
- Modify: `packages/mind-engine/src/history.test.ts`

- [ ] **Step 1: Write failing engine tests for v2 defaults and style commands**

In `packages/mind-engine/src/commands.test.ts`, update imports to remove `setEdgeComponent` and add shared defaults and style commands:

```ts
import {
  DEFAULT_EDGE_STYLE,
  DEFAULT_TOPIC_STYLE,
  type EdgeStyle,
  type TopicNodeStyle
} from '@mind-x/shared'
```

Add these tests near the existing add-node and edge tests:

```ts
it('creates root and child objects with explicit v2 default styles', () => {
  const doc = createEmptyDocument({
    now: '2026-04-26T00:00:00.000Z',
    projectId: 'project-1',
    title: 'Project One'
  })

  const withRoot = addRootNode(doc, { id: 'root', title: 'Root' })
  const withChild = addChildNode(withRoot, { parentId: 'root', id: 'child', title: 'Child' })

  expect(withRoot).toMatchObject({
    version: 2,
    meta: {
      projectId: 'project-1',
      title: 'Project One',
      updatedAt: '2026-04-26T00:00:00.000Z'
    }
  })
  expect(withChild.nodes.map((node) => node.style)).toEqual([DEFAULT_TOPIC_STYLE, DEFAULT_TOPIC_STYLE])
  expect(withChild.edges).toEqual([
    {
      id: 'root->child',
      source: 'root',
      target: 'child',
      type: 'mind-parent',
      style: DEFAULT_EDGE_STYLE
    }
  ])
})

it('updates node style as an undoable patch command', () => {
  const doc = addRootNode(createEmptyDocument({ projectId: 'project-1', title: 'Project One', now: '2026-04-26T00:00:00.000Z' }), {
    id: 'root',
    title: 'Root'
  })
  const stylePatch: Partial<TopicNodeStyle> = { colorToken: 'purple', shape: 'pill', textWeight: 'bold' }

  const result = executeCommand(doc, setNodeStyleCommand, { nodeId: 'root', stylePatch })

  expect(result.document.nodes[0].style).toEqual({ ...DEFAULT_TOPIC_STYLE, ...stylePatch })
  expect(applyPatches(result.document, result.inversePatches)).toEqual(doc)
})

it('updates edge style as an undoable patch command', () => {
  const doc = addChildNode(
    addRootNode(createEmptyDocument({ projectId: 'project-1', title: 'Project One', now: '2026-04-26T00:00:00.000Z' }), {
      id: 'root',
      title: 'Root'
    }),
    { parentId: 'root', id: 'child', title: 'Child' }
  )
  const stylePatch: Partial<EdgeStyle> = { arrow: 'end', colorToken: 'warning', linePattern: 'dotted', width: 'thick' }

  const result = executeCommand(doc, setEdgeStyleCommand, { edgeId: 'root->child', stylePatch })

  expect(result.document.edges[0].style).toEqual({ ...DEFAULT_EDGE_STYLE, ...stylePatch })
  expect(applyPatches(result.document, result.inversePatches)).toEqual(doc)
})

it('rejects style updates for missing objects', () => {
  const doc = createEmptyDocument({
    now: '2026-04-26T00:00:00.000Z',
    projectId: 'project-1',
    title: 'Project One'
  })

  expect(() => executeCommand(doc, setNodeStyleCommand, { nodeId: 'missing', stylePatch: { colorToken: 'danger' } })).toThrow(
    'Node missing does not exist'
  )
  expect(() => executeCommand(doc, setEdgeStyleCommand, { edgeId: 'missing', stylePatch: { colorToken: 'danger' } })).toThrow(
    'Edge missing does not exist'
  )
})
```

Remove or rewrite tests with these names because v2 no longer preserves edge components:

- `sets an edge component without changing structure`
- `rejects setting a missing edge component target`
- `creates child edges with the most recent child edge component from the same parent`
- `creates child edges with the plain component when the latest child edge omits component`
- `creates first child edges with the plain component`
- `preserves child edge components when promoting children after deleting a node`

- [ ] **Step 2: Run engine command tests to verify they fail**

Run:

```bash
npm test -- packages/mind-engine/src/commands.test.ts
```

Expected: FAIL because v2 defaults and style commands are not implemented.

- [ ] **Step 3: Update empty document factory**

In `packages/mind-engine/src/documentFactory.ts`, change `createEmptyDocument` to return v2 without theme:

```ts
import type { MindDocument } from '@mind-x/shared'

export type CreateDocumentInput = {
  projectId: string
  title: string
  now: string
}

export function createEmptyDocument(input: CreateDocumentInput): MindDocument {
  return {
    version: 2,
    meta: {
      projectId: input.projectId,
      title: input.title,
      updatedAt: input.now
    },
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [],
    edges: []
  }
}
```

- [ ] **Step 4: Update graph edge creation**

In `packages/mind-engine/src/graph.ts`, replace the imports and `createParentEdge` implementation:

```ts
import { DEFAULT_EDGE_STYLE, type MindDocument, type MindEdge, type MindNode } from '@mind-x/shared'
```

```ts
export function createParentEdge(source: string, target: string): MindEdge {
  return {
    id: `${source}->${target}`,
    source,
    target,
    type: 'mind-parent',
    style: DEFAULT_EDGE_STYLE
  }
}
```

Remove `MindEdgeComponent` and `CreateParentEdgeOptions` from this file.

- [ ] **Step 5: Update commands to create default styles and style patch commands**

In `packages/mind-engine/src/commands.ts`, update the shared import:

```ts
import {
  DEFAULT_TOPIC_STYLE,
  mindDocumentSchema,
  type EdgeStyle,
  type MindDocument,
  type Point,
  type TopicNodeStyle
} from '@mind-x/shared'
```

Remove `DEFAULT_EDGE_COMPONENT`, `MindEdge`, `MindEdgeComponent`, `getEdgeComponent`, and `getNewChildEdgeComponent`.

In `addRootNodeCommand`, include style:

```ts
  draft.nodes.push({
    id: input.id,
    type: 'topic',
    position: { x: 0, y: 0 },
    size: { width: ROOT_NODE_WIDTH, height: ROOT_NODE_HEIGHT },
    data: { title: input.title },
    style: DEFAULT_TOPIC_STYLE
  })
```

In `addChildNodeCommand`, remove component lookup and push default styled node and edge:

```ts
  draft.nodes.push({
    id: input.id,
    type: 'topic',
    position,
    data: { title: input.title },
    style: DEFAULT_TOPIC_STYLE
  })
  draft.edges.push(createParentEdge(input.parentId, input.id))
```

Add node style command:

```ts
export type SetNodeStyleInput = {
  nodeId: string
  stylePatch: Partial<TopicNodeStyle>
}

export function setNodeStyleCommand(draft: Draft<MindDocument>, input: SetNodeStyleInput): void {
  const node = findNode(asDocument(draft), input.nodeId)
  if (!node) {
    throw new Error(`Node ${input.nodeId} does not exist`)
  }

  node.style = {
    ...node.style,
    ...input.stylePatch
  }
  assertMindTree(asDocument(draft))
}

export function setNodeStyle(document: MindDocument, input: SetNodeStyleInput): MindDocument {
  return executeCommand(document, setNodeStyleCommand, input).document
}
```

Replace edge component command with edge style command:

```ts
export type SetEdgeStyleInput = {
  edgeId: string
  stylePatch: Partial<EdgeStyle>
}

export function setEdgeStyleCommand(draft: Draft<MindDocument>, input: SetEdgeStyleInput): void {
  const edge = draft.edges.find((candidate) => candidate.id === input.edgeId)
  if (!edge) {
    throw new Error(`Edge ${input.edgeId} does not exist`)
  }

  edge.style = {
    ...edge.style,
    ...input.stylePatch
  }
  assertMindTree(asDocument(draft))
}

export function setEdgeStyle(document: MindDocument, input: SetEdgeStyleInput): MindDocument {
  return executeCommand(document, setEdgeStyleCommand, input).document
}
```

In `deleteNodePromoteChildrenCommand`, remove component preservation and create promoted edges with defaults:

```ts
  if (parentId) {
    for (const childId of childIds) {
      draft.edges.push(createParentEdge(parentId, childId))
    }
  }
```

- [ ] **Step 6: Update remaining engine fixtures**

In `packages/mind-engine/src/graph.test.ts` and `packages/mind-engine/src/history.test.ts`, update document literals so they are v2:

```ts
{
  version: 2,
  meta: {
    projectId: 'project-1',
    title: 'Project One',
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
  edges: []
}
```

Import `DEFAULT_TOPIC_STYLE` and `DEFAULT_EDGE_STYLE` where fixtures need styled nodes or edges.

- [ ] **Step 7: Run engine tests and typecheck**

Run:

```bash
npm test -- packages/mind-engine/src
npx tsc -b packages/shared packages/mind-engine
```

Expected: both commands pass.

- [ ] **Step 8: Commit engine migration**

```bash
git add packages/mind-engine/src packages/shared/src/document.ts
git commit -m "feat(engine): operate on v2 styled documents"
```

## Task 3: API And Sync Boundaries Normalize Documents To V2

**Files:**
- Modify: `apps/api/src/modules/projects/projects.repository.ts`
- Modify: `apps/api/src/modules/projects/projects.service.ts`
- Modify: `apps/api/src/modules/projects/projects.test.ts`
- Modify: `apps/web/src/services/syncService.ts`
- Modify: `apps/web/src/services/syncService.test.ts`
- Modify: `apps/web/src/services/saveFailureDraft.test.ts`

- [ ] **Step 1: Write failing API tests for v1 normalization**

In `apps/api/src/modules/projects/projects.test.ts`, import shared defaults:

```ts
import { DEFAULT_EDGE_STYLE, DEFAULT_TOPIC_STYLE, type MindDocument, type MindDocumentV1 } from '@mind-x/shared'
```

Add helper:

```ts
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
    edges: [
      { id: 'root->child', source: 'root', target: 'child', type: 'mind-parent', component: 'dashed-arrow' }
    ]
  }
}
```

Add route test:

```ts
it('normalizes legacy v1 document saves and loads to v2', async () => {
  installProjectStore()
  const headers = authHeaders()
  const createResponse = await requestApp('/api/projects', {
    body: { name: 'Legacy' },
    headers,
    method: 'POST'
  })
  const projectId = (createResponse.body as { project: { id: string } }).project.id
  const legacy = legacyDocument(projectId)

  const saveResponse = await requestApp(`/api/projects/${projectId}/document`, {
    body: { document: legacy },
    headers,
    method: 'PUT'
  })

  expect(saveResponse.status).toBe(200)
  const saved = (saveResponse.body as { document: MindDocument }).document
  expect(saved.version).toBe(2)
  expect(saved.meta).toEqual({
    projectId,
    title: 'Legacy',
    updatedAt: '2026-04-26T12:00:00.000Z'
  })
  expect(saved.nodes.map((node) => node.style)).toEqual([DEFAULT_TOPIC_STYLE, DEFAULT_TOPIC_STYLE])
  expect(saved.edges[0]).toEqual({
    id: 'root->child',
    source: 'root',
    target: 'child',
    type: 'mind-parent',
    style: DEFAULT_EDGE_STYLE
  })

  await expect(requestApp(`/api/projects/${projectId}/document`, { headers })).resolves.toEqual({
    body: { document: saved },
    status: 200
  })
})
```

Add repository test:

```ts
it('migrates v1 JSON columns to v2 records', async () => {
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
      version: 2,
      nodes: [
        expect.objectContaining({ style: DEFAULT_TOPIC_STYLE }),
        expect.objectContaining({ style: DEFAULT_TOPIC_STYLE })
      ],
      edges: [expect.objectContaining({ style: DEFAULT_EDGE_STYLE })]
    }
  })
})
```

- [ ] **Step 2: Update web sync tests for migration**

In `apps/web/src/services/syncService.test.ts`, import defaults and `MindDocumentV1`:

```ts
import { DEFAULT_TOPIC_STYLE, type MindDocument, type MindDocumentV1 } from '@mind-x/shared'
```

Add a `legacyDocument()` helper:

```ts
function legacyDocument(): MindDocumentV1 {
  return {
    version: 1,
    meta: {
      projectId: 'project-1',
      title: 'Legacy',
      theme: 'dark',
      updatedAt: '2026-04-26T00:00:00.000Z'
    },
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [{ id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } }],
    edges: []
  }
}
```

Add tests:

```ts
it('migrates legacy server documents when loading', async () => {
  mockedApiClient.get.mockResolvedValueOnce({ data: { document: legacyDocument() } })

  await expect(loadServerDocument('project/one')).resolves.toMatchObject({
    version: 2,
    nodes: [expect.objectContaining({ style: DEFAULT_TOPIC_STYLE })]
  })
})

it('migrates legacy local drafts when reading', async () => {
  localForageMock.store.getItem.mockResolvedValueOnce({
    document: legacyDocument(),
    savedAt: '2026-04-26T00:00:00.000Z'
  })

  await expect(getLocalDraft('project-1')).resolves.toMatchObject({
    document: {
      version: 2,
      nodes: [expect.objectContaining({ style: DEFAULT_TOPIC_STYLE })]
    },
    savedAt: '2026-04-26T00:00:00.000Z'
  })
})
```

- [ ] **Step 3: Run API and sync tests to verify failures**

Run:

```bash
npm test -- apps/api/src/modules/projects/projects.test.ts apps/web/src/services/syncService.test.ts
```

Expected: FAIL where stored and server documents still use `mindDocumentSchema.parse` without migration.

- [ ] **Step 4: Migrate repository reads**

In `apps/api/src/modules/projects/projects.repository.ts`, change the import:

```ts
import { migrateMindDocument, type MindDocument } from '@mind-x/shared'
```

Change `parseDocumentJson`:

```ts
function parseDocumentJson(value: MindDocument | string): MindDocument {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    return migrateMindDocument(parsed)
  } catch (error) {
    throw new StoredProjectDocumentError(error)
  }
}
```

- [ ] **Step 5: Migrate save service input before graph validation**

In `apps/api/src/modules/projects/projects.service.ts`, change the shared import:

```ts
import { migrateMindDocument, type MindDocument, type ProjectSummaryDto } from '@mind-x/shared'
```

At the start of `saveDocument`, normalize the input:

```ts
export async function saveDocument(userId: string, projectId: string, document: MindDocument): Promise<MindDocument> {
  const normalizedDocument = migrateMindDocument(document)

  if (normalizedDocument.meta.projectId !== projectId) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Document projectId must match route project id')
  }
```

Use `normalizedDocument` for `assertMindTree`, persistence, and return:

```ts
    assertMindTree(normalizedDocument)
```

```ts
  const affectedRows = await updateProjectDocument({ document: normalizedDocument, projectId, userId })
```

```ts
  return normalizedDocument
```

- [ ] **Step 6: Migrate web sync service boundaries**

In `apps/web/src/services/syncService.ts`, change the import:

```ts
import { migrateMindDocument, type MindDocument } from '@mind-x/shared'
```

Update parse calls:

```ts
export async function loadServerDocument(projectId: string): Promise<MindDocument> {
  const { data } = await apiClient.get<DocumentResponse>(documentUrl(projectId))
  return migrateMindDocument(data.document)
}

export async function saveServerDocument(projectId: string, document: MindDocument): Promise<MindDocument> {
  const validDocument = migrateMindDocument(document)
  const { data } = await apiClient.put<DocumentResponse>(documentUrl(projectId), { document: validDocument })
  const savedDocument = migrateMindDocument(data.document)
  await clearLocalDraftBestEffort(projectId, 'Unable to clear local draft after server save')
  return savedDocument
}

export async function saveLocalDraft(projectId: string, document: MindDocument): Promise<LocalDraft> {
  const draft = {
    document: migrateMindDocument(document),
    savedAt: new Date().toISOString()
  }
  await draftsStore.setItem(projectId, draft)
  return draft
}
```

Update `parseLocalDraft`:

```ts
  try {
    return {
      document: migrateMindDocument(value.document),
      savedAt: value.savedAt
    }
  } catch {
    return null
  }
```

- [ ] **Step 7: Run boundary tests**

Run:

```bash
npm test -- apps/api/src/modules/projects/projects.test.ts apps/web/src/services/syncService.test.ts apps/web/src/services/saveFailureDraft.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 8: Commit API and sync normalization**

```bash
git add apps/api/src/modules/projects apps/web/src/services packages/shared/src/api.ts
git commit -m "feat(app): normalize documents to v2 at boundaries"
```

## Task 4: Web Store Removes Document Theme And Adds Style Actions

**Files:**
- Modify: `apps/web/src/stores/editor.ts`
- Modify: `apps/web/src/stores/editor.test.ts`
- Modify: `apps/web/src/views/EditorView.vue`

- [ ] **Step 1: Write failing store tests for object style history and no document theme**

In `apps/web/src/stores/editor.test.ts`, update imports:

```ts
import {
  DEFAULT_EDGE_STYLE,
  DEFAULT_TOPIC_STYLE,
  type EdgeStyle,
  type MindDocument,
  type TopicNodeStyle
} from '@mind-x/shared'
```

Replace the document theme tests with:

```ts
it('updates selected node style as an undoable dirty change', () => {
  const store = loadedStore(
    emptyDocument({
      nodes: [{ id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' }, style: DEFAULT_TOPIC_STYLE }]
    })
  )

  store.selectOnly('root')
  store.setSelectedNodeStyle({ colorToken: 'purple', shape: 'pill', textWeight: 'bold' })

  expect(store.document?.nodes[0].style).toEqual({
    ...DEFAULT_TOPIC_STYLE,
    colorToken: 'purple',
    shape: 'pill',
    textWeight: 'bold'
  })
  expect(store.dirty).toBe(true)
  expect(store.canUndo).toBe(true)

  store.undo()

  expect(store.document?.nodes[0].style).toEqual(DEFAULT_TOPIC_STYLE)
  expect(store.dirty).toBe(false)
})

it('updates selected edge style as an undoable dirty change', () => {
  const store = loadedStore(
    emptyDocument({
      nodes: [
        { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' }, style: DEFAULT_TOPIC_STYLE },
        { id: 'child', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'Child' }, style: DEFAULT_TOPIC_STYLE }
      ],
      edges: [{ id: 'root->child', source: 'root', target: 'child', type: 'mind-parent', style: DEFAULT_EDGE_STYLE }]
    })
  )

  store.selectEdge('root->child')
  store.setSelectedEdgeStyle({ arrow: 'end', colorToken: 'warning', linePattern: 'dotted', width: 'thick' })

  expect(store.document?.edges[0].style).toEqual({
    ...DEFAULT_EDGE_STYLE,
    arrow: 'end',
    colorToken: 'warning',
    linePattern: 'dotted',
    width: 'thick'
  })
  expect(store.dirty).toBe(true)
  expect(store.canUndo).toBe(true)

  store.undo()

  expect(store.document?.edges[0].style).toEqual(DEFAULT_EDGE_STYLE)
  expect(store.dirty).toBe(false)
})

it('ignores style updates when no matching selection exists', () => {
  const store = loadedStore()

  expect(() => store.setSelectedNodeStyle({ colorToken: 'danger' })).not.toThrow()
  expect(() => store.setSelectedEdgeStyle({ colorToken: 'danger' })).not.toThrow()
  expect(store.dirty).toBe(false)
  expect(store.canUndo).toBe(false)
})
```

Remove tests that call `setDocumentTheme`, because document theme no longer exists.

- [ ] **Step 2: Run store tests to verify failures**

Run:

```bash
npm test -- apps/web/src/stores/editor.test.ts
```

Expected: FAIL because the store has `setSelectedEdgeComponent` and `setDocumentTheme`, not style actions.

- [ ] **Step 3: Update store imports and untracked state preservation**

In `apps/web/src/stores/editor.ts`, change imports from shared and engine:

```ts
import {
  mindDocumentSchema,
  type EdgeStyle,
  type MindDocument,
  type Point,
  type TopicNodeStyle,
  type Viewport
} from '@mind-x/shared'
```

```ts
import {
  addChildNodeCommand,
  addRootNodeCommand,
  createHistory,
  deleteEdgeDetachChildCommand,
  deleteNodesPromoteChildrenCommand,
  editNodeTitleCommand,
  executeCommand,
  moveNodes,
  moveNodesCommand,
  replaceWithPatchResult,
  setEdgeStyleCommand,
  setNodeStyleCommand,
  type CommandResult,
  type History
} from '@mind-x/mind-engine'
```

Update `preserveUntrackedDocumentState` so it only preserves viewport:

```ts
function preserveUntrackedDocumentState(
  document: MindDocument,
  currentDocument: MindDocument | null | undefined
): MindDocument {
  return currentDocument?.viewport ? { ...document, viewport: { ...currentDocument.viewport } } : document
}
```

Delete `setDocumentTheme`.

- [ ] **Step 4: Add selected node and edge style actions**

Replace `setSelectedEdgeComponent` with:

```ts
    setSelectedNodeStyle(stylePatch: Partial<TopicNodeStyle>): void {
      if (!this.document || this.selectedNodeIds.length !== 1) {
        return
      }

      const nodeId = this.selectedNodeIds[0]
      if (!this.document.nodes.some((node) => node.id === nodeId)) {
        this.selectedNodeIds = []
        return
      }

      this.commitCommandResult(
        executeCommand(cloneDocument(this.document), setNodeStyleCommand, {
          nodeId,
          stylePatch
        })
      )
    },
    setSelectedEdgeStyle(stylePatch: Partial<EdgeStyle>): void {
      if (!this.document || !this.selectedEdgeId) {
        return
      }

      const edgeId = this.selectedEdgeId
      if (!this.document.edges.some((edge) => edge.id === edgeId)) {
        this.selectedEdgeId = null
        return
      }

      this.commitCommandResult(
        executeCommand(cloneDocument(this.document), setEdgeStyleCommand, {
          edgeId,
          stylePatch
        })
      )
    },
```

- [ ] **Step 5: Stop document theme writes from EditorView**

In `apps/web/src/views/EditorView.vue`, remove `ThemeName` from the shared import:

```ts
import type { MindDocument } from '@mind-x/shared'
```

Remove `setTheme(activeDocument.meta.theme)` from `loadProjectDocument`.

Replace `handleThemeChange`:

```ts
function handleThemeChange(): void {
  // ThemeToggle already updates the local theme controller; documents no longer store theme.
}
```

If TypeScript reports an unused function parameter in the template binding, use:

```ts
function handleThemeChange(_themeName: unknown): void {
  // ThemeToggle already updates the local theme controller; documents no longer store theme.
}
```

- [ ] **Step 6: Run store tests and web typecheck**

Run:

```bash
npm test -- apps/web/src/stores/editor.test.ts
npm run typecheck
```

Expected: both commands pass after dependent fixtures are updated to v2.

- [ ] **Step 7: Commit store style actions**

```bash
git add apps/web/src/stores/editor.ts apps/web/src/stores/editor.test.ts apps/web/src/views/EditorView.vue
git commit -m "feat(web): edit object styles in editor store"
```

## Task 5: Object Style Resolver And Renderer Updates

**Files:**
- Create: `apps/web/src/components/editor/objectStyles.ts`
- Create: `apps/web/src/components/editor/objectStyles.test.ts`
- Delete: `apps/web/src/components/editor/edgeComponents.ts`
- Delete: `apps/web/src/components/editor/edgeComponents.test.ts`
- Modify: `apps/web/src/components/editor/TopicNode.vue`
- Modify: `apps/web/src/components/editor/EdgeRenderer.vue`
- Modify: `apps/web/src/components/editor/SelectionLayer.vue`

- [ ] **Step 1: Write resolver tests**

Create `apps/web/src/components/editor/objectStyles.test.ts`:

```ts
import { DEFAULT_EDGE_STYLE, DEFAULT_TOPIC_STYLE } from '@mind-x/shared'
import { describe, expect, it } from 'vitest'
import {
  getEdgeMarkerEnd,
  resolveEdgeStyle,
  resolveTopicNodeClass,
  resolveTopicNodeStyle
} from './objectStyles'

describe('object style resolvers', () => {
  it('resolves default topic style to CSS variables and classes', () => {
    expect(resolveTopicNodeClass(DEFAULT_TOPIC_STYLE)).toEqual([
      'topic-node--tone-soft',
      'topic-node--shape-rounded',
      'topic-node--size-md',
      'topic-node--border-solid',
      'topic-node--shadow-sm',
      'topic-node--weight-medium'
    ])
    expect(resolveTopicNodeStyle(DEFAULT_TOPIC_STYLE)).toMatchObject({
      '--object-border': '#cbd5e1',
      '--object-fill': '#ffffff',
      '--object-text': '#111827'
    })
  })

  it('resolves solid purple topic styles', () => {
    expect(resolveTopicNodeStyle({ ...DEFAULT_TOPIC_STYLE, colorToken: 'purple', tone: 'solid' })).toMatchObject({
      '--object-border': '#7c3aed',
      '--object-fill': '#7c3aed',
      '--object-text': '#ffffff'
    })
  })

  it('resolves edge line style, dash arrays, width, routing, and marker behavior', () => {
    const resolved = resolveEdgeStyle({
      ...DEFAULT_EDGE_STYLE,
      arrow: 'end',
      colorToken: 'warning',
      linePattern: 'dotted',
      routing: 'straight',
      width: 'thick'
    })

    expect(resolved).toEqual({
      classNames: ['edge-renderer__path', 'edge-renderer__path--routing-straight'],
      style: {
        '--edge-dasharray': '2 7',
        '--edge-stroke': '#d97706',
        '--edge-width': '3'
      }
    })
    expect(getEdgeMarkerEnd({ ...DEFAULT_EDGE_STYLE, arrow: 'none' }, 'marker')).toBeUndefined()
    expect(getEdgeMarkerEnd({ ...DEFAULT_EDGE_STYLE, arrow: 'end' }, 'marker')).toBe('url(#marker)')
  })
})
```

- [ ] **Step 2: Run resolver tests to verify failure**

Run:

```bash
npm test -- apps/web/src/components/editor/objectStyles.test.ts
```

Expected: FAIL because `objectStyles.ts` does not exist.

- [ ] **Step 3: Implement object style resolver**

Create `apps/web/src/components/editor/objectStyles.ts`:

```ts
import type { CSSProperties } from 'vue'
import type { EdgeStyle, ObjectColorToken, TopicNodeStyle } from '@mind-x/shared'

type TopicPalette = {
  border: string
  softFill: string
  solidFill: string
  text: string
}

const TOPIC_PALETTE: Record<ObjectColorToken, TopicPalette> = {
  danger: { border: '#dc2626', softFill: '#fef2f2', solidFill: '#dc2626', text: '#7f1d1d' },
  default: { border: '#cbd5e1', softFill: '#ffffff', solidFill: '#334155', text: '#111827' },
  info: { border: '#0891b2', softFill: '#ecfeff', solidFill: '#0891b2', text: '#164e63' },
  primary: { border: '#2563eb', softFill: '#eff6ff', solidFill: '#2563eb', text: '#1e3a8a' },
  purple: { border: '#7c3aed', softFill: '#f5f3ff', solidFill: '#7c3aed', text: '#4c1d95' },
  success: { border: '#16a34a', softFill: '#f0fdf4', solidFill: '#16a34a', text: '#14532d' },
  warning: { border: '#d97706', softFill: '#fffbeb', solidFill: '#d97706', text: '#78350f' }
}

const EDGE_STROKE: Record<ObjectColorToken, string> = {
  danger: '#dc2626',
  default: '#64748b',
  info: '#0891b2',
  primary: '#2563eb',
  purple: '#7c3aed',
  success: '#16a34a',
  warning: '#d97706'
}

const EDGE_DASHARRAY: Record<EdgeStyle['linePattern'], string> = {
  dashed: '8 8',
  dotted: '2 7',
  solid: 'none'
}

const EDGE_WIDTH: Record<EdgeStyle['width'], string> = {
  regular: '2',
  thick: '3',
  thin: '1.5'
}

export type CssVariableStyle = CSSProperties & Record<`--${string}`, string>

export function resolveTopicNodeClass(style: TopicNodeStyle): string[] {
  return [
    `topic-node--tone-${style.tone}`,
    `topic-node--shape-${style.shape}`,
    `topic-node--size-${style.size}`,
    `topic-node--border-${style.borderStyle}`,
    `topic-node--shadow-${style.shadowLevel}`,
    `topic-node--weight-${style.textWeight}`
  ]
}

export function resolveTopicNodeStyle(style: TopicNodeStyle): CssVariableStyle {
  const palette = TOPIC_PALETTE[style.colorToken]
  const solid = style.tone === 'solid'
  return {
    '--object-border': palette.border,
    '--object-fill': solid ? palette.solidFill : palette.softFill,
    '--object-text': solid ? '#ffffff' : palette.text
  }
}

export function resolveEdgeStyle(style: EdgeStyle): { classNames: string[]; style: CssVariableStyle } {
  return {
    classNames: ['edge-renderer__path', `edge-renderer__path--routing-${style.routing}`],
    style: {
      '--edge-dasharray': EDGE_DASHARRAY[style.linePattern],
      '--edge-stroke': EDGE_STROKE[style.colorToken],
      '--edge-width': EDGE_WIDTH[style.width]
    }
  }
}

export function getEdgeMarkerEnd(style: EdgeStyle, markerId: string): string | undefined {
  return style.arrow === 'end' ? `url(#${markerId})` : undefined
}
```

- [ ] **Step 4: Update TopicNode rendering**

In `apps/web/src/components/editor/TopicNode.vue`, import resolver helpers:

```ts
import { resolveTopicNodeClass, resolveTopicNodeStyle } from './objectStyles'
```

Update computed style and class:

```ts
const nodeStyle = computed(() => ({
  ...resolveTopicNodeStyle(props.node.style),
  height: `${props.node.size?.height ?? 56}px`,
  transform: `translate(${props.node.position.x}px, ${props.node.position.y}px)`,
  width: `${props.node.size?.width ?? 180}px`
}))

const nodeClass = computed(() => [
  ...resolveTopicNodeClass(props.node.style),
  { 'topic-node--selected': props.selected }
])
```

Update template:

```vue
:class="nodeClass"
```

Update scoped CSS object color and style classes:

```css
.topic-node {
  border: 1px solid var(--object-border);
  background: var(--object-fill);
  color: var(--object-text);
}

.topic-node--tone-outline {
  background: var(--color-surface);
}

.topic-node--shape-rectangle {
  border-radius: 2px;
}

.topic-node--shape-rounded {
  border-radius: 8px;
}

.topic-node--shape-pill {
  border-radius: 999px;
}

.topic-node--size-sm {
  padding: 7px 10px;
}

.topic-node--size-md {
  padding: 10px 14px;
}

.topic-node--size-lg {
  padding: 13px 18px;
}

.topic-node--border-none {
  border-color: transparent;
}

.topic-node--border-dashed {
  border-style: dashed;
}

.topic-node--shadow-none {
  box-shadow: none;
}

.topic-node--shadow-sm {
  box-shadow: var(--shadow-node);
}

.topic-node--shadow-md {
  box-shadow: 0 10px 26px rgb(15 23 42 / 14%);
}

.topic-node--weight-regular .topic-node__title,
.topic-node--weight-regular .topic-node__input {
  font-weight: 400;
}

.topic-node--weight-medium .topic-node__title,
.topic-node--weight-medium .topic-node__input {
  font-weight: 650;
}

.topic-node--weight-bold .topic-node__title,
.topic-node--weight-bold .topic-node__input {
  font-weight: 750;
}
```

- [ ] **Step 5: Update EdgeRenderer to use edge style**

In `apps/web/src/components/editor/EdgeRenderer.vue`, remove `getEdgeComponent`, `hasArrow`, and `hasDash` import. Import:

```ts
import { getEdgeMarkerEnd, resolveEdgeStyle } from './objectStyles'
```

Replace `getVisiblePathClass` with:

```ts
function getVisiblePathClass(edge: MindEdge) {
  const resolved = resolveEdgeStyle(edge.style)
  return [
    ...resolved.classNames,
    {
      'edge-renderer__path--active': isEdgeActive(edge),
      'edge-renderer__path--selected': props.selectedEdgeId === edge.id
    }
  ]
}

function getVisiblePathStyle(edge: MindEdge) {
  return resolveEdgeStyle(edge.style).style
}
```

Update `getMarkerEnd`:

```ts
function getMarkerEnd(edge: MindEdge): string | undefined {
  const markerId = props.selectedEdgeId === edge.id ? selectedEdgeArrowMarkerId : edgeArrowMarkerId
  return getEdgeMarkerEnd(edge.style, markerId)
}
```

Update template visible path:

```vue
<path
  :class="getVisiblePathClass(edge)"
  :d="getPath(edge) ?? undefined"
  :marker-end="getMarkerEnd(edge)"
  :style="getVisiblePathStyle(edge)"
/>
```

Update marker template:

```vue
<path class="edge-renderer__marker" d="M 0 0 L 8 4 L 0 8 z" />
```

Keep selected marker class on selected marker path.

Update CSS:

```css
.edge-renderer__path {
  fill: none;
  pointer-events: none;
  stroke: var(--edge-stroke);
  stroke-dasharray: var(--edge-dasharray);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: var(--edge-width);
  transition:
    stroke 120ms ease,
    stroke-width 120ms ease;
}

.edge-renderer__path--active {
  filter: drop-shadow(0 0 2px rgb(15 23 42 / 18%));
}

.edge-renderer__path--selected {
  stroke-width: calc(var(--edge-width) + 1px);
}

.edge-renderer__marker {
  fill: var(--edge-stroke);
}

.edge-renderer__marker--selected {
  fill: var(--edge-stroke);
}
```

Keep `getPath` curved for this task. Routing path behavior is added in Task 7 after basic rendering compiles.

- [ ] **Step 6: Delete edge component helper files**

Run:

```bash
git rm apps/web/src/components/editor/edgeComponents.ts apps/web/src/components/editor/edgeComponents.test.ts
```

- [ ] **Step 7: Run resolver and renderer-related tests**

Run:

```bash
npm test -- apps/web/src/components/editor/objectStyles.test.ts
npm run typecheck
```

Expected: both commands pass.

- [ ] **Step 8: Commit renderer style resolution**

```bash
git add apps/web/src/components/editor
git commit -m "feat(web): render styled mind objects"
```

## Task 6: Node And Edge Inspector Style Controls

**Files:**
- Create: `apps/web/src/components/editor/StyleField.vue`
- Create: `apps/web/src/components/editor/ColorTokenPicker.vue`
- Create: `apps/web/src/components/editor/NodeInspector.vue`
- Modify: `apps/web/src/components/editor/EdgeInspector.vue`
- Modify: `apps/web/src/components/editor/MindEditor.vue`

- [ ] **Step 1: Create shared inspector field wrapper**

Create `apps/web/src/components/editor/StyleField.vue`:

```vue
<script setup lang="ts">
defineProps<{
  label: string
}>()
</script>

<template>
  <label class="style-field">
    <span class="style-field__label">{{ label }}</span>
    <span class="style-field__control">
      <slot />
    </span>
  </label>
</template>

<style scoped>
.style-field {
  display: grid;
  gap: 6px;
}

.style-field__label {
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 650;
  line-height: 1.2;
}

.style-field__control {
  min-width: 0;
}
</style>
```

- [ ] **Step 2: Create color token picker**

Create `apps/web/src/components/editor/ColorTokenPicker.vue`:

```vue
<script setup lang="ts">
import { OBJECT_COLOR_TOKENS, type ObjectColorToken } from '@mind-x/shared'

defineProps<{
  value: ObjectColorToken
}>()

const emit = defineEmits<{
  change: [value: ObjectColorToken]
}>()

const COLOR_LABELS: Record<ObjectColorToken, string> = {
  danger: 'Danger',
  default: 'Default',
  info: 'Info',
  primary: 'Primary',
  purple: 'Purple',
  success: 'Success',
  warning: 'Warning'
}

function onChange(value: ObjectColorToken): void {
  emit('change', value)
}
</script>

<template>
  <a-select :value="value" size="small" @change="onChange">
    <a-select-option v-for="token in OBJECT_COLOR_TOKENS" :key="token" :value="token">
      {{ COLOR_LABELS[token] }}
    </a-select-option>
  </a-select>
</template>
```

- [ ] **Step 3: Create node inspector**

Create `apps/web/src/components/editor/NodeInspector.vue`:

```vue
<script setup lang="ts">
import type { TopicNodeStyle } from '@mind-x/shared'
import ColorTokenPicker from './ColorTokenPicker.vue'
import StyleField from './StyleField.vue'

defineProps<{
  style: TopicNodeStyle
}>()

const emit = defineEmits<{
  styleChange: [stylePatch: Partial<TopicNodeStyle>]
}>()
</script>

<template>
  <section class="node-inspector" aria-label="Node inspector">
    <StyleField label="Color">
      <ColorTokenPicker :value="style.colorToken" @change="(colorToken) => emit('styleChange', { colorToken })" />
    </StyleField>
    <StyleField label="Tone">
      <a-segmented
        :options="['soft', 'solid', 'outline']"
        :value="style.tone"
        size="small"
        @change="(tone) => emit('styleChange', { tone: tone as TopicNodeStyle['tone'] })"
      />
    </StyleField>
    <StyleField label="Shape">
      <a-select
        :value="style.shape"
        size="small"
        @change="(shape) => emit('styleChange', { shape: shape as TopicNodeStyle['shape'] })"
      >
        <a-select-option value="rounded">Rounded</a-select-option>
        <a-select-option value="rectangle">Rectangle</a-select-option>
        <a-select-option value="pill">Pill</a-select-option>
      </a-select>
    </StyleField>
    <StyleField label="Size">
      <a-segmented
        :options="['sm', 'md', 'lg']"
        :value="style.size"
        size="small"
        @change="(size) => emit('styleChange', { size: size as TopicNodeStyle['size'] })"
      />
    </StyleField>
    <StyleField label="Border">
      <a-select
        :value="style.borderStyle"
        size="small"
        @change="(borderStyle) => emit('styleChange', { borderStyle: borderStyle as TopicNodeStyle['borderStyle'] })"
      >
        <a-select-option value="none">None</a-select-option>
        <a-select-option value="solid">Solid</a-select-option>
        <a-select-option value="dashed">Dashed</a-select-option>
      </a-select>
    </StyleField>
    <StyleField label="Shadow">
      <a-segmented
        :options="['none', 'sm', 'md']"
        :value="style.shadowLevel"
        size="small"
        @change="(shadowLevel) => emit('styleChange', { shadowLevel: shadowLevel as TopicNodeStyle['shadowLevel'] })"
      />
    </StyleField>
    <StyleField label="Text">
      <a-select
        :value="style.textWeight"
        size="small"
        @change="(textWeight) => emit('styleChange', { textWeight: textWeight as TopicNodeStyle['textWeight'] })"
      >
        <a-select-option value="regular">Regular</a-select-option>
        <a-select-option value="medium">Medium</a-select-option>
        <a-select-option value="bold">Bold</a-select-option>
      </a-select>
    </StyleField>
  </section>
</template>

<style scoped>
.node-inspector {
  display: grid;
  gap: 10px;
}
</style>
```

- [ ] **Step 4: Replace edge inspector controls**

Replace `apps/web/src/components/editor/EdgeInspector.vue` with:

```vue
<script setup lang="ts">
import { DeleteOutlined } from '@ant-design/icons-vue'
import type { EdgeStyle } from '@mind-x/shared'
import ColorTokenPicker from './ColorTokenPicker.vue'
import StyleField from './StyleField.vue'

defineProps<{
  style: EdgeStyle
}>()

const emit = defineEmits<{
  styleChange: [stylePatch: Partial<EdgeStyle>]
  delete: []
}>()
</script>

<template>
  <section class="edge-inspector" aria-label="Edge inspector">
    <StyleField label="Color">
      <ColorTokenPicker :value="style.colorToken" @change="(colorToken) => emit('styleChange', { colorToken })" />
    </StyleField>
    <StyleField label="Line">
      <a-select
        :value="style.linePattern"
        size="small"
        @change="(linePattern) => emit('styleChange', { linePattern: linePattern as EdgeStyle['linePattern'] })"
      >
        <a-select-option value="solid">Solid</a-select-option>
        <a-select-option value="dashed">Dashed</a-select-option>
        <a-select-option value="dotted">Dotted</a-select-option>
      </a-select>
    </StyleField>
    <StyleField label="Arrow">
      <a-segmented
        :options="['none', 'end']"
        :value="style.arrow"
        size="small"
        @change="(arrow) => emit('styleChange', { arrow: arrow as EdgeStyle['arrow'] })"
      />
    </StyleField>
    <StyleField label="Width">
      <a-segmented
        :options="['thin', 'regular', 'thick']"
        :value="style.width"
        size="small"
        @change="(width) => emit('styleChange', { width: width as EdgeStyle['width'] })"
      />
    </StyleField>
    <StyleField label="Routing">
      <a-select
        :value="style.routing"
        size="small"
        @change="(routing) => emit('styleChange', { routing: routing as EdgeStyle['routing'] })"
      >
        <a-select-option value="curved">Curved</a-select-option>
        <a-select-option value="straight">Straight</a-select-option>
        <a-select-option value="elbow">Elbow</a-select-option>
      </a-select>
    </StyleField>

    <a-button block danger type="text" @click="emit('delete')">
      <template #icon>
        <DeleteOutlined />
      </template>
      Delete edge
    </a-button>
  </section>
</template>

<style scoped>
.edge-inspector {
  display: grid;
  gap: 10px;
}
</style>
```

- [ ] **Step 5: Wire inspectors in MindEditor**

In `apps/web/src/components/editor/MindEditor.vue`, update shared imports:

```ts
import type { EdgeStyle, MindDocument, MindEdge, MindNode, Point, TopicNodeStyle } from '@mind-x/shared'
```

Remove `MindEdgeComponent` and `getEdgeComponent` import. Add:

```ts
import NodeInspector from './NodeInspector.vue'
```

Add selected node computed:

```ts
const selectedNode = computed<MindNode | null>(() => {
  if (!documentState.value || editor.selectedNodeIds.length !== 1) {
    return null
  }

  return documentState.value.nodes.find((node) => node.id === editor.selectedNodeIds[0]) ?? null
})
```

Replace edge component handler with:

```ts
function setSelectedNodeStyle(stylePatch: Partial<TopicNodeStyle>): void {
  editor.setSelectedNodeStyle(stylePatch)
}

function setSelectedEdgeStyle(stylePatch: Partial<EdgeStyle>): void {
  editor.setSelectedEdgeStyle(stylePatch)
}
```

Add node inspector before edge inspector:

```vue
<InspectorPanel v-if="selectedNode" title="Node" @close="editor.clearSelection">
  <NodeInspector :style="selectedNode.style" @style-change="setSelectedNodeStyle" />
</InspectorPanel>
```

Update edge inspector:

```vue
<InspectorPanel v-if="selectedEdge" title="Edge" @close="editor.clearSelection">
  <EdgeInspector
    :style="selectedEdge.style"
    @style-change="setSelectedEdgeStyle"
    @delete="deleteSelectedEdgeFromInspector"
  />
</InspectorPanel>
```

- [ ] **Step 6: Run web typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS with no `MindEdgeComponent`, `component`, or `setSelectedEdgeComponent` references remaining in web source.

- [ ] **Step 7: Commit inspector UI**

```bash
git add apps/web/src/components/editor apps/web/src/stores/editor.ts
git commit -m "feat(web): add object style inspectors"
```

## Task 7: Routing Behavior, Fixtures, And Final Verification

**Files:**
- Modify: `apps/web/src/components/editor/EdgeRenderer.vue`
- Modify: `apps/web/src/services/exportPng.test.ts`
- Modify: any remaining test fixture files found by search.

- [ ] **Step 1: Add edge routing path tests through pure helper extraction**

In `apps/web/src/components/editor/objectStyles.ts`, add pure route helper:

```ts
export type EdgePathInput = {
  endX: number
  endY: number
  routing: EdgeStyle['routing']
  startX: number
  startY: number
}

export function createEdgePath({ endX, endY, routing, startX, startY }: EdgePathInput): string {
  if (routing === 'straight') {
    return `M ${startX} ${startY} L ${endX} ${endY}`
  }

  if (routing === 'elbow') {
    const midX = startX + (endX - startX) / 2
    return `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`
  }

  const forward = endX >= startX
  const curve = Math.max(64, Math.abs(endX - startX) * 0.45)
  const c1x = startX + (forward ? curve : -curve)
  const c2x = endX + (forward ? -curve : curve)
  return `M ${startX} ${startY} C ${c1x} ${startY}, ${c2x} ${endY}, ${endX} ${endY}`
}
```

Add tests in `apps/web/src/components/editor/objectStyles.test.ts`:

```ts
it('creates routed edge paths', () => {
  expect(createEdgePath({ startX: 0, startY: 10, endX: 100, endY: 50, routing: 'straight' })).toBe(
    'M 0 10 L 100 50'
  )
  expect(createEdgePath({ startX: 0, startY: 10, endX: 100, endY: 50, routing: 'elbow' })).toBe(
    'M 0 10 L 50 10 L 50 50 L 100 50'
  )
  expect(createEdgePath({ startX: 0, startY: 10, endX: 100, endY: 50, routing: 'curved' })).toBe(
    'M 0 10 C 64 10, 36 50, 100 50'
  )
})
```

Update import in the test:

```ts
import {
  createEdgePath,
  getEdgeMarkerEnd,
  resolveEdgeStyle,
  resolveTopicNodeClass,
  resolveTopicNodeStyle
} from './objectStyles'
```

- [ ] **Step 2: Use routing helper in EdgeRenderer**

In `apps/web/src/components/editor/EdgeRenderer.vue`, import `createEdgePath`:

```ts
import { createEdgePath, getEdgeMarkerEnd, resolveEdgeStyle } from './objectStyles'
```

Replace the final curve calculation in `getPath`:

```ts
  return createEdgePath({
    endX,
    endY,
    routing: edge.style.routing,
    startX,
    startY
  })
```

- [ ] **Step 3: Remove all remaining v1 theme and edge component references from source tests**

Run:

```bash
rg -n "meta\\.theme|theme: 'light'|theme: 'dark'|theme: 'colorful'|theme: 'vivid'|component:|MindEdgeComponent|setEdgeComponent|setSelectedEdgeComponent|DEFAULT_EDGE_COMPONENT" packages apps
```

Expected before cleanup: only intentional v1 migration tests may contain `theme:` and `component:`.

For each non-migration fixture, add explicit `style: DEFAULT_TOPIC_STYLE` to nodes and `style: DEFAULT_EDGE_STYLE` to edges. For `apps/web/src/services/exportPng.test.ts`, update the local fixture helper to:

```ts
function document(overrides: Partial<MindDocument> = {}): MindDocument {
  return {
    version: 2,
    meta: {
      projectId: 'project-1',
      title: 'Project One',
      updatedAt: '2026-04-26T00:00:00.000Z'
    },
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [],
    edges: [],
    ...overrides
  }
}
```

When a test creates nodes directly, use:

```ts
{ data: { title: 'Root' }, id: 'root', position: { x: 120, y: 80 }, style: DEFAULT_TOPIC_STYLE, type: 'topic' }
```

- [ ] **Step 4: Run targeted tests**

Run:

```bash
npm test -- packages/shared/src/document.test.ts packages/mind-engine/src/commands.test.ts apps/web/src/stores/editor.test.ts apps/web/src/components/editor/objectStyles.test.ts apps/web/src/services/syncService.test.ts apps/api/src/modules/projects/projects.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 5: Run full verification**

Run:

```bash
npm run typecheck
npm test
npm run build
```

Expected:

- `npm run typecheck` passes.
- `npm test` passes all test files.
- `npm run build` passes. Vite may print the existing chunk-size warning.

- [ ] **Step 6: Commit final cleanup and verification fixes**

```bash
git add packages apps
git commit -m "feat(web): complete v2 object style migration"
```

## Self-Review Checklist

- Spec coverage: this plan covers shared v2 schema, migration, engine commands, API/web normalization, theme removal from document flow, renderer style resolution, inspector controls, undo/redo semantics, and verification.
- Placeholder scan: every implementation step includes concrete code snippets or exact commands.
- Type consistency: shared exports use `TopicNodeStyle`, `EdgeStyle`, `ObjectColorToken`, `MindDocumentV1`, and v2 `MindDocument`; engine and web tasks import those names consistently.
- Scope check: the plan keeps custom palettes, non-topic nodes, edge labels, endpoint decoration, animation UI, and global default style preferences out of implementation.
