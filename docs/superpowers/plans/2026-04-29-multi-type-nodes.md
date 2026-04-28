# Multi-Type Nodes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Mind X from topic-only nodes to a v3 multi-type node model with text, image, link, attachment, code, and task nodes.

**Architecture:** Introduce a v3 shared document schema first, then migrate the engine, store, and Vue canvas to a shared node shell plus type-specific content components. Keep graph rules type-agnostic so all node types can be roots, parents, children, and leaves.

**Tech Stack:** TypeScript, Zod, Immer, Vue 3, Pinia, Ant Design Vue, html2canvas, highlight.js.

---

## Context

The approved design spec is:

- `docs/superpowers/specs/2026-04-29-multi-type-nodes-design.md`

Context7 documentation check:

- `highlight.js` provides `highlightAuto(code, languageSubset)` for automatic language detection and supports loading the core package plus selected languages with `registerLanguage`.
- `Shiki` requires a `lang` option for `codeToHtml`, so it is not the right first choice for automatic detection.

Use `highlight.js` in this implementation.

## File Structure

Create:

- `apps/web/src/features/editor/components/canvas/BaseNode.vue`  
  Shared node shell for positioning, selection, dragging, resize handles, and edit-mode event gating.
- `apps/web/src/features/editor/components/canvas/node-content/TopicNodeContent.vue`  
  Text/topic content display and edit UI.
- `apps/web/src/features/editor/components/canvas/node-content/ImageNodeContent.vue`  
  URL-backed image content display and edit UI.
- `apps/web/src/features/editor/components/canvas/node-content/LinkNodeContent.vue`  
  Link content display and edit UI.
- `apps/web/src/features/editor/components/canvas/node-content/AttachmentNodeContent.vue`  
  Attachment link content display and edit UI.
- `apps/web/src/features/editor/components/canvas/node-content/CodeNodeContent.vue`  
  Code display, edit UI, and highlighted read-only rendering.
- `apps/web/src/features/editor/components/canvas/node-content/TaskNodeContent.vue`  
  Multi-item task list display and edit UI.
- `apps/web/src/features/editor/utils/codeHighlight.ts`  
  highlight.js registration and deterministic `highlightCode` wrapper.
- `apps/web/src/features/editor/utils/nodeContent.ts`  
  Web labels/icons and default display summaries for node types.
- `apps/web/src/features/editor/__tests__/codeHighlight.test.ts`  
  Unit tests for automatic code highlighting wrapper.
- `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`  
  Source-level tests that `NodeRenderer` dispatches all supported node content components.
- `apps/web/src/features/editor/__tests__/baseNode.test.ts`  
  Source-level tests for shell event-gating and resize-handle structure.

Modify:

- `packages/shared/src/document.ts`  
  Add v3 schemas, v3 types, node type constants, default shell/content styles, default sizes, and v1/v2-to-v3 migration.
- `packages/shared/src/document.test.ts`  
  Cover v3 schema, all node types, migrations, strict v3 save requests, and validation failures.
- `packages/shared/src/api.ts`  
  Continue deriving `saveDocumentRequestSchema` from current `mindDocumentSchema`, which becomes v3.
- `packages/mind-engine/src/documentFactory.ts`  
  Create empty v3 documents.
- `packages/mind-engine/src/commands.ts`  
  Add generic node commands, topic compatibility wrappers, node data/content style updates, and resize command.
- `packages/mind-engine/src/graph.ts`  
  Keep type-agnostic graph helpers working with the v3 `MindNode` union.
- `packages/mind-engine/src/editorSession/types.ts`  
  Add generic node action and resize-preview methods.
- `packages/mind-engine/src/editorSession/session.ts`  
  Wire generic node actions, data/content style updates, and resize preview batching.
- `packages/mind-engine/src/editorSession/state.ts`  
  Add default-node labels and keep existing dirty tracking.
- `packages/mind-engine/src/__tests__/commands.test.ts`  
  Cover generic add/update/style/resize commands across node types.
- `packages/mind-engine/src/__tests__/editorSession.test.ts`  
  Cover session generic node actions and resize preview history behavior.
- `apps/web/package.json` and `package-lock.json`  
  Add `highlight.js` to the web workspace.
- `apps/web/src/features/editor/stores/editor.ts`  
  Expose generic node actions, content updates, shell/content style updates, and resize methods.
- `apps/web/src/features/editor/components/canvas/NodeRenderer.vue`  
  Render `BaseNode` with a dynamic content component instead of rendering `TopicNode` directly.
- `apps/web/src/features/editor/components/canvas/TopicNode.vue`  
  Remove after `BaseNode` and `TopicNodeContent` replace it.
- `apps/web/src/features/editor/components/toolbar/EditorToolbar.vue`  
  Add node-type dropdown actions while keeping text/topic as quick action.
- `apps/web/src/features/editor/components/context-menu/EditorContextMenu.vue`  
  Add "Add child as" actions for all node types.
- `apps/web/src/features/editor/components/MindEditor.vue`  
  Wire generic add/edit/resize actions, new renderer events, and type-aware inspector props.
- `apps/web/src/features/editor/components/inspectors/NodeInspector.vue`  
  Split shell controls and type-specific content fields.
- `apps/web/src/features/editor/utils/objectStyles.ts`  
  Rename topic node style resolution to shell style resolution and add `resolveNodeShellClass`, `resolveNodeShellStyle`, and `resolveTopicContentClass`.
- `apps/web/src/features/editor/services/exportPng.ts`  
  Use required v3 `node.size` directly.
- `apps/web/src/features/editor/services/syncService.ts`  
  Continue migrating reads and server responses; saves remain strict v3 input.
- `apps/api/src/modules/projects/projects.test.ts`  
  Update fixtures and assertions for v3 documents and v3-only save semantics.
- `apps/web/src/features/editor/__tests__/editor.store.test.ts`  
  Update fixtures and add generic node action coverage.
- `apps/web/src/features/editor/__tests__/exportPng.test.ts`  
  Update v3 fixtures and remove v2 node-size fallback expectations.
- `apps/web/src/features/editor/__tests__/objectStyles.test.ts`  
  Update style helper expectations for `NodeShellStyle`.
- `apps/web/src/features/editor/__tests__/syncService.test.ts`  
  Update migration expectations to v3.

Delete:

- `apps/web/src/features/editor/components/canvas/TopicNode.vue` after the replacement renderer compiles.

---

### Task 1: Add Shared v3 Schema and Migration Tests Without Switching Current Consumers

**Files:**

- Modify: `packages/shared/src/document.ts`
- Modify: `packages/shared/src/document.test.ts`

- [ ] **Step 1: Add failing v3 schema tests**

Add these imports in `packages/shared/src/document.test.ts`:

```ts
import {
  DEFAULT_ATTACHMENT_CONTENT_STYLE,
  DEFAULT_CODE_CONTENT_STYLE,
  DEFAULT_IMAGE_CONTENT_STYLE,
  DEFAULT_LINK_CONTENT_STYLE,
  DEFAULT_NODE_SHELL_STYLE,
  DEFAULT_TASK_CONTENT_STYLE,
  DEFAULT_TOPIC_CONTENT_STYLE,
  DEFAULT_NODE_SIZE_BY_TYPE,
  mindDocumentV3Schema,
  migrateMindDocumentToV3
} from './index.js'
```

Add a v3 fixture helper near the existing `v2Document` helper:

```ts
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
```

Add these tests:

```ts
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
```

- [ ] **Step 2: Run shared tests and verify the new tests fail**

Run:

```bash
npm run test -w packages/shared
```

Expected: FAIL with missing exports such as `mindDocumentV3Schema` or `DEFAULT_NODE_SHELL_STYLE`.

- [ ] **Step 3: Add v3 schemas and migration helpers**

In `packages/shared/src/document.ts`, add these exports after `DEFAULT_EDGE_STYLE`:

```ts
export const NODE_TYPES = ['topic', 'image', 'link', 'attachment', 'code', 'task'] as const
export const mindNodeTypeSchema = z.enum(NODE_TYPES)

export const nodeShellStyleSchema = z.object({
  colorToken: objectColorTokenSchema,
  tone: z.enum(['soft', 'solid', 'outline']),
  shape: z.enum(['rounded', 'rectangle', 'pill']),
  borderStyle: z.enum(['none', 'solid', 'dashed']),
  shadowLevel: z.enum(['none', 'sm', 'md'])
}).strict()

export const topicContentStyleSchema = z.object({
  textWeight: z.enum(['regular', 'medium', 'bold'])
}).strict()

export const imageContentStyleSchema = z.object({
  objectFit: z.enum(['cover', 'contain'])
}).strict()

export const linkContentStyleSchema = z.object({
  layout: z.literal('summary')
}).strict()

export const attachmentContentStyleSchema = z.object({
  icon: z.literal('file')
}).strict()

export const codeContentStyleSchema = z.object({
  wrap: z.boolean()
}).strict()

export const taskContentStyleSchema = z.object({
  density: z.enum(['comfortable', 'compact'])
}).strict()

export const DEFAULT_NODE_SHELL_STYLE = {
  borderStyle: 'solid',
  colorToken: 'default',
  shadowLevel: 'sm',
  shape: 'rounded',
  tone: 'soft'
} as const satisfies z.infer<typeof nodeShellStyleSchema>

export const DEFAULT_TOPIC_CONTENT_STYLE = {
  textWeight: 'medium'
} as const satisfies z.infer<typeof topicContentStyleSchema>

export const DEFAULT_IMAGE_CONTENT_STYLE = {
  objectFit: 'cover'
} as const satisfies z.infer<typeof imageContentStyleSchema>

export const DEFAULT_LINK_CONTENT_STYLE = {
  layout: 'summary'
} as const satisfies z.infer<typeof linkContentStyleSchema>

export const DEFAULT_ATTACHMENT_CONTENT_STYLE = {
  icon: 'file'
} as const satisfies z.infer<typeof attachmentContentStyleSchema>

export const DEFAULT_CODE_CONTENT_STYLE = {
  wrap: true
} as const satisfies z.infer<typeof codeContentStyleSchema>

export const DEFAULT_TASK_CONTENT_STYLE = {
  density: 'comfortable'
} as const satisfies z.infer<typeof taskContentStyleSchema>

export const DEFAULT_NODE_SIZE_BY_TYPE = {
  attachment: { width: 240, height: 72 },
  code: { width: 320, height: 180 },
  image: { width: 240, height: 160 },
  link: { width: 240, height: 88 },
  task: { width: 260, height: 180 },
  topic: { width: 180, height: 56 }
} as const satisfies Record<z.infer<typeof mindNodeTypeSchema>, z.infer<typeof sizeSchema>>

const LEGACY_TOPIC_SIZE_TO_NODE_SIZE = {
  lg: { width: 220, height: 72 },
  md: DEFAULT_NODE_SIZE_BY_TYPE.topic,
  sm: { width: 150, height: 44 }
} as const satisfies Record<z.infer<typeof topicNodeStyleSchema>['size'], z.infer<typeof sizeSchema>>
```

Add v3 node schemas after `mindEdgeSchema`:

```ts
const nodeBaseV3Schema = z.object({
  id: z.string().min(1),
  position: pointV2Schema,
  size: sizeV2Schema,
  shellStyle: nodeShellStyleSchema
}).strict()

const topicNodeV3Schema = nodeBaseV3Schema.extend({
  type: z.literal('topic'),
  data: z.object({ title: plainTextSchema }).strict(),
  contentStyle: topicContentStyleSchema
}).strict()

const imageNodeV3Schema = nodeBaseV3Schema.extend({
  type: z.literal('image'),
  data: z.object({
    url: z.string().url(),
    alt: plainTextSchema.optional(),
    caption: plainTextSchema.optional()
  }).strict(),
  contentStyle: imageContentStyleSchema
}).strict()

const linkNodeV3Schema = nodeBaseV3Schema.extend({
  type: z.literal('link'),
  data: z.object({
    url: z.string().url(),
    title: plainTextSchema,
    description: plainTextSchema.optional()
  }).strict(),
  contentStyle: linkContentStyleSchema
}).strict()

const attachmentNodeV3Schema = nodeBaseV3Schema.extend({
  type: z.literal('attachment'),
  data: z.object({
    url: z.string().url(),
    fileName: plainTextSchema,
    fileSizeLabel: plainTextSchema.optional(),
    mimeType: plainTextSchema.optional()
  }).strict(),
  contentStyle: attachmentContentStyleSchema
}).strict()

const codeNodeV3Schema = nodeBaseV3Schema.extend({
  type: z.literal('code'),
  data: z.object({
    code: z.string().max(20000),
    language: z.string().min(1).max(64).optional()
  }).strict(),
  contentStyle: codeContentStyleSchema
}).strict()

const taskItemSchema = z.object({
  id: z.string().min(1),
  title: plainTextSchema,
  done: z.boolean(),
  notes: plainTextSchema.optional(),
  dueDate: z.string().datetime().optional(),
  priority: z.enum(['low', 'normal', 'high']).optional()
}).strict()

const taskNodeV3Schema = nodeBaseV3Schema.extend({
  type: z.literal('task'),
  data: z.object({
    items: z.array(taskItemSchema).min(1)
  }).strict(),
  contentStyle: taskContentStyleSchema
}).strict()

export const mindNodeV3Schema = z.discriminatedUnion('type', [
  topicNodeV3Schema,
  imageNodeV3Schema,
  linkNodeV3Schema,
  attachmentNodeV3Schema,
  codeNodeV3Schema,
  taskNodeV3Schema
])

export const mindDocumentV3Schema = z.object({
  version: z.literal(3),
  meta: mindDocumentMetaSchema,
  viewport: viewportV2Schema,
  nodes: z.array(mindNodeV3Schema),
  edges: z.array(mindEdgeSchema)
}).strict()
```

Add helper functions before `migratableMindDocumentSchema`:

```ts
function migrateTopicStyleToShellStyle(style: TopicNodeStyle): z.infer<typeof nodeShellStyleSchema> {
  return {
    borderStyle: style.borderStyle,
    colorToken: style.colorToken,
    shadowLevel: style.shadowLevel,
    shape: style.shape,
    tone: style.tone
  }
}

function createDefaultTopicContentStyleFromLegacy(style: TopicNodeStyle): z.infer<typeof topicContentStyleSchema> {
  return {
    textWeight: style.textWeight
  }
}

function migrateV2MindDocumentToV3(v2: z.infer<typeof mindDocumentV2Schema>): z.infer<typeof mindDocumentV3Schema> {
  return {
    version: 3,
    meta: v2.meta,
    viewport: v2.viewport,
    nodes: v2.nodes.map((node) => ({
      id: node.id,
      type: 'topic',
      position: node.position,
      size: node.size ?? LEGACY_TOPIC_SIZE_TO_NODE_SIZE[node.style.size],
      shellStyle: migrateTopicStyleToShellStyle(node.style),
      data: node.data,
      contentStyle: createDefaultTopicContentStyleFromLegacy(node.style)
    })),
    edges: v2.edges
  }
}

export function migrateMindDocumentToV3(input: unknown): z.infer<typeof mindDocumentV3Schema> {
  return z.union([
    mindDocumentV3Schema,
    mindDocumentV2Schema.transform((document) => migrateV2MindDocumentToV3(document)),
    mindDocumentV1Schema.transform((document) => migrateV2MindDocumentToV3(migrateV1MindDocument(document)))
  ]).parse(input)
}
```

Add v3 types near the existing type exports:

```ts
export type MindNodeType = z.infer<typeof mindNodeTypeSchema>
export type NodeShellStyle = z.infer<typeof nodeShellStyleSchema>
export type TopicContentStyle = z.infer<typeof topicContentStyleSchema>
export type ImageContentStyle = z.infer<typeof imageContentStyleSchema>
export type LinkContentStyle = z.infer<typeof linkContentStyleSchema>
export type AttachmentContentStyle = z.infer<typeof attachmentContentStyleSchema>
export type CodeContentStyle = z.infer<typeof codeContentStyleSchema>
export type TaskContentStyle = z.infer<typeof taskContentStyleSchema>
export type MindNodeV3 = z.infer<typeof mindNodeV3Schema>
export type MindDocumentV3 = z.infer<typeof mindDocumentV3Schema>
```

Keep `mindDocumentSchema = mindDocumentV2Schema` and `MindDocument = z.infer<typeof mindDocumentV2Schema>` in this task. The next task switches current consumers to v3.

- [ ] **Step 4: Run shared tests and verify they pass**

Run:

```bash
npm run test -w packages/shared
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/document.ts packages/shared/src/document.test.ts
git commit -m "feat(shared): add v3 node document schema"
```

---

### Task 2: Switch Shared Current Document Contract to v3 and Migrate Topic-Only Consumers

**Files:**

- Modify: `packages/shared/src/document.ts`
- Modify: `packages/shared/src/document.test.ts`
- Modify: `packages/mind-engine/src/documentFactory.ts`
- Modify: `packages/mind-engine/src/commands.ts`
- Modify: `packages/mind-engine/src/editorSession/session.ts`
- Modify: `packages/mind-engine/src/editorSession/types.ts`
- Modify: `apps/web/src/features/editor/utils/objectStyles.ts`
- Modify: `apps/web/src/features/editor/components/canvas/TopicNode.vue`
- Modify: `apps/web/src/features/editor/components/inspectors/NodeInspector.vue`
- Modify: `apps/web/src/features/editor/stores/editor.ts`
- Modify: topic fixtures in existing tests that construct `MindDocument`

- [ ] **Step 1: Add failing tests for v3 as the current contract**

In `packages/shared/src/document.test.ts`, update the existing "accepts v2 save document request bodies" test into:

```ts
it('accepts v3 save document request bodies', () => {
  const document = v3Document()
  const parsed = saveDocumentRequestSchema.parse({ document })

  expect(parsed.document).toEqual(mindDocumentV3Schema.parse(document))
})
```

Add this test near the v1 save rejection test:

```ts
it('rejects v2 save document request bodies after the v3 upgrade', () => {
  const result = saveDocumentRequestSchema.safeParse({ document: v2Document() })

  expect(result.success).toBe(false)
})
```

Change the direct migration test assertion:

```ts
expect(migrateMindDocument(v2Document()).version).toBe(3)
```

- [ ] **Step 2: Run shared tests and verify the contract tests fail**

Run:

```bash
npm run test -w packages/shared
```

Expected: FAIL because `mindDocumentSchema` still points to v2 and `migrateMindDocument` still returns v2.

- [ ] **Step 3: Switch current exports to v3**

In `packages/shared/src/document.ts`, replace:

```ts
export const mindDocumentSchema = mindDocumentV2Schema
```

with:

```ts
export const mindDocumentSchema = mindDocumentV3Schema
export const mindNodeSchema = mindNodeV3Schema
```

Replace the migration union with:

```ts
export const migratableMindDocumentSchema = z.union([
  mindDocumentV3Schema,
  mindDocumentV2Schema.transform((document) => migrateV2MindDocumentToV3(document)),
  mindDocumentV1Schema.transform((document) => migrateV2MindDocumentToV3(migrateV1MindDocument(document)))
])

export function migrateMindDocument(input: unknown): MindDocument {
  return migratableMindDocumentSchema.parse(input)
}
```

Replace the current type export:

```ts
export type MindDocument = z.infer<typeof mindDocumentV3Schema>
export type MindNode = z.infer<typeof mindNodeV3Schema>
export type MindDocumentV2 = z.infer<typeof mindDocumentV2Schema>
```

Keep `MindDocumentV1` exported.

- [ ] **Step 4: Update topic-only engine creation and commands**

In `packages/mind-engine/src/documentFactory.ts`, change the created document version:

```ts
export function createEmptyDocument(input: CreateDocumentInput): MindDocument {
  return {
    version: 3,
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

In `packages/mind-engine/src/commands.ts`, replace topic style imports:

```ts
import {
  DEFAULT_EDGE_STYLE,
  DEFAULT_NODE_SHELL_STYLE,
  DEFAULT_NODE_SIZE_BY_TYPE,
  DEFAULT_TOPIC_CONTENT_STYLE,
  createDefaultEdgeStyle,
  mindDocumentSchema,
  type EdgeStyle,
  type MindDocument,
  type NodeShellStyle,
  type Point,
  type TopicContentStyle
} from '@mind-x/shared'
```

Replace the current topic-style key set with:

```ts
const NODE_SHELL_STYLE_KEYS = new Set(Object.keys(DEFAULT_NODE_SHELL_STYLE))
const TOPIC_CONTENT_STYLE_KEYS = new Set(Object.keys(DEFAULT_TOPIC_CONTENT_STYLE))
```

Replace `assertKnownTopicStylePatchKeys` with:

```ts
function assertKnownNodeShellStylePatchKeys(stylePatch: Partial<NodeShellStyle>): void {
  assertKnownKeys(stylePatch, NODE_SHELL_STYLE_KEYS, 'node shell')
}

function assertKnownTopicContentStylePatchKeys(stylePatch: Partial<TopicContentStyle>): void {
  assertKnownKeys(stylePatch, TOPIC_CONTENT_STYLE_KEYS, 'topic content')
}
```

Update `addRootNodeCommand` topic push:

```ts
draft.nodes.push({
  id: input.id,
  type: 'topic',
  position: { x: 0, y: 0 },
  size: DEFAULT_NODE_SIZE_BY_TYPE.topic,
  shellStyle: { ...DEFAULT_NODE_SHELL_STYLE },
  data: { title: input.title },
  contentStyle: { ...DEFAULT_TOPIC_CONTENT_STYLE }
})
```

Update `addChildNodeCommand` topic push:

```ts
draft.nodes.push({
  id: input.id,
  type: 'topic',
  position,
  size: DEFAULT_NODE_SIZE_BY_TYPE.topic,
  shellStyle: { ...DEFAULT_NODE_SHELL_STYLE },
  data: { title: input.title },
  contentStyle: { ...DEFAULT_TOPIC_CONTENT_STYLE }
})
```

Replace `setNodeStyleCommand` with a shell-style command:

```ts
export type SetNodeShellStyleInput = {
  nodeId: string
  stylePatch: Partial<NodeShellStyle>
}

export function setNodeShellStyleCommand(draft: Draft<MindDocument>, input: SetNodeShellStyleInput): void {
  const node = findNode(asDocument(draft), input.nodeId)
  if (!node) {
    throw new Error(`Node ${input.nodeId} does not exist`)
  }
  assertKnownNodeShellStylePatchKeys(input.stylePatch)

  node.shellStyle = {
    ...node.shellStyle,
    ...input.stylePatch
  }
  assertMindTree(asDocument(draft))
}
```

Add a compatibility export so existing callers can be migrated one file at a time:

```ts
export const setNodeStyleCommand = setNodeShellStyleCommand
export type SetNodeStyleInput = SetNodeShellStyleInput
```

- [ ] **Step 5: Update web topic rendering to v3 fields**

In `apps/web/src/features/editor/utils/objectStyles.ts`, rename the topic style helpers:

```ts
import type { EdgeStyle, NodeShellStyle, ObjectColorToken, TopicContentStyle } from '@mind-x/shared'
```

Add these helpers while keeping edge helpers unchanged:

```ts
export function resolveNodeShellClass(style: NodeShellStyle): string[] {
  return [
    `topic-node--tone-${style.tone}`,
    `topic-node--shape-${style.shape}`,
    `topic-node--border-${style.borderStyle}`,
    `topic-node--shadow-${style.shadowLevel}`
  ]
}

export function resolveNodeShellStyle(style: NodeShellStyle): CssVariableStyle {
  const palette = TOPIC_PALETTE[style.colorToken]
  const solid = style.tone === 'solid'

  return {
    '--object-border': palette.border,
    '--object-fill': solid ? palette.solidFill : palette.softFill,
    '--object-text': solid ? '#ffffff' : palette.text
  }
}

export function resolveTopicContentClass(style: TopicContentStyle): string[] {
  return [`topic-node--weight-${style.textWeight}`]
}
```

Keep compatibility aliases during this task:

```ts
export const resolveTopicNodeClass = resolveNodeShellClass
export const resolveTopicNodeStyle = resolveNodeShellStyle
```

In `TopicNode.vue`, update the computed classes and styles:

```ts
const nodeStyle = computed(() => ({
  ...resolveTopicNodeStyle(props.node.shellStyle),
  height: `${props.node.size.height}px`,
  transform: `translate(${props.node.position.x}px, ${props.node.position.y}px)`,
  width: `${props.node.size.width}px`
}))

const nodeClass = computed(() => [
  ...resolveTopicNodeClass(props.node.shellStyle),
  ...resolveTopicContentClass(props.node.contentStyle),
  { 'topic-node--selected': props.selected }
])
```

Remove CSS rules for `topic-node--size-sm`, `topic-node--size-md`, and `topic-node--size-lg` because explicit node size now controls dimensions.

- [ ] **Step 6: Update tests and run package checks**

Update test fixtures that use topic nodes from:

```ts
{
  id: 'root',
  type: 'topic',
  position: { x: 0, y: 0 },
  data: { title: 'Root' },
  style: DEFAULT_TOPIC_STYLE
}
```

to:

```ts
{
  id: 'root',
  type: 'topic',
  position: { x: 0, y: 0 },
  size: DEFAULT_NODE_SIZE_BY_TYPE.topic,
  shellStyle: DEFAULT_NODE_SHELL_STYLE,
  data: { title: 'Root' },
  contentStyle: DEFAULT_TOPIC_CONTENT_STYLE
}
```

Run:

```bash
npm run test -w packages/shared
npm run test -w packages/mind-engine
npm run test -w apps/web
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/shared packages/mind-engine apps/web
git commit -m "feat: switch current mind document to v3 topics"
```

---

### Task 3: Add Generic Node Defaults and Engine Commands for All Node Types

**Files:**

- Modify: `packages/mind-engine/src/commands.ts`
- Modify: `packages/mind-engine/src/editorSession/types.ts`
- Modify: `packages/mind-engine/src/editorSession/session.ts`
- Modify: `packages/mind-engine/src/editorSession/state.ts`
- Modify: `packages/mind-engine/src/index.ts`
- Modify: `packages/mind-engine/src/__tests__/commands.test.ts`
- Modify: `packages/mind-engine/src/__tests__/editorSession.test.ts`
- Modify: `apps/web/src/features/editor/stores/editor.ts`
- Modify: `apps/web/src/features/editor/__tests__/editor.store.test.ts`

- [ ] **Step 1: Write failing generic command tests**

In `packages/mind-engine/src/__tests__/commands.test.ts`, add imports:

```ts
import {
  DEFAULT_ATTACHMENT_CONTENT_STYLE,
  DEFAULT_CODE_CONTENT_STYLE,
  DEFAULT_IMAGE_CONTENT_STYLE,
  DEFAULT_LINK_CONTENT_STYLE,
  DEFAULT_NODE_SHELL_STYLE,
  DEFAULT_NODE_SIZE_BY_TYPE,
  DEFAULT_TASK_CONTENT_STYLE,
  DEFAULT_TOPIC_CONTENT_STYLE,
  type MindNodeType
} from '@mind-x/shared'
```

Add this test:

```ts
it('adds every node type as a child and keeps graph rules type-agnostic', () => {
  const doc = addRootNode(createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-29T00:00:00.000Z' }), {
    id: 'root',
    type: 'image',
    data: { url: 'https://example.com/root.png' }
  })

  const types: MindNodeType[] = ['topic', 'image', 'link', 'attachment', 'code', 'task']
  const result = types.reduce((current, type, index) => {
    return addChildNode(current, {
      parentId: index === 0 ? 'root' : `node-${index - 1}`,
      id: `node-${index}`,
      type,
      data:
        type === 'topic'
          ? { title: 'Topic child' }
          : type === 'image'
            ? { url: 'https://example.com/image.png' }
            : type === 'link'
              ? { title: 'Link child', url: 'https://example.com/link' }
              : type === 'attachment'
                ? { fileName: 'brief.pdf', url: 'https://example.com/brief.pdf' }
                : type === 'code'
                  ? { code: 'const x = 1' }
                  : { items: [{ id: 'task-1', title: 'Task child', done: false }] }
    })
  }, doc)

  expect(result.nodes.map((node) => node.type)).toEqual(['image', 'topic', 'image', 'link', 'attachment', 'code', 'task'])
  expect(getParentId(result, 'node-5')).toBe('node-4')
})
```

Add this test:

```ts
it('updates node data and content styles as undoable patches', () => {
  const doc = addRootNode(createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-29T00:00:00.000Z' }), {
    id: 'code',
    type: 'code',
    data: { code: 'let a = 1' }
  })

  const edited = executeCommand(doc, updateNodeDataCommand, {
    nodeId: 'code',
    dataPatch: { code: 'const a = 2' }
  })
  const styled = executeCommand(edited.document, setNodeContentStyleCommand, {
    nodeId: 'code',
    stylePatch: { wrap: false }
  })

  expect(styled.document.nodes[0]).toMatchObject({
    data: { code: 'const a = 2' },
    contentStyle: { wrap: false }
  })
  expect(applyPatches(styled.document, styled.inversePatches)).toEqual(edited.document)
})
```

- [ ] **Step 2: Run engine tests and verify missing command failures**

Run:

```bash
npm run test -w packages/mind-engine
```

Expected: FAIL with missing exports such as `addRootNode`, `updateNodeDataCommand`, or `setNodeContentStyleCommand`.

- [ ] **Step 3: Add default data helpers and generic add commands**

In `packages/mind-engine/src/commands.ts`, update imports:

```ts
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
  createDefaultEdgeStyle,
  mindDocumentSchema,
  mindNodeSchema,
  type AttachmentContentStyle,
  type CodeContentStyle,
  type EdgeStyle,
  type ImageContentStyle,
  type LinkContentStyle,
  type MindDocument,
  type MindNode,
  type MindNodeType,
  type NodeShellStyle,
  type Point,
  type TaskContentStyle,
  type TopicContentStyle
} from '@mind-x/shared'
```

Add these types near the existing add input types:

```ts
type NodeDataByType = {
  attachment: Extract<MindNode, { type: 'attachment' }>['data']
  code: Extract<MindNode, { type: 'code' }>['data']
  image: Extract<MindNode, { type: 'image' }>['data']
  link: Extract<MindNode, { type: 'link' }>['data']
  task: Extract<MindNode, { type: 'task' }>['data']
  topic: Extract<MindNode, { type: 'topic' }>['data']
}

type NodeContentStyleByType = {
  attachment: AttachmentContentStyle
  code: CodeContentStyle
  image: ImageContentStyle
  link: LinkContentStyle
  task: TaskContentStyle
  topic: TopicContentStyle
}

export type AddNodeInput<TType extends MindNodeType = MindNodeType> = {
  id: string
  type: TType
  data?: Partial<NodeDataByType[TType]>
}

export type AddChildMindNodeInput<TType extends MindNodeType = MindNodeType> = AddNodeInput<TType> & {
  parentId: string
}
```

Add default helpers:

```ts
function defaultNodeData(type: MindNodeType): NodeDataByType[MindNodeType] {
  if (type === 'topic') {
    return { title: 'New topic' }
  }
  if (type === 'image') {
    return { url: 'https://example.com/image.png' }
  }
  if (type === 'link') {
    return { title: 'New link', url: 'https://example.com' }
  }
  if (type === 'attachment') {
    return { fileName: 'attachment.pdf', url: 'https://example.com/attachment.pdf' }
  }
  if (type === 'code') {
    return { code: '' }
  }
  return { items: [{ id: 'task-1', title: 'New task', done: false }] }
}

function defaultContentStyle(type: MindNodeType): NodeContentStyleByType[MindNodeType] {
  if (type === 'topic') {
    return { ...DEFAULT_TOPIC_CONTENT_STYLE }
  }
  if (type === 'image') {
    return { ...DEFAULT_IMAGE_CONTENT_STYLE }
  }
  if (type === 'link') {
    return { ...DEFAULT_LINK_CONTENT_STYLE }
  }
  if (type === 'attachment') {
    return { ...DEFAULT_ATTACHMENT_CONTENT_STYLE }
  }
  if (type === 'code') {
    return { ...DEFAULT_CODE_CONTENT_STYLE }
  }
  return { ...DEFAULT_TASK_CONTENT_STYLE }
}

function createNode(input: AddNodeInput & { position: Point }): MindNode {
  const data = {
    ...defaultNodeData(input.type),
    ...(input.data ?? {})
  }

  return mindNodeSchema.parse({
    id: input.id,
    type: input.type,
    position: input.position,
    size: DEFAULT_NODE_SIZE_BY_TYPE[input.type],
    shellStyle: { ...DEFAULT_NODE_SHELL_STYLE },
    data,
    contentStyle: defaultContentStyle(input.type)
  })
}
```

Use the first option when it typechecks.

- [ ] **Step 4: Implement generic add/update commands**

Replace `addRootNodeCommand` and `addChildNodeCommand` internals so topic wrappers delegate to generic commands:

```ts
export function addRootMindNodeCommand(draft: Draft<MindDocument>, input: AddNodeInput): void {
  if (input.id.trim().length === 0) {
    throw new Error('Node id must be non-empty')
  }
  if (draft.nodes.length > 0) {
    throw new Error('Root node already exists')
  }
  if (findNode(asDocument(draft), input.id)) {
    throw new Error(`Node ${input.id} already exists`)
  }

  draft.nodes.push(createNode({ ...input, position: { x: 0, y: 0 } }) as Draft<MindNode>)
  assertMindTree(asDocument(draft))
}

export function addChildMindNodeCommand(draft: Draft<MindDocument>, input: AddChildMindNodeInput): void {
  if (input.id.trim().length === 0) {
    throw new Error('Node id must be non-empty')
  }
  if (findNode(asDocument(draft), input.id)) {
    throw new Error(`Node ${input.id} already exists`)
  }
  const parent = findNode(asDocument(draft), input.parentId)
  if (!parent) {
    throw new Error(`Parent node ${input.parentId} does not exist`)
  }

  const childCount = getChildIds(asDocument(draft), input.parentId).length
  const position = {
    x: parent.position.x + parent.size.width + CHILD_GAP_X,
    y: parent.position.y + childCount * SIBLING_GAP_Y
  }
  draft.nodes.push(createNode({ ...input, position }) as Draft<MindNode>)
  draft.edges.push(createParentEdge(input.parentId, input.id))
  assertMindTree(asDocument(draft))
}

export function addRootNode(document: MindDocument, input: AddNodeInput): MindDocument {
  return executeCommand(document, addRootMindNodeCommand, input).document
}

export function addChildNode(document: MindDocument, input: AddChildMindNodeInput): MindDocument {
  return executeCommand(document, addChildMindNodeCommand, input).document
}
```

Keep topic compatibility command signatures:

```ts
export function addRootNodeCommand(draft: Draft<MindDocument>, input: AddRootNodeInput): void {
  addRootMindNodeCommand(draft, { id: input.id, type: 'topic', data: { title: input.title } })
}

export function addChildNodeCommand(draft: Draft<MindDocument>, input: AddChildNodeInput): void {
  addChildMindNodeCommand(draft, {
    parentId: input.parentId,
    id: input.id,
    type: 'topic',
    data: { title: input.title }
  })
}
```

Add update commands:

```ts
export type UpdateNodeDataInput = {
  nodeId: string
  dataPatch: Record<string, unknown>
}

export function updateNodeDataCommand(draft: Draft<MindDocument>, input: UpdateNodeDataInput): void {
  const node = findNode(asDocument(draft), input.nodeId)
  if (!node) {
    throw new Error(`Node ${input.nodeId} does not exist`)
  }

  node.data = {
    ...node.data,
    ...input.dataPatch
  } as Draft<MindNode>['data']
  assertMindTree(asDocument(draft))
}

export type SetNodeContentStyleInput = {
  nodeId: string
  stylePatch: Record<string, unknown>
}

export function setNodeContentStyleCommand(draft: Draft<MindDocument>, input: SetNodeContentStyleInput): void {
  const node = findNode(asDocument(draft), input.nodeId)
  if (!node) {
    throw new Error(`Node ${input.nodeId} does not exist`)
  }

  node.contentStyle = {
    ...node.contentStyle,
    ...input.stylePatch
  } as Draft<MindNode>['contentStyle']
  assertMindTree(asDocument(draft))
}
```

The final `mindDocumentSchema.parse(result.document)` inside `executeCommand` rejects type-incompatible patches and unknown keys.

- [ ] **Step 5: Add session and store generic actions**

In `packages/mind-engine/src/editorSession/types.ts`, add:

```ts
import type { EdgeStyle, MindDocument, MindNodeType, NodeShellStyle, Point, TopicContentStyle, Viewport } from '@mind-x/shared'

export type AddMindNodeInput = { id?: string; type: MindNodeType; data?: Record<string, unknown> }
export type AddChildMindNodeSessionInput = AddMindNodeInput & { parentId?: string }
```

Add methods to `EditorSession`:

```ts
addRootNode(input: AddMindNodeInput): string | null
addChildNode(input: AddChildMindNodeSessionInput): string | null
updateNodeData(nodeId: string, dataPatch: Record<string, unknown>): void
setSelectedNodeShellStyle(stylePatch: Partial<NodeShellStyle>): void
setSelectedNodeContentStyle(stylePatch: Record<string, unknown>): void
```

In `session.ts`, implement `addRootNode` and `addChildNode` with internal helper functions so method calls do not depend on a `this` binding. Use this shape for root creation:

```ts
function addRootNodeThroughSession(input: AddMindNodeInput): string | null {
  if (!state.document || state.document.nodes.length > 0) {
    return null
  }

  finalizePendingPreview()
  const id = input.id ?? createNodeId(state.document)
  const result = executeCommand(cloneDocument(state.document), addRootMindNodeCommand, {
    id,
    type: input.type,
    data: input.data
  })
  setState((draft) => {
    draft.selectedNodeIds = [id]
    draft.selectedEdgeId = null
  })
  commitCommandResult(result)
  return id
}
```

Return both generic and topic methods:

```ts
addRootNode: addRootNodeThroughSession,
addRootTopic(input: AddTopicInput = {}) {
  return addRootNodeThroughSession({ id: input.id, type: 'topic', data: { title: input.title ?? DEFAULT_TOPIC_TITLE } })
}
```

In `apps/web/src/features/editor/stores/editor.ts`, expose matching methods:

```ts
function addRootNode(input: AddMindNodeInput): string | null {
  const id = session.addRootNode(input)
  syncFromSession()
  return id
}

function addChildNode(input: AddChildMindNodeSessionInput): string | null {
  const id = session.addChildNode(input)
  syncFromSession()
  return id
}

function updateNodeData(nodeId: string, dataPatch: Record<string, unknown>): void {
  session.updateNodeData(nodeId, dataPatch)
  syncFromSession()
}
```

- [ ] **Step 6: Run engine and web store tests**

Run:

```bash
npm run test -w packages/mind-engine
npm run test -w apps/web -- src/features/editor/__tests__/editor.store.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/mind-engine apps/web/src/features/editor/stores/editor.ts apps/web/src/features/editor/__tests__/editor.store.test.ts
git commit -m "feat(engine): add generic node commands"
```

---

### Task 4: Add Resize Command, Session Preview, and Export Bounds Update

**Files:**

- Modify: `packages/mind-engine/src/commands.ts`
- Modify: `packages/mind-engine/src/editorSession/types.ts`
- Modify: `packages/mind-engine/src/editorSession/session.ts`
- Modify: `packages/mind-engine/src/__tests__/commands.test.ts`
- Modify: `packages/mind-engine/src/__tests__/editorSession.test.ts`
- Modify: `apps/web/src/features/editor/stores/editor.ts`
- Modify: `apps/web/src/features/editor/services/exportPng.ts`
- Modify: `apps/web/src/features/editor/__tests__/exportPng.test.ts`

- [ ] **Step 1: Add failing resize tests**

In `packages/mind-engine/src/__tests__/commands.test.ts`, add:

```ts
it('resizes nodes with minimum dimensions', () => {
  const doc = addRootNode(createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-29T00:00:00.000Z' }), {
    id: 'root',
    type: 'topic',
    data: { title: 'Root' }
  })

  const result = executeCommand(doc, resizeNodesCommand, {
    nodeIds: ['root'],
    delta: { width: 40, height: 20 }
  })

  expect(result.document.nodes[0].size).toEqual({ width: 220, height: 76 })
})
```

In `packages/mind-engine/src/__tests__/editorSession.test.ts`, add:

```ts
it('previews repeated resize as one undoable history entry', () => {
  const session = createEditorSession()
  session.load(documentWithRoot())
  session.selectOnly('root')

  session.previewResizeSelectedByDelta({ width: 20, height: 10 })
  session.previewResizeSelectedByDelta({ width: 20, height: 10 })

  expect(session.getState().document?.nodes[0].size).toEqual({ width: 220, height: 76 })
  expect(session.getState().canUndo).toBe(false)

  session.finishInteraction()

  expect(session.getState().canUndo).toBe(true)
  session.undo()
  expect(session.getState().document?.nodes[0].size).toEqual({ width: 180, height: 56 })
})
```

- [ ] **Step 2: Run engine tests and verify failures**

Run:

```bash
npm run test -w packages/mind-engine
```

Expected: FAIL with missing `resizeNodesCommand` and `previewResizeSelectedByDelta`.

- [ ] **Step 3: Implement resize command**

In `packages/mind-engine/src/commands.ts`, add:

```ts
const MIN_NODE_WIDTH = 120
const MIN_NODE_HEIGHT = 44

export type ResizeNodesInput = {
  nodeIds: string[]
  delta: { width: number; height: number }
}

export function resizeNodesCommand(draft: Draft<MindDocument>, input: ResizeNodesInput): void {
  const selected = new Set(input.nodeIds)
  for (const node of draft.nodes) {
    if (selected.has(node.id)) {
      node.size = {
        width: Math.max(MIN_NODE_WIDTH, node.size.width + input.delta.width),
        height: Math.max(MIN_NODE_HEIGHT, node.size.height + input.delta.height)
      }
    }
  }
  assertMindTree(asDocument(draft))
}

export function resizeNodes(document: MindDocument, input: ResizeNodesInput): MindDocument {
  return executeCommand(document, resizeNodesCommand, input).document
}
```

- [ ] **Step 4: Implement session preview and store wrappers**

In `packages/mind-engine/src/editorSession/types.ts`, add:

```ts
previewResizeSelectedByDelta(delta: { width: number; height: number }): void
resizeSelectedByDelta(delta: { width: number; height: number }): void
```

In `session.ts`, mirror the move preview implementation:

```ts
function resizeSelectedByDelta(delta: { width: number; height: number }): void {
  if (!state.document || state.selectedNodeIds.length === 0 || (delta.width === 0 && delta.height === 0)) {
    return
  }

  finalizePendingPreview()
  commitCommandResult(
    executeCommand(cloneDocument(state.document), resizeNodesCommand, {
      nodeIds: state.selectedNodeIds,
      delta
    })
  )
}

function previewResizeSelectedByDelta(delta: { width: number; height: number }): void {
  if (!state.document || state.selectedNodeIds.length === 0 || (delta.width === 0 && delta.height === 0)) {
    return
  }

  if (!pendingPreviewBaseline) {
    pendingPreviewBaseline = preserveUntrackedDocumentState(history?.current() ?? state.document, state.document)
  }

  syncAfterDocumentChange(resizeNodes(cloneDocument(state.document), { nodeIds: state.selectedNodeIds, delta }))
}
```

Return both methods from the session object.

In the store, add:

```ts
function previewResizeSelectedByDelta(delta: { width: number; height: number }): void {
  session.previewResizeSelectedByDelta(delta)
  syncFromSession()
}

function resizeSelectedByDelta(delta: { width: number; height: number }): void {
  session.resizeSelectedByDelta(delta)
  syncFromSession()
}
```

- [ ] **Step 5: Update PNG export bounds to require v3 size**

In `apps/web/src/features/editor/services/exportPng.ts`, remove fallback constants and replace helper functions:

```ts
function nodeWidth(node: MindNode): number {
  return node.size.width
}

function nodeHeight(node: MindNode): number {
  return node.size.height
}
```

Update `exportPng.test.ts` fixture documents to v3. Replace the fallback test name with:

```ts
it('calculates document bounds from explicit v3 node sizes and padding', async () => {
```

Use explicit `size` on every node in that test.

- [ ] **Step 6: Run tests**

Run:

```bash
npm run test -w packages/mind-engine
npm run test -w apps/web -- src/features/editor/__tests__/exportPng.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/mind-engine apps/web/src/features/editor/stores/editor.ts apps/web/src/features/editor/services/exportPng.ts apps/web/src/features/editor/__tests__/exportPng.test.ts
git commit -m "feat(editor): add node resize history"
```

---

### Task 5: Replace TopicNode with BaseNode and TopicNodeContent

**Files:**

- Create: `apps/web/src/features/editor/components/canvas/BaseNode.vue`
- Create: `apps/web/src/features/editor/components/canvas/node-content/TopicNodeContent.vue`
- Modify: `apps/web/src/features/editor/components/canvas/NodeRenderer.vue`
- Modify: `apps/web/src/features/editor/components/MindEditor.vue`
- Modify: `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`
- Modify: `apps/web/src/features/editor/__tests__/baseNode.test.ts`
- Delete: `apps/web/src/features/editor/components/canvas/TopicNode.vue`

- [ ] **Step 1: Add source-level tests for renderer and shell structure**

Create `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readNodeRenderer(): string {
  return readFileSync(new URL('../components/canvas/NodeRenderer.vue', import.meta.url), 'utf8')
}

describe('NodeRenderer', () => {
  it('wraps node content with the shared BaseNode shell', () => {
    const source = readNodeRenderer()

    expect(source).toContain("import BaseNode from './BaseNode.vue'")
    expect(source).toContain('const contentComponentByType')
    expect(source).toContain('<BaseNode')
    expect(source).toContain('<component')
    expect(source).not.toContain("import TopicNode from './TopicNode.vue'")
  })
})
```

Create `apps/web/src/features/editor/__tests__/baseNode.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readBaseNode(): string {
  return readFileSync(new URL('../components/canvas/BaseNode.vue', import.meta.url), 'utf8')
}

describe('BaseNode', () => {
  it('owns edit-mode gating and resize handles', () => {
    const source = readBaseNode()

    expect(source).toContain('data-editor-node')
    expect(source).toContain('@dblclick.stop="startEditing"')
    expect(source).toContain('base-node__content--blocked')
    expect(source).toContain('base-node__resize-handle')
    expect(source).toContain("emit('resize'")
  })
})
```

- [ ] **Step 2: Run web tests and verify failures**

Run:

```bash
npm run test -w apps/web -- src/features/editor/__tests__/nodeRenderer.test.ts src/features/editor/__tests__/baseNode.test.ts
```

Expected: FAIL because `BaseNode.vue` does not exist and `NodeRenderer` imports `TopicNode`.

- [ ] **Step 3: Create TopicNodeContent**

Create `apps/web/src/features/editor/components/canvas/node-content/TopicNodeContent.vue`:

```vue
<script setup lang="ts">
import type { MindNode } from '@mind-x/shared'
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps<{
  editing: boolean
  node: Extract<MindNode, { type: 'topic' }>
}>()

const emit = defineEmits<{
  commit: [dataPatch: { title: string }]
  cancel: []
}>()

const draftTitle = ref(props.node.data.title)
const editError = ref('')
const titleInputRef = ref<HTMLInputElement | null>(null)

const title = computed(() => props.node.data.title)

watch(
  () => props.editing,
  async (editing) => {
    if (editing) {
      draftTitle.value = props.node.data.title
      editError.value = ''
      await nextTick()
      titleInputRef.value?.focus()
      titleInputRef.value?.select()
    }
  }
)

watch(
  () => props.node.data.title,
  (nextTitle) => {
    if (!props.editing) {
      draftTitle.value = nextTitle
    }
  }
)

function validateTitle(value: string): string {
  if (value.length === 0 || /[<>]/.test(value)) {
    return 'Use non-empty plain text.'
  }
  return ''
}

async function commitEdit(): Promise<void> {
  const nextTitle = draftTitle.value.trim()
  const error = validateTitle(nextTitle)
  if (error) {
    editError.value = error
    await nextTick()
    titleInputRef.value?.focus()
    return
  }

  emit('commit', { title: nextTitle })
}
</script>

<template>
  <template v-if="editing">
    <input
      ref="titleInputRef"
      v-model="draftTitle"
      :aria-invalid="editError.length > 0"
      class="topic-node-content__input"
      maxlength="120"
      @blur="commitEdit"
      @input="editError = ''"
      @keydown.enter.prevent="commitEdit"
      @keydown.esc.prevent="emit('cancel')"
      @pointerdown.stop
    />
    <span v-if="editError" class="topic-node-content__error">{{ editError }}</span>
  </template>
  <span v-else class="topic-node-content__title">{{ title }}</span>
</template>

<style scoped>
.topic-node-content__title {
  display: block;
  width: 100%;
  overflow: hidden;
  font-size: 14px;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topic-node-content__input {
  width: 100%;
  min-width: 0;
  padding: 2px 0;
  border: 0;
  outline: 0;
  color: inherit;
  font-size: 14px;
}

.topic-node-content__error {
  align-self: stretch;
  overflow: hidden;
  color: var(--color-danger);
  font-size: 11px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
```

- [ ] **Step 4: Create BaseNode**

Create `apps/web/src/features/editor/components/canvas/BaseNode.vue`:

```vue
<script setup lang="ts">
import type { MindNode, Point } from '@mind-x/shared'
import { computed, ref } from 'vue'
import { resolveNodeShellClass, resolveNodeShellStyle, resolveTopicContentClass } from '../../utils/objectStyles'

const props = defineProps<{
  node: MindNode
  selected: boolean
}>()

const emit = defineEmits<{
  cancelEdit: []
  drag: [nodeId: string, delta: Point]
  dragEnd: []
  editCommit: [nodeId: string, dataPatch: Record<string, unknown>]
  resize: [nodeId: string, delta: { width: number; height: number }]
  resizeEnd: []
  select: [nodeId: string]
}>()

const editing = ref(false)
const draggingPointerId = ref<number | null>(null)
const resizingPointerId = ref<number | null>(null)
const lastPointer = ref<Point | null>(null)

const nodeStyle = computed(() => ({
  ...resolveNodeShellStyle(props.node.shellStyle),
  height: `${props.node.size.height}px`,
  transform: `translate(${props.node.position.x}px, ${props.node.position.y}px)`,
  width: `${props.node.size.width}px`
}))

const nodeClass = computed(() => [
  ...resolveNodeShellClass(props.node.shellStyle),
  ...(props.node.type === 'topic' ? resolveTopicContentClass(props.node.contentStyle) : []),
  {
    'base-node--editing': editing.value,
    'base-node--selected': props.selected
  }
])

function startEditing(): void {
  editing.value = true
  emit('select', props.node.id)
}

function commitEdit(dataPatch: Record<string, unknown>): void {
  emit('editCommit', props.node.id, dataPatch)
  editing.value = false
}

function cancelEdit(): void {
  editing.value = false
  emit('cancelEdit')
}

function beginPointerInteraction(event: PointerEvent, mode: 'drag' | 'resize'): void {
  event.stopPropagation()
  emit('select', props.node.id)
  lastPointer.value = { x: event.clientX, y: event.clientY }
  if (mode === 'drag') {
    draggingPointerId.value = event.pointerId
  } else {
    resizingPointerId.value = event.pointerId
  }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onPointerDown(event: PointerEvent): void {
  if (editing.value) {
    return
  }
  beginPointerInteraction(event, 'drag')
}

function onResizePointerDown(event: PointerEvent): void {
  beginPointerInteraction(event, 'resize')
}

function onPointerMove(event: PointerEvent): void {
  if (!lastPointer.value) {
    return
  }

  const nextPointer = { x: event.clientX, y: event.clientY }
  const delta = {
    x: nextPointer.x - lastPointer.value.x,
    y: nextPointer.y - lastPointer.value.y
  }

  if (draggingPointerId.value === event.pointerId) {
    event.stopPropagation()
    emit('drag', props.node.id, delta)
    lastPointer.value = nextPointer
    return
  }

  if (resizingPointerId.value === event.pointerId) {
    event.stopPropagation()
    emit('resize', props.node.id, { width: delta.x, height: delta.y })
    lastPointer.value = nextPointer
  }
}

function endPointerInteraction(event: PointerEvent): void {
  if (draggingPointerId.value === event.pointerId) {
    event.stopPropagation()
    draggingPointerId.value = null
    lastPointer.value = null
    emit('dragEnd')
    return
  }

  if (resizingPointerId.value === event.pointerId) {
    event.stopPropagation()
    resizingPointerId.value = null
    lastPointer.value = null
    emit('resizeEnd')
  }
}
</script>

<template>
  <div
    class="base-node"
    data-editor-node
    :data-editor-node-id="node.id"
    :class="nodeClass"
    :style="nodeStyle"
    @dblclick.stop="startEditing"
    @pointercancel="endPointerInteraction"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="endPointerInteraction"
  >
    <div
      class="base-node__content"
      :class="{ 'base-node__content--blocked': !editing }"
      @click.stop
      @keydown.stop
      @pointerdown.stop
    >
      <slot :editing="editing" :commit="commitEdit" :cancel="cancelEdit" />
    </div>
    <button
      v-if="selected"
      aria-label="Resize node"
      class="base-node__resize-handle"
      data-editor-control
      type="button"
      @pointerdown.stop.prevent="onResizePointerDown"
    />
  </div>
</template>

<style scoped>
.base-node {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  min-width: 120px;
  min-height: 44px;
  padding: 10px 14px;
  border: 1px solid var(--object-border);
  border-radius: 8px;
  background: var(--object-fill);
  box-shadow: var(--shadow-node);
  color: var(--object-text);
  cursor: grab;
  user-select: none;
}

.base-node:active {
  cursor: grabbing;
}

.base-node--editing {
  cursor: text;
}

.base-node--tone-outline {
  background: var(--color-surface);
}

.base-node--shape-rectangle {
  border-radius: 2px;
}

.base-node--shape-rounded {
  border-radius: 8px;
}

.base-node--shape-pill {
  border-radius: 999px;
}

.base-node--border-none {
  border-color: transparent;
}

.base-node--border-dashed {
  border-style: dashed;
}

.base-node--shadow-none {
  box-shadow: none;
}

.base-node--shadow-sm {
  box-shadow: var(--shadow-node);
}

.base-node--shadow-md {
  box-shadow: 0 10px 26px rgb(15 23 42 / 14%);
}

.base-node--selected {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-node-selected);
}

.base-node__content {
  display: grid;
  min-width: 0;
  min-height: 0;
}

.base-node__content--blocked {
  pointer-events: none;
}

.base-node__resize-handle {
  position: absolute;
  right: -5px;
  bottom: -5px;
  width: 12px;
  height: 12px;
  padding: 0;
  border: 2px solid var(--color-primary);
  border-radius: 50%;
  background: var(--color-surface);
  cursor: nwse-resize;
}

.base-node--weight-regular :deep(.topic-node-content__title),
.base-node--weight-regular :deep(.topic-node-content__input) {
  font-weight: 400;
}

.base-node--weight-medium :deep(.topic-node-content__title),
.base-node--weight-medium :deep(.topic-node-content__input) {
  font-weight: 650;
}

.base-node--weight-bold :deep(.topic-node-content__title),
.base-node--weight-bold :deep(.topic-node-content__input) {
  font-weight: 750;
}
</style>
```

- [ ] **Step 5: Replace NodeRenderer implementation**

Update `apps/web/src/features/editor/components/canvas/NodeRenderer.vue`:

```vue
<script setup lang="ts">
import type { MindNode, Point } from '@mind-x/shared'
import BaseNode from './BaseNode.vue'
import TopicNodeContent from './node-content/TopicNodeContent.vue'

defineProps<{
  nodes: MindNode[]
  selectedNodeIds: string[]
}>()

const emit = defineEmits<{
  drag: [nodeId: string, delta: Point]
  dragEnd: []
  edit: [nodeId: string, dataPatch: Record<string, unknown>]
  resize: [nodeId: string, delta: { width: number; height: number }]
  resizeEnd: []
  select: [nodeId: string]
}>()

const contentComponentByType = {
  attachment: TopicNodeContent,
  code: TopicNodeContent,
  image: TopicNodeContent,
  link: TopicNodeContent,
  task: TopicNodeContent,
  topic: TopicNodeContent
}
</script>

<template>
  <BaseNode
    v-for="node in nodes"
    :key="node.id"
    :node="node"
    :selected="selectedNodeIds.includes(node.id)"
    @drag="(nodeId, delta) => emit('drag', nodeId, delta)"
    @drag-end="emit('dragEnd')"
    @edit-commit="(nodeId, dataPatch) => emit('edit', nodeId, dataPatch)"
    @resize="(nodeId, delta) => emit('resize', nodeId, delta)"
    @resize-end="emit('resizeEnd')"
    @select="emit('select', $event)"
  >
    <template #default="{ editing, commit, cancel }">
      <component
        :is="contentComponentByType[node.type]"
        :editing="editing"
        :node="node"
        @cancel="cancel"
        @commit="commit"
      />
    </template>
  </BaseNode>
</template>
```

This temporarily maps non-topic types to `TopicNodeContent` only to keep the renderer compiling until Task 6 adds real content components. Non-topic nodes are not yet reachable through UI in this task.

Update `MindEditor.vue` renderer events:

```vue
<NodeRenderer
  :nodes="documentState.nodes"
  :selected-node-ids="editor.selectedNodeIds"
  @drag="moveNode"
  @drag-end="editor.finishInteraction"
  @edit="editor.updateNodeData"
  @resize="resizeNode"
  @resize-end="editor.finishInteraction"
  @select="editor.selectOnly"
/>
```

Add:

```ts
function resizeNode(nodeId: string, delta: { width: number; height: number }): void {
  if (!editor.selectedNodeIds.includes(nodeId)) {
    editor.selectOnly(nodeId)
  }
  editor.previewResizeSelectedByDelta(delta)
}
```

- [ ] **Step 6: Delete TopicNode and run tests**

Run:

```bash
git rm apps/web/src/features/editor/components/canvas/TopicNode.vue
npm run test -w apps/web -- src/features/editor/__tests__/nodeRenderer.test.ts src/features/editor/__tests__/baseNode.test.ts
npm run typecheck -w apps/web
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/editor/components/canvas apps/web/src/features/editor/components/MindEditor.vue apps/web/src/features/editor/__tests__/nodeRenderer.test.ts apps/web/src/features/editor/__tests__/baseNode.test.ts
git commit -m "refactor(web): introduce shared node shell"
```

---

### Task 6: Add Type-Specific Content Components and Code Highlighting

**Files:**

- Modify: `apps/web/package.json`
- Modify: `package-lock.json`
- Create: `apps/web/src/features/editor/utils/codeHighlight.ts`
- Create: `apps/web/src/features/editor/__tests__/codeHighlight.test.ts`
- Create: `apps/web/src/features/editor/components/canvas/node-content/ImageNodeContent.vue`
- Create: `apps/web/src/features/editor/components/canvas/node-content/LinkNodeContent.vue`
- Create: `apps/web/src/features/editor/components/canvas/node-content/AttachmentNodeContent.vue`
- Create: `apps/web/src/features/editor/components/canvas/node-content/CodeNodeContent.vue`
- Create: `apps/web/src/features/editor/components/canvas/node-content/TaskNodeContent.vue`
- Modify: `apps/web/src/features/editor/components/canvas/NodeRenderer.vue`

- [ ] **Step 1: Install highlight.js**

Run:

```bash
npm install highlight.js -w apps/web
```

Expected: `apps/web/package.json` and `package-lock.json` include `highlight.js`.

- [ ] **Step 2: Add failing highlighter tests**

Create `apps/web/src/features/editor/__tests__/codeHighlight.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { highlightCode } from '@/features/editor/utils/codeHighlight'

describe('codeHighlight', () => {
  it('auto-detects and highlights registered languages', () => {
    const result = highlightCode('const answer = 42')

    expect(result.html).toContain('hljs')
    expect(result.html).toContain('answer')
    expect(result.language).toBeTypeOf('string')
  })

  it('escapes raw HTML in code input', () => {
    const result = highlightCode('<script>alert(1)</script>')

    expect(result.html).not.toContain('<script>')
    expect(result.html).toContain('&lt;')
  })

  it('returns empty markup for empty code', () => {
    expect(highlightCode('').html).toBe('')
  })
})
```

Run:

```bash
npm run test -w apps/web -- src/features/editor/__tests__/codeHighlight.test.ts
```

Expected: FAIL because `codeHighlight.ts` does not exist.

- [ ] **Step 3: Add highlighter utility**

Create `apps/web/src/features/editor/utils/codeHighlight.ts`:

```ts
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import go from 'highlight.js/lib/languages/go'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import python from 'highlight.js/lib/languages/python'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'

const REGISTERED_LANGUAGES = {
  bash,
  css,
  go,
  java,
  javascript,
  json,
  markdown,
  python,
  typescript,
  xml
} as const

let registered = false

function ensureRegistered(): void {
  if (registered) {
    return
  }

  for (const [name, language] of Object.entries(REGISTERED_LANGUAGES)) {
    hljs.registerLanguage(name, language)
  }
  registered = true
}

export type HighlightedCode = {
  html: string
  language: string | null
}

export function highlightCode(code: string): HighlightedCode {
  if (code.length === 0) {
    return { html: '', language: null }
  }

  ensureRegistered()
  const result = hljs.highlightAuto(code, Object.keys(REGISTERED_LANGUAGES))
  return {
    html: result.value,
    language: result.language ?? null
  }
}
```

- [ ] **Step 4: Create content components**

Create `ImageNodeContent.vue`:

```vue
<script setup lang="ts">
import type { MindNode } from '@mind-x/shared'
import { nextTick, ref, watch } from 'vue'

const props = defineProps<{
  editing: boolean
  node: Extract<MindNode, { type: 'image' }>
}>()

const emit = defineEmits<{
  commit: [dataPatch: { url: string }]
  cancel: []
}>()

const draftUrl = ref(props.node.data.url)
const error = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.editing,
  async (editing) => {
    if (editing) {
      draftUrl.value = props.node.data.url
      error.value = ''
      await nextTick()
      inputRef.value?.focus()
    }
  }
)

function commitEdit(): void {
  try {
    new URL(draftUrl.value)
  } catch {
    error.value = 'Use a valid image URL.'
    return
  }
  emit('commit', { url: draftUrl.value })
}
</script>

<template>
  <div class="image-node-content">
    <template v-if="editing">
      <input
        ref="inputRef"
        v-model="draftUrl"
        class="image-node-content__input"
        @keydown.enter.prevent="commitEdit"
        @keydown.esc.prevent="emit('cancel')"
      />
      <span v-if="error" class="image-node-content__error">{{ error }}</span>
    </template>
    <img v-else class="image-node-content__image" :alt="node.data.alt ?? ''" :src="node.data.url" />
  </div>
</template>

<style scoped>
.image-node-content {
  display: grid;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.image-node-content__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-node-content__input {
  width: 100%;
}

.image-node-content__error {
  color: var(--color-danger);
  font-size: 11px;
}
</style>
```

Create `LinkNodeContent.vue`:

```vue
<script setup lang="ts">
import type { MindNode } from '@mind-x/shared'
import { nextTick, reactive, ref, watch } from 'vue'

const props = defineProps<{
  editing: boolean
  node: Extract<MindNode, { type: 'link' }>
}>()

const emit = defineEmits<{
  commit: [dataPatch: { title: string; url: string }]
  cancel: []
}>()

const draft = reactive({ title: props.node.data.title, url: props.node.data.url })
const error = ref('')
const titleInputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.editing,
  async (editing) => {
    if (editing) {
      draft.title = props.node.data.title
      draft.url = props.node.data.url
      error.value = ''
      await nextTick()
      titleInputRef.value?.focus()
    }
  }
)

function commitEdit(): void {
  if (draft.title.trim().length === 0 || /[<>]/.test(draft.title)) {
    error.value = 'Use a non-empty plain title.'
    return
  }
  try {
    new URL(draft.url)
  } catch {
    error.value = 'Use a valid link URL.'
    return
  }
  emit('commit', { title: draft.title.trim(), url: draft.url })
}
</script>

<template>
  <div class="link-node-content">
    <template v-if="editing">
      <input ref="titleInputRef" v-model="draft.title" class="link-node-content__input" />
      <input v-model="draft.url" class="link-node-content__input" />
      <span v-if="error" class="link-node-content__error">{{ error }}</span>
      <button type="button" @click="commitEdit">Save</button>
      <button type="button" @click="emit('cancel')">Cancel</button>
    </template>
    <a v-else class="link-node-content__title" :href="node.data.url" rel="noreferrer" target="_blank">
      {{ node.data.title }}
    </a>
  </div>
</template>
```

Create `AttachmentNodeContent.vue`:

```vue
<script setup lang="ts">
import type { MindNode } from '@mind-x/shared'
import { nextTick, reactive, ref, watch } from 'vue'

const props = defineProps<{
  editing: boolean
  node: Extract<MindNode, { type: 'attachment' }>
}>()

const emit = defineEmits<{
  commit: [dataPatch: { fileName: string; url: string }]
  cancel: []
}>()

const draft = reactive({ fileName: props.node.data.fileName, url: props.node.data.url })
const error = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.editing,
  async (editing) => {
    if (editing) {
      draft.fileName = props.node.data.fileName
      draft.url = props.node.data.url
      error.value = ''
      await nextTick()
      fileInputRef.value?.focus()
    }
  }
)

function commitEdit(): void {
  if (draft.fileName.trim().length === 0 || /[<>]/.test(draft.fileName)) {
    error.value = 'Use a non-empty plain file name.'
    return
  }
  try {
    new URL(draft.url)
  } catch {
    error.value = 'Use a valid attachment URL.'
    return
  }
  emit('commit', { fileName: draft.fileName.trim(), url: draft.url })
}
</script>

<template>
  <div class="attachment-node-content">
    <template v-if="editing">
      <input ref="fileInputRef" v-model="draft.fileName" class="attachment-node-content__input" />
      <input v-model="draft.url" class="attachment-node-content__input" />
      <span v-if="error" class="attachment-node-content__error">{{ error }}</span>
      <button type="button" @click="commitEdit">Save</button>
      <button type="button" @click="emit('cancel')">Cancel</button>
    </template>
    <a v-else class="attachment-node-content__link" :href="node.data.url" rel="noreferrer" target="_blank">
      {{ node.data.fileName }}
    </a>
  </div>
</template>
```

Create `CodeNodeContent.vue`:

```vue
<script setup lang="ts">
import type { MindNode } from '@mind-x/shared'
import { computed, nextTick, ref, watch } from 'vue'
import { highlightCode } from '../../../utils/codeHighlight'

const props = defineProps<{
  editing: boolean
  node: Extract<MindNode, { type: 'code' }>
}>()

const emit = defineEmits<{
  commit: [dataPatch: { code: string }]
  cancel: []
}>()

const draftCode = ref(props.node.data.code)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const highlighted = computed(() => highlightCode(props.node.data.code))

watch(
  () => props.editing,
  async (editing) => {
    if (editing) {
      draftCode.value = props.node.data.code
      await nextTick()
      textareaRef.value?.focus()
    }
  }
)
</script>

<template>
  <textarea
    v-if="editing"
    ref="textareaRef"
    v-model="draftCode"
    class="code-node-content__editor"
    @keydown.esc.prevent="emit('cancel')"
    @blur="emit('commit', { code: draftCode })"
  />
  <pre v-else class="code-node-content__pre"><code class="hljs" v-html="highlighted.html" /></pre>
</template>
```

Create `TaskNodeContent.vue`:

```vue
<script setup lang="ts">
import type { MindNode } from '@mind-x/shared'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  editing: boolean
  node: Extract<MindNode, { type: 'task' }>
}>()

const emit = defineEmits<{
  commit: [dataPatch: { items: Extract<MindNode, { type: 'task' }>['data']['items'] }]
  cancel: []
}>()

const draftItems = ref(props.node.data.items.map((item) => ({ ...item })))
const visibleItems = computed(() => (props.editing ? draftItems.value : props.node.data.items))

watch(
  () => props.editing,
  (editing) => {
    if (editing) {
      draftItems.value = props.node.data.items.map((item) => ({ ...item }))
    }
  }
)

function commitEdit(): void {
  emit('commit', {
    items: draftItems.value.map((item) => ({
      ...item,
      title: item.title.trim()
    }))
  })
}
</script>

<template>
  <div class="task-node-content">
    <label v-for="(item, index) in visibleItems" :key="item.id" class="task-node-content__item">
      <input
        :checked="item.done"
        :disabled="!editing"
        type="checkbox"
        @change="draftItems[index].done = ($event.target as HTMLInputElement).checked"
      />
      <input
        v-if="editing"
        v-model="draftItems[index].title"
        class="task-node-content__input"
        @keydown.enter.prevent="commitEdit"
        @keydown.esc.prevent="emit('cancel')"
      />
      <span v-else>{{ item.title }}</span>
    </label>
    <button v-if="editing" type="button" @click="commitEdit">Save</button>
  </div>
</template>
```

- [ ] **Step 5: Wire real content components in NodeRenderer**

Update imports and map in `NodeRenderer.vue`:

```ts
import AttachmentNodeContent from './node-content/AttachmentNodeContent.vue'
import CodeNodeContent from './node-content/CodeNodeContent.vue'
import ImageNodeContent from './node-content/ImageNodeContent.vue'
import LinkNodeContent from './node-content/LinkNodeContent.vue'
import TaskNodeContent from './node-content/TaskNodeContent.vue'
import TopicNodeContent from './node-content/TopicNodeContent.vue'

const contentComponentByType = {
  attachment: AttachmentNodeContent,
  code: CodeNodeContent,
  image: ImageNodeContent,
  link: LinkNodeContent,
  task: TaskNodeContent,
  topic: TopicNodeContent
}
```

- [ ] **Step 6: Run tests and typecheck**

Run:

```bash
npm run test -w apps/web -- src/features/editor/__tests__/codeHighlight.test.ts src/features/editor/__tests__/nodeRenderer.test.ts
npm run typecheck -w apps/web
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json package-lock.json apps/web/src/features/editor/components/canvas apps/web/src/features/editor/utils/codeHighlight.ts apps/web/src/features/editor/__tests__/codeHighlight.test.ts apps/web/src/features/editor/__tests__/nodeRenderer.test.ts
git commit -m "feat(web): render multi-type node content"
```

---

### Task 7: Add Type-Aware Toolbar, Context Menu, and Inspector

**Files:**

- Modify: `apps/web/src/features/editor/components/toolbar/EditorToolbar.vue`
- Modify: `apps/web/src/features/editor/components/context-menu/EditorContextMenu.vue`
- Modify: `apps/web/src/features/editor/components/MindEditor.vue`
- Modify: `apps/web/src/features/editor/components/inspectors/NodeInspector.vue`
- Create: `apps/web/src/features/editor/utils/nodeContent.ts`
- Modify: `apps/web/src/features/editor/__tests__/editor.store.test.ts`
- Modify: `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`

- [ ] **Step 1: Add node type label utility**

Create `apps/web/src/features/editor/utils/nodeContent.ts`:

```ts
import type { MindNodeType } from '@mind-x/shared'

export const NODE_TYPE_OPTIONS: Array<{ label: string; type: MindNodeType }> = [
  { label: 'Text', type: 'topic' },
  { label: 'Image', type: 'image' },
  { label: 'Link', type: 'link' },
  { label: 'Attachment', type: 'attachment' },
  { label: 'Code', type: 'code' },
  { label: 'Task', type: 'task' }
]
```

- [ ] **Step 2: Update toolbar emits and template**

In `EditorToolbar.vue`, import:

```ts
import type { MindNodeType } from '@mind-x/shared'
import { NODE_TYPE_OPTIONS } from '../../utils/nodeContent'
```

Update emits:

```ts
const emit = defineEmits<{
  addChild: [type?: MindNodeType]
  addTopic: [type?: MindNodeType]
  delete: []
  exportPng: []
  redo: []
  save: []
  undo: []
}>()
```

Replace the add-child button with a dropdown:

```vue
<a-dropdown :disabled="!hasDocument || !hasSelection" trigger="click">
  <a-tooltip title="Add child">
    <a-button
      :disabled="!hasDocument || !hasSelection"
      aria-label="Add child"
      shape="circle"
      type="text"
      @click="emit('addChild', 'topic')"
    >
      <template #icon>
        <PlusOutlined />
      </template>
    </a-button>
  </a-tooltip>
  <template #overlay>
    <a-menu>
      <a-menu-item v-for="option in NODE_TYPE_OPTIONS" :key="option.type" @click="emit('addChild', option.type)">
        {{ option.label }}
      </a-menu-item>
    </a-menu>
  </template>
</a-dropdown>
```

Replace the root add button with this dropdown:

```vue
<a-dropdown :disabled="!hasDocument || hasNodes" trigger="click">
  <a-tooltip title="Add topic">
    <a-button
      :disabled="!hasDocument || hasNodes"
      aria-label="Add topic"
      shape="circle"
      type="text"
      @click="emit('addTopic', 'topic')"
    >
      <template #icon>
        <PlusOutlined />
      </template>
    </a-button>
  </a-tooltip>
  <template #overlay>
    <a-menu>
      <a-menu-item v-for="option in NODE_TYPE_OPTIONS" :key="option.type" @click="emit('addTopic', option.type)">
        {{ option.label }}
      </a-menu-item>
    </a-menu>
  </template>
</a-dropdown>
```

- [ ] **Step 3: Update context menu**

In `EditorContextMenu.vue`, import `MindNodeType` and `NODE_TYPE_OPTIONS`, then update emits:

```ts
const emit = defineEmits<{
  addChild: [type: MindNodeType]
  close: []
  delete: []
}>()
```

Add menu actions:

```vue
<a-button
  v-for="option in NODE_TYPE_OPTIONS"
  :key="option.type"
  :disabled="!canAddChild"
  block
  type="text"
  @click="emit('addChild', option.type)"
>
  Add {{ option.label.toLowerCase() }} child
</a-button>
```

- [ ] **Step 4: Wire MindEditor add actions**

In `MindEditor.vue`, import `MindNodeType`:

```ts
import type { EdgeStyle, MindDocument, MindEdge, MindNode, MindNodeType, NodeShellStyle, Point } from '@mind-x/shared'
```

Change add functions:

```ts
function addTopic(type: MindNodeType = 'topic'): void {
  editor.addRootNode({ type })
}

function addChild(type: MindNodeType = 'topic'): void {
  editor.addChildNode({ type })
}

function addChildFromContextMenu(type: MindNodeType): void {
  addChild(type)
  closeContextMenu()
}
```

Keep Tab behavior:

```ts
if (event.key === 'Tab' && hasSelection.value) {
  event.preventDefault()
  addChild('topic')
}
```

- [ ] **Step 5: Update NodeInspector to receive the selected node**

Change `NodeInspector.vue` props:

```ts
import type { MindNode, NodeShellStyle } from '@mind-x/shared'

defineProps<{
  node: MindNode
}>()

const emit = defineEmits<{
  contentChange: [dataPatch: Record<string, unknown>]
  shellStyleChange: [stylePatch: Partial<NodeShellStyle>]
}>()
```

Replace `style` references with `node.shellStyle`.

For type-specific fields, add compact field sections:

```vue
<StyleField v-if="node.type === 'topic'" label="Title">
  <a-input :value="node.data.title" size="small" @change="(event) => emit('contentChange', { title: event.target.value })" />
</StyleField>
<StyleField v-if="node.type === 'image'" label="URL">
  <a-input :value="node.data.url" size="small" @change="(event) => emit('contentChange', { url: event.target.value })" />
</StyleField>
<StyleField v-if="node.type === 'link'" label="Title">
  <a-input :value="node.data.title" size="small" @change="(event) => emit('contentChange', { title: event.target.value })" />
</StyleField>
<StyleField v-if="node.type === 'link'" label="URL">
  <a-input :value="node.data.url" size="small" @change="(event) => emit('contentChange', { url: event.target.value })" />
</StyleField>
```

Add attachment, code, and task helpers:

```ts
function updateTaskTitle(index: number, title: string): void {
  if (node.type !== 'task') {
    return
  }
  emit('contentChange', {
    items: node.data.items.map((item, itemIndex) => (itemIndex === index ? { ...item, title } : item))
  })
}

function updateTaskDone(index: number, done: boolean): void {
  if (node.type !== 'task') {
    return
  }
  emit('contentChange', {
    items: node.data.items.map((item, itemIndex) => (itemIndex === index ? { ...item, done } : item))
  })
}
```

Add these template sections:

```vue
<StyleField v-if="node.type === 'attachment'" label="File">
  <a-input
    :value="node.data.fileName"
    size="small"
    @change="(event) => emit('contentChange', { fileName: event.target.value })"
  />
</StyleField>
<StyleField v-if="node.type === 'attachment'" label="URL">
  <a-input
    :value="node.data.url"
    size="small"
    @change="(event) => emit('contentChange', { url: event.target.value })"
  />
</StyleField>
<StyleField v-if="node.type === 'code'" label="Code">
  <a-textarea
    :auto-size="{ minRows: 4, maxRows: 8 }"
    :value="node.data.code"
    @change="(event) => emit('contentChange', { code: event.target.value })"
  />
</StyleField>
<template v-if="node.type === 'task'">
  <StyleField v-for="(item, index) in node.data.items" :key="item.id" :label="`Task ${index + 1}`">
    <div class="node-inspector__task-row">
      <a-checkbox :checked="item.done" @change="(event) => updateTaskDone(index, event.target.checked)" />
      <a-input :value="item.title" size="small" @change="(event) => updateTaskTitle(index, event.target.value)" />
    </div>
  </StyleField>
</template>
```

In `MindEditor.vue`, update inspector usage:

```vue
<NodeInspector
  :node="selectedNode"
  @content-change="(dataPatch) => editor.updateNodeData(selectedNode.id, dataPatch)"
  @shell-style-change="editor.setSelectedNodeShellStyle"
/>
```

- [ ] **Step 6: Run web tests and typecheck**

Run:

```bash
npm run test -w apps/web -- src/features/editor/__tests__/editor.store.test.ts src/features/editor/__tests__/nodeRenderer.test.ts
npm run typecheck -w apps/web
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/editor/components apps/web/src/features/editor/utils/nodeContent.ts apps/web/src/features/editor/__tests__
git commit -m "feat(web): add multi-type node controls"
```

---

### Task 8: Update API and Sync Boundary Tests for v3-Only Saves

**Files:**

- Modify: `apps/api/src/modules/projects/projects.test.ts`
- Modify: `apps/web/src/features/editor/__tests__/syncService.test.ts`
- Modify: `apps/web/src/features/editor/services/syncService.ts`
- Modify: `apps/web/src/features/editor/views/EditorView.vue`
- Modify: `packages/shared/src/document.test.ts`

- [ ] **Step 1: Update API fixture helpers**

In `apps/api/src/modules/projects/projects.test.ts`, update shared imports:

```ts
import {
  DEFAULT_EDGE_STYLE,
  DEFAULT_NODE_SHELL_STYLE,
  DEFAULT_NODE_SIZE_BY_TYPE,
  DEFAULT_TOPIC_CONTENT_STYLE,
  type MindDocument,
  type MindDocumentV1,
  type MindDocumentV2
} from '@mind-x/shared'
```

Update the primary document fixture to return v3:

```ts
function document(projectId: string): MindDocument {
  return {
    version: 3,
    meta: {
      projectId,
      title: 'Planning',
      updatedAt: '2026-04-29T00:00:00.000Z'
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
    edges: []
  }
}
```

Add a v2 fixture for read-migration tests:

```ts
function legacyV2Document(projectId: string): MindDocumentV2 {
  return {
    version: 2,
    meta: {
      projectId,
      title: 'Legacy V2',
      updatedAt: '2026-04-28T00:00:00.000Z'
    },
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [
      {
        id: 'root',
        type: 'topic',
        position: { x: 0, y: 0 },
        data: { title: 'Root' },
        style: {
          borderStyle: 'solid',
          colorToken: 'default',
          shadowLevel: 'sm',
          shape: 'rounded',
          size: 'md',
          textWeight: 'medium',
          tone: 'soft'
        }
      }
    ],
    edges: []
  }
}
```

- [ ] **Step 2: Add API v2 save rejection test**

Add or update this route test:

```ts
it('rejects v2 document saves after the v3 upgrade', async () => {
  const { token, project } = await createAuthenticatedProject()

  const response = await request(app.callback())
    .put(`/api/projects/${project.id}/document`)
    .set('Authorization', `Bearer ${token}`)
    .send({ document: legacyV2Document(project.id) })

  expect(response.status).toBe(422)
  expect(response.body.error.code).toBe('VALIDATION_ERROR')
})
```

- [ ] **Step 3: Update web sync tests**

In `apps/web/src/features/editor/__tests__/syncService.test.ts`, update current document fixtures to v3 and legacy server/local draft tests to expect `version: 3`.

For the save path, assert the request body is the v3 document unchanged:

```ts
expect(apiClient.put).toHaveBeenCalledWith('/projects/project-1/document', { document })
```

Add a local draft assertion:

```ts
expect(saved.document.version).toBe(3)
```

- [ ] **Step 4: Run boundary tests**

Run:

```bash
npm run test -w apps/api -- src/modules/projects/projects.test.ts
npm run test -w apps/web -- src/features/editor/__tests__/syncService.test.ts
npm run test -w packages/shared
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/projects/projects.test.ts apps/web/src/features/editor/__tests__/syncService.test.ts apps/web/src/features/editor/services/syncService.ts apps/web/src/features/editor/views/EditorView.vue packages/shared/src/document.test.ts
git commit -m "test: enforce v3 document boundaries"
```

---

### Task 9: Final Cleanup, Full Verification, and Documentation Alignment

**Files:**

- Modify: `README.md` only if user-facing behavior descriptions need the new node types.
- Modify: any stale test fixture still using v2 `style` in current `MindDocument`.

- [ ] **Step 1: Search for stale v2 current-document fields**

Run:

```bash
rg -n "version: 2|style: DEFAULT_TOPIC_STYLE|node\\.style|TopicNodeStyle|resolveTopicNode" apps packages
```

Expected allowed matches:

- v1/v2 schema definitions and migration tests in `packages/shared/src/document.ts` and `packages/shared/src/document.test.ts`.
- Explicit `MindDocumentV2` legacy fixtures.
- Compatibility aliases kept intentionally in `objectStyles.ts` only if no callers use them.

- [ ] **Step 2: Remove compatibility aliases if no callers remain**

If `rg -n "resolveTopicNodeClass|resolveTopicNodeStyle|setNodeStyleCommand|TopicNodeStyle" apps packages` shows only definitions and legacy tests, remove unused compatibility aliases and imports.

Expected follow-up run:

```bash
rg -n "TopicNodeStyle|resolveTopicNodeClass|resolveTopicNodeStyle" apps packages
```

Expected: no matches outside `packages/shared/src/document.ts` legacy v2 schema and tests.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm run typecheck
npm test
npm run build
```

Expected: PASS for all three commands.

- [ ] **Step 4: Commit cleanup**

```bash
git add README.md apps packages package-lock.json package.json
git commit -m "chore: clean up multi-type node migration"
```

If there are no cleanup changes after Step 2, do not create an empty commit.

---

## Self-Review Checklist

- Spec coverage:
  - v3 schema and migration are covered by Tasks 1 and 2.
  - v3-only write boundaries are covered by Task 8.
  - Generic engine commands and type-agnostic graph behavior are covered by Task 3.
  - Manual resize and undo batching are covered by Task 4.
  - Shared shell and content components are covered by Tasks 5 and 6.
  - Toolbar, context menu, Tab, and inspector behavior are covered by Task 7.
  - Code highlighting with automatic detection is covered by Task 6.
  - Export bounds and stale-v2 cleanup are covered by Tasks 4 and 9.
- Placeholder scan: no placeholder tasks are intentionally left open.
- Type consistency:
  - Current document type ends as `MindDocument = MindDocumentV3`.
  - Text nodes remain persisted as `type: 'topic'`.
  - Outer style is `shellStyle`.
  - Type-specific style is `contentStyle`.
  - Explicit dimensions live in `node.size`.
