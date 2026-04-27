# Edge Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add selectable edge component presets, a floating inspector, and edge deletion that detaches the child node as a root.

**Architecture:** Extend the shared document contract first, then implement pure engine commands for edge styling and edge detachment. Wire those commands through the Pinia editor store, make SVG edges selectable with wide hit paths, and expose edge configuration through a draggable floating inspector over the canvas.

**Tech Stack:** TypeScript, Zod, Vue 3, Pinia, Ant Design Vue 4, SVG paths and markers, Vitest.

---

## Scope Check

This is a focused editor feature. It touches the shared document schema, mind-engine commands, editor store selection state, edge rendering, a new floating inspector, and editor shell wiring. It does not require backend endpoint changes because project documents already persist the full mind document JSON.

## File Structure

- Modify `packages/shared/src/document.ts`: add `MindEdgeComponent`, `DEFAULT_EDGE_COMPONENT`, optional edge component schema, and reserved direction data.
- Modify `packages/shared/src/document.test.ts`: prove four edge components are valid, missing component is valid, and unknown component is rejected.
- Modify `packages/mind-engine/src/graph.ts`: allow `createParentEdge` to receive an optional component.
- Modify `packages/mind-engine/src/commands.ts`: add `setEdgeComponent`, `deleteEdgeDetachChild`, and child-edge component inheritance.
- Modify `packages/mind-engine/src/commands.test.ts`: cover edge component updates, detach deletion, subtree preservation, and inheritance.
- Modify `apps/web/src/stores/editor.ts`: add `selectedEdgeId`, mutual selection actions, edge component updates, edge deletion, and stale selection compaction.
- Modify `apps/web/src/stores/editor.test.ts`: cover mutual selection, undoable edge changes, deletion, and stale edge clearing.
- Create `apps/web/src/components/editor/edgeComponents.ts`: hold edge preset metadata and renderer helper functions.
- Create `apps/web/src/components/editor/edgeComponents.test.ts`: cover helper fallback, dash, and arrow behavior.
- Modify `apps/web/src/components/editor/EdgeRenderer.vue`: add hit paths, hover state, selected state, dash styles, arrow markers, and select emits.
- Create `apps/web/src/components/editor/InspectorPanel.vue`: generic draggable floating panel frame.
- Create `apps/web/src/components/editor/EdgeInspector.vue`: edge preset selector and detach button.
- Modify `apps/web/src/components/editor/MindEditor.vue`: wire edge selection, canvas clear behavior, selected edge lookup, inspector visibility, and delete handling.
- Modify `apps/web/src/components/editor/viewportGestureFilter.ts`: exclude the floating inspector from viewport gestures.
- Modify `apps/web/src/components/editor/viewportGestureFilter.test.ts`: prove the inspector is excluded from pan/zoom gestures.

## Task 1: Extend Shared Edge Contract

**Files:**
- Modify: `packages/shared/src/document.ts`
- Modify: `packages/shared/src/document.test.ts`

- [ ] **Step 1: Write failing shared schema tests**

Add these tests inside the existing `describe('mindDocumentSchema', ...)` block in `packages/shared/src/document.test.ts`:

```ts
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
```

- [ ] **Step 2: Run shared schema tests and verify red**

Run:

```bash
npm run test -w packages/shared -- src/document.test.ts
```

Expected: FAIL because `component` and `data.direction` are not accepted by `mindEdgeSchema`.

- [ ] **Step 3: Extend the shared edge schema**

In `packages/shared/src/document.ts`, add the component and direction schemas after `sizeSchema`:

```ts
export const edgeComponentSchema = z.enum(['plain', 'dashed', 'arrow', 'dashed-arrow'])

export const edgeDirectionSchema = z.literal('source-target')
```

Then replace `mindEdgeSchema` with:

```ts
export const mindEdgeSchema = z.object({
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
```

Finally add these exported types and the default component constant near the existing type exports:

```ts
export type MindEdgeComponent = z.infer<typeof edgeComponentSchema>
export type MindEdgeDirection = z.infer<typeof edgeDirectionSchema>
export const DEFAULT_EDGE_COMPONENT: MindEdgeComponent = 'plain'
```

- [ ] **Step 4: Run shared schema tests and verify green**

Run:

```bash
npm run test -w packages/shared -- src/document.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit shared contract change**

Run:

```bash
git add packages/shared/src/document.ts packages/shared/src/document.test.ts
git commit -m "feat(shared): add edge component contract"
```

## Task 2: Add Pure Engine Edge Commands

**Files:**
- Modify: `packages/mind-engine/src/graph.ts`
- Modify: `packages/mind-engine/src/commands.ts`
- Modify: `packages/mind-engine/src/commands.test.ts`

- [ ] **Step 1: Write failing engine tests**

Update the import in `packages/mind-engine/src/commands.test.ts`:

```ts
import {
  addChildNode,
  deleteEdgeDetachChild,
  deleteNodePromoteChildren,
  editNodeTitle,
  moveNodes,
  setEdgeComponent
} from './commands.js'
```

Add these tests inside the existing `describe('commands', ...)` block:

```ts
  it('sets an edge component without changing structure', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push(
      { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } },
      { id: 'child', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'Child' } }
    )
    doc.edges.push({ id: 'root->child', source: 'root', target: 'child', type: 'mind-parent' })

    const result = setEdgeComponent(doc, { edgeId: 'root->child', component: 'dashed-arrow' })

    expect(result.edges).toEqual([
      { id: 'root->child', source: 'root', target: 'child', type: 'mind-parent', component: 'dashed-arrow' }
    ])
    expect(getParentId(result, 'child')).toBe('root')
  })

  it('rejects setting a missing edge component target', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })

    expect(() => setEdgeComponent(doc, { edgeId: 'missing', component: 'arrow' })).toThrow(
      'Edge missing does not exist'
    )
  })

  it('deletes an edge and leaves the child as a root with its subtree intact', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push(
      { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } },
      { id: 'child', type: 'topic', position: { x: 240, y: 12 }, data: { title: 'Child' } },
      { id: 'leaf', type: 'topic', position: { x: 480, y: 24 }, data: { title: 'Leaf' } }
    )
    doc.edges.push(
      { id: 'root->child', source: 'root', target: 'child', type: 'mind-parent', component: 'arrow' },
      { id: 'child->leaf', source: 'child', target: 'leaf', type: 'mind-parent', component: 'dashed' }
    )

    const result = deleteEdgeDetachChild(doc, { edgeId: 'root->child' })

    expect(result.nodes.find((node) => node.id === 'child')?.position).toEqual({ x: 240, y: 12 })
    expect(getParentId(result, 'child')).toBeNull()
    expect(getParentId(result, 'leaf')).toBe('child')
    expect(result.edges).toEqual([
      { id: 'child->leaf', source: 'child', target: 'leaf', type: 'mind-parent', component: 'dashed' }
    ])
  })

  it('rejects deleting a missing edge', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })

    expect(() => deleteEdgeDetachChild(doc, { edgeId: 'missing' })).toThrow('Edge missing does not exist')
  })

  it('creates child edges with the most recent child edge component from the same parent', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push(
      { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } },
      { id: 'first', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'First' } },
      { id: 'other-parent', type: 'topic', position: { x: 0, y: 160 }, data: { title: 'Other' } },
      { id: 'other-child', type: 'topic', position: { x: 240, y: 160 }, data: { title: 'Other Child' } }
    )
    doc.edges.push(
      { id: 'root->first', source: 'root', target: 'first', type: 'mind-parent', component: 'dashed-arrow' },
      { id: 'other-parent->other-child', source: 'other-parent', target: 'other-child', type: 'mind-parent', component: 'plain' }
    )

    const result = addChildNode(doc, { parentId: 'root', id: 'second', title: 'Second' })

    expect(result.edges.find((edge) => edge.id === 'root->second')?.component).toBe('dashed-arrow')
  })

  it('creates first child edges with the plain component', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push({ id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } })

    const result = addChildNode(doc, { parentId: 'root', id: 'child', title: 'Child' })

    expect(result.edges).toEqual([
      { id: 'root->child', source: 'root', target: 'child', type: 'mind-parent', component: 'plain' }
    ])
  })
```

- [ ] **Step 2: Run engine tests and verify red**

Run:

```bash
npm run test -w packages/mind-engine -- src/commands.test.ts
```

Expected: FAIL because `setEdgeComponent` and `deleteEdgeDetachChild` are not exported from `commands.ts`, and new child edges do not set `component`.

- [ ] **Step 3: Allow parent edges to carry a component**

In `packages/mind-engine/src/graph.ts`, update the import and `createParentEdge`:

```ts
import type { MindDocument, MindEdge, MindEdgeComponent, MindNode } from '@mind-x/shared'
```

```ts
export type CreateParentEdgeOptions = {
  component?: MindEdgeComponent
}

export function createParentEdge(source: string, target: string, options: CreateParentEdgeOptions = {}): MindEdge {
  return {
    id: `${source}->${target}`,
    source,
    target,
    type: 'mind-parent',
    ...(options.component ? { component: options.component } : {})
  }
}
```

- [ ] **Step 4: Add edge helpers and commands**

In `packages/mind-engine/src/commands.ts`, update the import:

```ts
import { DEFAULT_EDGE_COMPONENT, type MindDocument, type MindEdge, type MindEdgeComponent, type Point } from '@mind-x/shared'
```

Add these helpers near the top of the file after `cloneDocument`:

```ts
function getEdgeComponent(edge: MindEdge): MindEdgeComponent {
  return edge.component ?? DEFAULT_EDGE_COMPONENT
}

function getNewChildEdgeComponent(document: MindDocument, parentId: string): MindEdgeComponent {
  const childEdges = document.edges.filter((edge) => edge.source === parentId)
  const latestChildEdge = childEdges.at(-1)
  return latestChildEdge ? getEdgeComponent(latestChildEdge) : DEFAULT_EDGE_COMPONENT
}
```

In `addChildNode`, compute the new edge component before pushing the edge:

```ts
  const component = getNewChildEdgeComponent(next, input.parentId)

  next.nodes.push({
    id: input.id,
    type: 'topic',
    position,
    data: { title: input.title }
  })
  next.edges.push(createParentEdge(input.parentId, input.id, { component }))
```

Add these command exports after `moveNodes`:

```ts
export type SetEdgeComponentInput = {
  edgeId: string
  component: MindEdgeComponent
}

export function setEdgeComponent(document: MindDocument, input: SetEdgeComponentInput): MindDocument {
  const next = cloneDocument(document)
  const edge = next.edges.find((candidate) => candidate.id === input.edgeId)
  if (!edge) {
    throw new Error(`Edge ${input.edgeId} does not exist`)
  }

  edge.component = input.component
  assertMindTree(next)
  return next
}

export type DeleteEdgeInput = {
  edgeId: string
}

export function deleteEdgeDetachChild(document: MindDocument, input: DeleteEdgeInput): MindDocument {
  const next = cloneDocument(document)
  const edge = next.edges.find((candidate) => candidate.id === input.edgeId)
  if (!edge) {
    throw new Error(`Edge ${input.edgeId} does not exist`)
  }

  next.edges = next.edges.filter((candidate) => candidate.id !== input.edgeId)
  assertMindTree(next)
  return next
}
```

- [ ] **Step 5: Run engine tests and verify green**

Run:

```bash
npm run test -w packages/mind-engine -- src/commands.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit engine command change**

Run:

```bash
git add packages/mind-engine/src/graph.ts packages/mind-engine/src/commands.ts packages/mind-engine/src/commands.test.ts
git commit -m "feat(engine): add edge component commands"
```

## Task 3: Add Store Edge Selection And Actions

**Files:**
- Modify: `apps/web/src/stores/editor.ts`
- Modify: `apps/web/src/stores/editor.test.ts`

- [ ] **Step 1: Write failing store tests**

Update the `apps/web/src/stores/editor.test.ts` imports only if TypeScript requests it. The current `MindDocument` import is enough.

Add these tests inside `describe('editor store', ...)`:

```ts
  it('keeps edge and node selection mutually exclusive', () => {
    const store = loadedStore(
      emptyDocument({
        nodes: [
          { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } },
          { id: 'child', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'Child' } }
        ],
        edges: [{ id: 'root->child', source: 'root', target: 'child', type: 'mind-parent', component: 'plain' }]
      })
    )

    store.selectEdge('root->child')

    expect(store.selectedEdgeId).toBe('root->child')
    expect(store.selectedNodeIds).toEqual([])

    store.selectOnly('root')

    expect(store.selectedEdgeId).toBeNull()
    expect(store.selectedNodeIds).toEqual(['root'])

    store.selectEdge('root->child')
    store.setSelection(['root', 'child'])

    expect(store.selectedEdgeId).toBeNull()
    expect(store.selectedNodeIds).toEqual(['root', 'child'])
  })

  it('updates a selected edge component as an undoable dirty change', () => {
    const store = loadedStore(
      emptyDocument({
        nodes: [
          { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } },
          { id: 'child', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'Child' } }
        ],
        edges: [{ id: 'root->child', source: 'root', target: 'child', type: 'mind-parent', component: 'plain' }]
      })
    )

    store.selectEdge('root->child')
    store.setSelectedEdgeComponent('dashed-arrow')

    expect(store.document?.edges[0].component).toBe('dashed-arrow')
    expect(store.selectedEdgeId).toBe('root->child')
    expect(store.dirty).toBe(true)
    expect(store.canUndo).toBe(true)

    store.undo()

    expect(store.document?.edges[0].component).toBe('plain')
    expect(store.selectedEdgeId).toBe('root->child')
    expect(store.dirty).toBe(false)
  })

  it('deletes a selected edge and leaves the child node as a root', () => {
    const store = loadedStore(
      emptyDocument({
        nodes: [
          { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } },
          { id: 'child', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'Child' } },
          { id: 'leaf', type: 'topic', position: { x: 480, y: 0 }, data: { title: 'Leaf' } }
        ],
        edges: [
          { id: 'root->child', source: 'root', target: 'child', type: 'mind-parent', component: 'arrow' },
          { id: 'child->leaf', source: 'child', target: 'leaf', type: 'mind-parent', component: 'dashed' }
        ]
      })
    )

    store.selectEdge('root->child')
    store.deleteSelected()

    expect(store.document?.edges).toEqual([
      { id: 'child->leaf', source: 'child', target: 'leaf', type: 'mind-parent', component: 'dashed' }
    ])
    expect(store.selectedEdgeId).toBeNull()
    expect(store.selectedNodeIds).toEqual([])
    expect(store.canUndo).toBe(true)

    store.undo()

    expect(store.document?.edges.map((edge) => edge.id)).toEqual(['root->child', 'child->leaf'])
  })

  it('clears stale edge selection after load and document commits', () => {
    const store = loadedStore(
      emptyDocument({
        nodes: [
          { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } },
          { id: 'child', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'Child' } }
        ],
        edges: [{ id: 'root->child', source: 'root', target: 'child', type: 'mind-parent', component: 'arrow' }]
      })
    )

    store.selectEdge('root->child')
    store.load(emptyDocument())

    expect(store.selectedEdgeId).toBeNull()

    const documentWithEdge = emptyDocument({
      nodes: [
        { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } },
        { id: 'child', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'Child' } }
      ],
      edges: [{ id: 'root->child', source: 'root', target: 'child', type: 'mind-parent', component: 'arrow' }]
    })
    store.load(documentWithEdge)
    store.selectEdge('root->child')
    store.commit(emptyDocument({ nodes: [{ id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } }] }))

    expect(store.selectedEdgeId).toBeNull()
  })
```

- [ ] **Step 2: Update the existing add-child expectation for explicit plain edges**

In the existing test named `adds a root topic to an empty document and then adds a selected child`, replace the edge expectation with:

```ts
    expect(store.document?.edges).toEqual([
      { id: 'root->child', source: 'root', target: 'child', type: 'mind-parent', component: 'plain' }
    ])
```

- [ ] **Step 3: Run store tests and verify red**

Run:

```bash
npm run test -w apps/web -- src/stores/editor.test.ts
```

Expected: FAIL because `selectedEdgeId`, `selectEdge`, and `setSelectedEdgeComponent` do not exist.

- [ ] **Step 4: Add edge selection state and helpers**

In `apps/web/src/stores/editor.ts`, update imports:

```ts
import {
  mindDocumentSchema,
  type MindDocument,
  type MindEdgeComponent,
  type Point,
  type ThemeName,
  type Viewport
} from '@mind-x/shared'
import {
  addChildNode,
  createHistory,
  deleteEdgeDetachChild,
  deleteNodePromoteChildren,
  editNodeTitle,
  moveNodes,
  setEdgeComponent,
  type History
} from '@mind-x/mind-engine'
```

Add `selectedEdgeId` to `EditorState`:

```ts
type EditorState = {
  cleanDocumentJson: string | null
  dirty: boolean
  document: MindDocument | null
  history: History<MindDocument> | null
  historyCanRedo: boolean
  historyCanUndo: boolean
  selectedEdgeId: string | null
  selectedNodeIds: string[]
}
```

Initialize it:

```ts
selectedEdgeId: null,
selectedNodeIds: []
```

Add this helper near `compactSelection`:

```ts
function compactSelectedEdge(document: MindDocument | null, selectedEdgeId: string | null): string | null {
  if (!document || !selectedEdgeId) {
    return null
  }

  return document.edges.some((edge) => edge.id === selectedEdgeId) ? selectedEdgeId : null
}
```

- [ ] **Step 5: Compact selection on document changes**

Update these methods in `apps/web/src/stores/editor.ts`:

```ts
load(document: MindDocument): void {
  const next = cloneDocument(document)
  this.document = next
  this.selectedNodeIds = []
  this.selectedEdgeId = null
  this.cleanDocumentJson = serializeMindDocument(next)
  this.syncDirtyState()
  this.history = markRaw(createHistory(next))
  this.syncHistoryState()
},
commit(document: MindDocument): void {
  const next = cloneDocument(document)
  this.document = next
  this.history?.push(next)
  this.selectedNodeIds = compactSelection(next, this.selectedNodeIds)
  this.selectedEdgeId = compactSelectedEdge(next, this.selectedEdgeId)
  this.syncDirtyState()
  this.syncHistoryState()
},
```

In `previewMoveSelectedByWorldDelta`, after `this.selectedNodeIds = compactSelection(...)`, add:

```ts
this.selectedEdgeId = compactSelectedEdge(next, this.selectedEdgeId)
```

In `undo` and `redo`, after compacting node selection, add:

```ts
this.selectedEdgeId = compactSelectedEdge(this.document, this.selectedEdgeId)
```

- [ ] **Step 6: Add mutual selection actions**

Replace the selection actions in `apps/web/src/stores/editor.ts` with:

```ts
selectOnly(nodeId: string): void {
  this.selectedNodeIds = compactSelection(this.document, [nodeId])
  this.selectedEdgeId = null
},
setSelection(nodeIds: string[]): void {
  this.selectedNodeIds = compactSelection(this.document, [...nodeIds])
  this.selectedEdgeId = null
},
selectEdge(edgeId: string): void {
  this.selectedEdgeId = compactSelectedEdge(this.document, edgeId)
  if (this.selectedEdgeId) {
    this.selectedNodeIds = []
  }
},
clearSelection(): void {
  this.selectedNodeIds = []
  this.selectedEdgeId = null
},
```

In `addRootTopic` and `addChildTopic`, after setting `selectedNodeIds`, add:

```ts
this.selectedEdgeId = null
```

- [ ] **Step 7: Add selected-edge mutation and deletion actions**

Add this action before `deleteSelected`:

```ts
setSelectedEdgeComponent(component: MindEdgeComponent): void {
  if (!this.document || !this.selectedEdgeId) {
    return
  }

  this.commit(
    setEdgeComponent(cloneDocument(this.document), {
      edgeId: this.selectedEdgeId,
      component
    })
  )
},
```

Replace the start of `deleteSelected` with this edge-first branch:

```ts
deleteSelected(): void {
  if (!this.document) {
    return
  }

  if (this.selectedEdgeId) {
    const edgeId = this.selectedEdgeId
    if (!this.document.edges.some((edge) => edge.id === edgeId)) {
      this.selectedEdgeId = null
      return
    }

    this.selectedEdgeId = null
    this.selectedNodeIds = []
    this.commit(deleteEdgeDetachChild(cloneDocument(this.document), { edgeId }))
    return
  }

  if (this.selectedNodeIds.length === 0) {
    return
  }

  let next = cloneDocument(this.document)
  for (const nodeId of this.selectedNodeIds) {
    if (next.nodes.some((node) => node.id === nodeId)) {
      next = deleteNodePromoteChildren(next, { nodeId })
    }
  }

  this.selectedNodeIds = compactSelection(next, this.selectedNodeIds)
  this.selectedEdgeId = compactSelectedEdge(next, this.selectedEdgeId)
  this.commit(next)
},
```

- [ ] **Step 8: Run store tests and verify green**

Run:

```bash
npm run test -w apps/web -- src/stores/editor.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit store change**

Run:

```bash
git add apps/web/src/stores/editor.ts apps/web/src/stores/editor.test.ts
git commit -m "feat(web): add edge selection store actions"
```

## Task 4: Add Edge Component Helpers And Interactive Renderer

**Files:**
- Create: `apps/web/src/components/editor/edgeComponents.ts`
- Create: `apps/web/src/components/editor/edgeComponents.test.ts`
- Modify: `apps/web/src/components/editor/EdgeRenderer.vue`

- [ ] **Step 1: Write failing helper tests**

Create `apps/web/src/components/editor/edgeComponents.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { getEdgeComponent, hasArrow, hasDash } from './edgeComponents'

describe('edge component helpers', () => {
  it('falls back to plain for missing components', () => {
    expect(getEdgeComponent({})).toBe('plain')
  })

  it('detects dashed edge presets', () => {
    expect(hasDash('plain')).toBe(false)
    expect(hasDash('dashed')).toBe(true)
    expect(hasDash('arrow')).toBe(false)
    expect(hasDash('dashed-arrow')).toBe(true)
  })

  it('detects arrow edge presets', () => {
    expect(hasArrow('plain')).toBe(false)
    expect(hasArrow('dashed')).toBe(false)
    expect(hasArrow('arrow')).toBe(true)
    expect(hasArrow('dashed-arrow')).toBe(true)
  })
})
```

- [ ] **Step 2: Run helper tests and verify red**

Run:

```bash
npm run test -w apps/web -- src/components/editor/edgeComponents.test.ts
```

Expected: FAIL because `edgeComponents.ts` does not exist.

- [ ] **Step 3: Create edge component helpers**

Create `apps/web/src/components/editor/edgeComponents.ts`:

```ts
import { DEFAULT_EDGE_COMPONENT, type MindEdge, type MindEdgeComponent } from '@mind-x/shared'

export const EDGE_COMPONENT_OPTIONS: Array<{ label: string; value: MindEdgeComponent }> = [
  { label: 'Plain', value: 'plain' },
  { label: 'Dashed', value: 'dashed' },
  { label: 'Arrow', value: 'arrow' },
  { label: 'Dashed arrow', value: 'dashed-arrow' }
]

const EDGE_COMPONENT_SET = new Set<MindEdgeComponent>(EDGE_COMPONENT_OPTIONS.map((option) => option.value))

export function getEdgeComponent(edge: Pick<MindEdge, 'component'>): MindEdgeComponent {
  return edge.component && EDGE_COMPONENT_SET.has(edge.component) ? edge.component : DEFAULT_EDGE_COMPONENT
}

export function hasDash(component: MindEdgeComponent): boolean {
  return component === 'dashed' || component === 'dashed-arrow'
}

export function hasArrow(component: MindEdgeComponent): boolean {
  return component === 'arrow' || component === 'dashed-arrow'
}
```

- [ ] **Step 4: Run helper tests and verify green**

Run:

```bash
npm run test -w apps/web -- src/components/editor/edgeComponents.test.ts
```

Expected: PASS.

- [ ] **Step 5: Make EdgeRenderer emit selections with hit paths**

In `apps/web/src/components/editor/EdgeRenderer.vue`, update the script section:

```vue
<script setup lang="ts">
import type { MindEdge, MindNode } from '@mind-x/shared'
import { computed, ref } from 'vue'
import { getEdgeComponent, hasArrow, hasDash } from './edgeComponents'

const props = defineProps<{
  edges: MindEdge[]
  nodes: MindNode[]
  selectedEdgeId?: string | null
}>()

const emit = defineEmits<{
  select: [edgeId: string]
}>()
```

Add hover state after the viewport style:

```ts
const hoveredEdgeId = ref<string | null>(null)

function isEdgeActive(edge: MindEdge): boolean {
  return props.selectedEdgeId === edge.id || hoveredEdgeId.value === edge.id
}

function getVisiblePathClass(edge: MindEdge) {
  const component = getEdgeComponent(edge)
  return {
    'edge-renderer__path': true,
    'edge-renderer__path--active': isEdgeActive(edge),
    'edge-renderer__path--selected': props.selectedEdgeId === edge.id,
    'edge-renderer__path--dashed': hasDash(component)
  }
}

function getMarkerEnd(edge: MindEdge): string | undefined {
  const component = getEdgeComponent(edge)
  if (!hasArrow(component)) {
    return undefined
  }

  return props.selectedEdgeId === edge.id ? 'url(#edge-arrow-selected)' : 'url(#edge-arrow)'
}
```

Replace the template with:

```vue
<template>
  <svg class="edge-renderer" aria-hidden="true" :style="edgeRendererStyle" :viewBox="edgeViewport.viewBox">
    <defs>
      <marker
        id="edge-arrow"
        markerHeight="8"
        markerUnits="strokeWidth"
        markerWidth="8"
        orient="auto"
        refX="7"
        refY="4"
        viewBox="0 0 8 8"
      >
        <path class="edge-renderer__marker" d="M 0 0 L 8 4 L 0 8 z" />
      </marker>
      <marker
        id="edge-arrow-selected"
        markerHeight="8"
        markerUnits="strokeWidth"
        markerWidth="8"
        orient="auto"
        refX="7"
        refY="4"
        viewBox="0 0 8 8"
      >
        <path class="edge-renderer__marker edge-renderer__marker--selected" d="M 0 0 L 8 4 L 0 8 z" />
      </marker>
    </defs>

    <template v-for="edge in edges" :key="edge.id">
      <g v-if="getPath(edge)" data-editor-edge :data-editor-edge-id="edge.id">
        <path
          class="edge-renderer__hit-path"
          :d="getPath(edge) ?? undefined"
          @click.stop="emit('select', edge.id)"
          @pointerdown.stop
          @pointerenter="hoveredEdgeId = edge.id"
          @pointerleave="hoveredEdgeId = hoveredEdgeId === edge.id ? null : hoveredEdgeId"
        />
        <path
          :class="getVisiblePathClass(edge)"
          :d="getPath(edge) ?? undefined"
          :marker-end="getMarkerEnd(edge)"
        />
      </g>
    </template>
  </svg>
</template>
```

Replace the style section with:

```css
.edge-renderer {
  position: absolute;
  overflow: visible;
  pointer-events: none;
}

.edge-renderer__hit-path {
  fill: none;
  pointer-events: stroke;
  stroke: transparent;
  stroke-linecap: round;
  stroke-width: 16;
}

.edge-renderer__path {
  fill: none;
  pointer-events: none;
  stroke: var(--color-edge);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
  transition:
    stroke 120ms ease,
    stroke-width 120ms ease;
}

.edge-renderer__path--active {
  stroke: var(--color-primary-hover);
  stroke-width: 2.5;
}

.edge-renderer__path--selected {
  stroke: var(--color-primary);
  stroke-width: 3;
}

.edge-renderer__path--dashed {
  stroke-dasharray: 8 8;
}

.edge-renderer__marker {
  fill: var(--color-edge);
}

.edge-renderer__marker--selected {
  fill: var(--color-primary);
}
```

- [ ] **Step 6: Run helper tests and web typecheck**

Run:

```bash
npm run test -w apps/web -- src/components/editor/edgeComponents.test.ts
npm run typecheck -w apps/web
```

Expected: PASS. `selectedEdgeId` is optional in `EdgeRenderer.vue` so existing `MindEditor.vue` wiring remains valid until Task 6 passes the real selected edge value.

- [ ] **Step 7: Commit helper and renderer change**

Run:

```bash
git add apps/web/src/components/editor/edgeComponents.ts apps/web/src/components/editor/edgeComponents.test.ts apps/web/src/components/editor/EdgeRenderer.vue
git commit -m "feat(web): make edge renderer selectable"
```

## Task 5: Add Floating Inspector Components

**Files:**
- Create: `apps/web/src/components/editor/InspectorPanel.vue`
- Create: `apps/web/src/components/editor/EdgeInspector.vue`

- [ ] **Step 1: Create the draggable inspector shell**

Create `apps/web/src/components/editor/InspectorPanel.vue`:

```vue
<script setup lang="ts">
import { CloseOutlined } from '@ant-design/icons-vue'
import { reactive, ref } from 'vue'

defineProps<{
  title: string
}>()

const emit = defineEmits<{
  close: []
}>()

const position = reactive({ x: 24, y: 88 })
const draggingPointerId = ref<number | null>(null)
const lastPointer = ref<{ x: number; y: number } | null>(null)

function startDrag(event: PointerEvent): void {
  draggingPointerId.value = event.pointerId
  lastPointer.value = { x: event.clientX, y: event.clientY }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  event.preventDefault()
  event.stopPropagation()
}

function moveDrag(event: PointerEvent): void {
  if (draggingPointerId.value !== event.pointerId || !lastPointer.value) {
    return
  }

  const nextPointer = { x: event.clientX, y: event.clientY }
  position.x = Math.max(8, position.x + nextPointer.x - lastPointer.value.x)
  position.y = Math.max(8, position.y + nextPointer.y - lastPointer.value.y)
  lastPointer.value = nextPointer
  event.preventDefault()
  event.stopPropagation()
}

function endDrag(event: PointerEvent): void {
  if (draggingPointerId.value !== event.pointerId) {
    return
  }

  draggingPointerId.value = null
  lastPointer.value = null
  event.preventDefault()
  event.stopPropagation()
}
</script>

<template>
  <aside
    class="inspector-panel"
    data-editor-control
    :style="{ transform: `translate(${position.x}px, ${position.y}px)` }"
    @click.stop
    @pointerdown.stop
  >
    <header
      class="inspector-panel__header"
      @pointercancel="endDrag"
      @pointerdown="startDrag"
      @pointermove="moveDrag"
      @pointerup="endDrag"
    >
      <h2 class="inspector-panel__title">{{ title }}</h2>
      <a-button aria-label="Close inspector" shape="circle" size="small" type="text" @click="emit('close')">
        <template #icon>
          <CloseOutlined />
        </template>
      </a-button>
    </header>
    <div class="inspector-panel__body">
      <slot />
    </div>
  </aside>
</template>

<style scoped>
.inspector-panel {
  position: absolute;
  z-index: 25;
  top: 0;
  left: 0;
  display: grid;
  width: 260px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  box-shadow: var(--shadow-panel);
}

.inspector-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 8px 8px 12px;
  border-bottom: 1px solid var(--color-border-soft);
  cursor: grab;
  user-select: none;
}

.inspector-panel__header:active {
  cursor: grabbing;
}

.inspector-panel__title {
  margin: 0;
  color: var(--color-text-strong);
  font-size: 13px;
  font-weight: 650;
  line-height: 1.3;
}

.inspector-panel__body {
  display: grid;
  gap: 12px;
  padding: 12px;
}
</style>
```

- [ ] **Step 2: Create the edge inspector content**

Create `apps/web/src/components/editor/EdgeInspector.vue`:

```vue
<script setup lang="ts">
import { DeleteOutlined } from '@ant-design/icons-vue'
import type { MindEdgeComponent } from '@mind-x/shared'
import { EDGE_COMPONENT_OPTIONS } from './edgeComponents'

defineProps<{
  component: MindEdgeComponent
}>()

const emit = defineEmits<{
  componentChange: [component: MindEdgeComponent]
  delete: []
}>()

function onComponentChange(event: Event): void {
  const target = event.target as HTMLInputElement
  emit('componentChange', target.value as MindEdgeComponent)
}
</script>

<template>
  <section class="edge-inspector" aria-label="Edge inspector">
    <label class="edge-inspector__label">Edge component</label>
    <a-radio-group
      class="edge-inspector__components"
      :value="component"
      button-style="solid"
      size="small"
      @change="onComponentChange"
    >
      <a-radio-button v-for="option in EDGE_COMPONENT_OPTIONS" :key="option.value" :value="option.value">
        {{ option.label }}
      </a-radio-button>
    </a-radio-group>

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

.edge-inspector__label {
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 650;
  line-height: 1.2;
}

.edge-inspector__components {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.edge-inspector__components :deep(.ant-radio-button-wrapper) {
  width: 100%;
  border-inline-start-width: 1px;
  border-radius: 6px;
  text-align: center;
}

.edge-inspector__components :deep(.ant-radio-button-wrapper::before) {
  display: none;
}
</style>
```

- [ ] **Step 3: Run web typecheck**

Run:

```bash
npm run typecheck -w apps/web
```

Expected: PASS.

- [ ] **Step 4: Commit inspector components**

Run:

```bash
git add apps/web/src/components/editor/InspectorPanel.vue apps/web/src/components/editor/EdgeInspector.vue
git commit -m "feat(web): add floating edge inspector components"
```

## Task 6: Wire Editor Shell And Gesture Filtering

**Files:**
- Modify: `apps/web/src/components/editor/MindEditor.vue`
- Modify: `apps/web/src/components/editor/viewportGestureFilter.ts`
- Modify: `apps/web/src/components/editor/viewportGestureFilter.test.ts`

- [ ] **Step 1: Write failing viewport filter test**

In `apps/web/src/components/editor/viewportGestureFilter.test.ts`, update the test name and add an inspector element:

```ts
  it('excludes editor controls, nodes, context menus, inspectors, inputs, and buttons', () => {
    const toolbar = new TestElement(['.editor-toolbar'])
    const toolbarButton = new TestElement(['button'], toolbar)
    const node = new TestElement(['[data-editor-node]'])
    const contextMenu = new TestElement(['.editor-context-menu'])
    const control = new TestElement(['[data-editor-control]'])
    const inspector = new TestElement(['.inspector-panel'])

    expect(allowsViewportGesture(eventFor('mousedown', { target: toolbarButton as unknown as EventTarget }))).toBe(false)
    expect(allowsViewportGesture(eventFor('mousedown', { target: node as unknown as EventTarget }))).toBe(false)
    expect(allowsViewportGesture(eventFor('mousedown', { target: contextMenu as unknown as EventTarget }))).toBe(false)
    expect(allowsViewportGesture(eventFor('mousedown', { target: inspector as unknown as EventTarget }))).toBe(false)
    expect(allowsViewportGesture(eventFor('mousedown', { target: new TestElement(['input']) as unknown as EventTarget }))).toBe(false)
    expect(allowsViewportGesture(eventFor('mousedown', { target: new TestElement(['button']) as unknown as EventTarget }))).toBe(false)
    expect(allowsViewportGesture(eventFor('mousedown', { target: control as unknown as EventTarget }))).toBe(false)
  })
```

- [ ] **Step 2: Run viewport filter test and verify red**

Run:

```bash
npm run test -w apps/web -- src/components/editor/viewportGestureFilter.test.ts
```

Expected: FAIL because `.inspector-panel` is not excluded yet.

- [ ] **Step 3: Exclude inspector panels from viewport gestures**

In `apps/web/src/components/editor/viewportGestureFilter.ts`, add `.inspector-panel` to `EXCLUDED_VIEWPORT_TARGETS`:

```ts
const EXCLUDED_VIEWPORT_TARGETS = [
  '[data-editor-node]',
  '[data-editor-edge]',
  '[data-editor-control]',
  '.editor-toolbar',
  '.editor-context-menu',
  '.inspector-panel',
  'input',
  'textarea',
  'button',
  'select'
].join(', ')
```

- [ ] **Step 4: Wire MindEditor imports and selected edge lookup**

In `apps/web/src/components/editor/MindEditor.vue`, update the imports:

```ts
import type { MindDocument, MindEdge, MindEdgeComponent, Point } from '@mind-x/shared'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { getEdgeComponent } from './edgeComponents'
import EdgeInspector from './EdgeInspector.vue'
import EdgeRenderer from './EdgeRenderer.vue'
import EditorContextMenu from './EditorContextMenu.vue'
import EditorToolbar from './EditorToolbar.vue'
import InspectorPanel from './InspectorPanel.vue'
import NodeRenderer from './NodeRenderer.vue'
import SelectionLayer from './SelectionLayer.vue'
import ViewportPane from './ViewportPane.vue'
```

Add this computed value after `hasSelection`:

```ts
const selectedEdge = computed<MindEdge | null>(() => {
  if (!documentState.value || !editor.selectedEdgeId) {
    return null
  }

  return documentState.value.edges.find((edge) => edge.id === editor.selectedEdgeId) ?? null
})
```

- [ ] **Step 5: Add edge and canvas interaction handlers**

Add these functions in `MindEditor.vue` near the existing context menu helpers:

```ts
function selectEdge(edgeId: string): void {
  closeContextMenu()
  editor.selectEdge(edgeId)
}

function clearSelectionFromCanvas(event: PointerEvent): void {
  const target = event.target
  if (!(target instanceof Element)) {
    editor.clearSelection()
    return
  }

  if (target.closest('[data-editor-node], [data-editor-edge], [data-editor-control], .editor-toolbar, .editor-context-menu')) {
    return
  }

  editor.clearSelection()
}

function setSelectedEdgeComponent(component: MindEdgeComponent): void {
  editor.setSelectedEdgeComponent(component)
}

function deleteSelectedEdgeFromInspector(): void {
  editor.deleteSelected()
}
```

In `moveNode`, after selecting the node through `editor.selectOnly(nodeId)`, no extra edge clearing is needed because `selectOnly` clears `selectedEdgeId`.

In `openContextMenu`, the existing `editor.clearSelection()` call already clears both nodes and edges after Task 3.

- [ ] **Step 6: Prevent browser default deletion behavior**

In `MindEditor.vue`, update the delete key branch:

```ts
} else if (event.key === 'Delete' || event.key === 'Backspace') {
  event.preventDefault()
  editor.deleteSelected()
}
```

- [ ] **Step 7: Wire the template**

In `MindEditor.vue`, add `@pointerdown="clearSelectionFromCanvas"` to `ViewportPane`, update `EdgeRenderer`, and add the inspector as a sibling of `ViewportPane` so the panel is not transformed by canvas pan and zoom:

```vue
    <ViewportPane
      v-if="documentState"
      ref="viewportPaneRef"
      :viewport="documentState.viewport"
      @contextmenu.prevent="openContextMenu"
      @pointerdown="clearSelectionFromCanvas"
      @viewport-change="editor.setViewport"
    >
      <EdgeRenderer
        :edges="documentState.edges"
        :nodes="documentState.nodes"
        :selected-edge-id="editor.selectedEdgeId"
        @select="selectEdge"
      />
      <SelectionLayer :nodes="documentState.nodes" :selected-node-ids="editor.selectedNodeIds" />
      <NodeRenderer
        :nodes="documentState.nodes"
        :selected-node-ids="editor.selectedNodeIds"
        @drag="moveNode"
        @drag-end="editor.finishInteraction"
        @edit="editor.editNodeTitle"
        @select="editor.selectOnly"
      />
    </ViewportPane>

    <InspectorPanel v-if="selectedEdge" title="Edge" @close="editor.clearSelection">
      <EdgeInspector
        :component="getEdgeComponent(selectedEdge)"
        @component-change="setSelectedEdgeComponent"
        @delete="deleteSelectedEdgeFromInspector"
      />
    </InspectorPanel>
```

- [ ] **Step 8: Run focused web tests and typecheck**

Run:

```bash
npm run test -w apps/web -- src/components/editor/viewportGestureFilter.test.ts src/components/editor/edgeComponents.test.ts src/stores/editor.test.ts
npm run typecheck -w apps/web
```

Expected: PASS.

- [ ] **Step 9: Commit editor integration**

Run:

```bash
git add apps/web/src/components/editor/MindEditor.vue apps/web/src/components/editor/viewportGestureFilter.ts apps/web/src/components/editor/viewportGestureFilter.test.ts
git commit -m "feat(web): wire floating edge inspector"
```

## Task 7: Full Verification

**Files:**
- No source edits expected.

- [ ] **Step 1: Run shared tests**

Run:

```bash
npm run test -w packages/shared -- src/document.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run mind-engine tests**

Run:

```bash
npm run test -w packages/mind-engine -- src/commands.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run web focused tests**

Run:

```bash
npm run test -w apps/web -- src/stores/editor.test.ts src/components/editor/edgeComponents.test.ts src/components/editor/viewportGestureFilter.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 7: Inspect git status**

Run:

```bash
git status --short
```

Expected: no uncommitted source changes. If verification generated ignored build artifacts, leave them alone.

## Manual Smoke Check

After the automated checks pass, run the app and verify the editor manually:

```bash
npm run dev:web
```

Open the Vite URL shown in the terminal. In an existing or new project:

- Add a root topic and at least two child topics.
- Select the first edge by clicking near the curve; the floating inspector appears.
- Change the edge to `Dashed arrow`; the edge updates immediately.
- Add another child to the same parent; the new edge inherits `Dashed arrow`.
- Select the first edge and press `Delete`; the child remains visible and becomes a root.
- Use undo and redo to verify the edge deletion and edge component change are reversible.
- Drag the inspector by its header; the canvas does not pan.
- Close the inspector; the edge selection clears and the panel disappears.
