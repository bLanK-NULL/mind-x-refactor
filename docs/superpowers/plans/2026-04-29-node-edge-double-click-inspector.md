# Node And Edge Double-Click Inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make single-click node/edge interactions select only, and make double-click open the inspector pane while moving topic inline editing into `TopicNodeContent.vue`.

**Architecture:** Keep selection in the editor session/store and add UI-only inspection state in `MindEditor.vue`. Expose target-by-id style/delete methods from the editor session/store so an inspector can keep editing the inspected object even after the canvas selection changes. Refactor `BaseNode.vue` into a pure shell and let `*NodeContent.vue` components own any inline editing they support.

**Tech Stack:** Vue 3 SFCs, TypeScript, Pinia, `@mind-x/mind-engine`, `@mind-x/shared`, Vitest source-boundary tests.

---

## File Structure

Modify:

- `packages/mind-engine/src/editorSession/types.ts`: add target-by-id style and edge delete methods to `EditorSession`.
- `packages/mind-engine/src/editorSession/session.ts`: implement target-by-id node style, edge style, and edge delete methods; keep selected-object methods as compatibility wrappers.
- `packages/mind-engine/src/__tests__/editorSession.test.ts`: cover target-by-id methods without relying on selection.
- `apps/web/src/features/editor/stores/editor.ts`: expose target-by-id store methods.
- `apps/web/src/features/editor/__tests__/editor.store.test.ts`: verify the store delegates target-by-id methods.
- `apps/web/src/features/editor/components/MindEditor.vue`: own `inspectionTarget`, derive `inspectedNode`/`inspectedEdge`, and render inspectors from inspection state.
- `apps/web/src/features/editor/components/canvas/EdgeRenderer.vue`: add `inspect` emit and double-click hit-path handler.
- `apps/web/src/features/editor/components/canvas/BaseNode.vue`: remove edit state and edit slot API; add generic shell inspect emit.
- `apps/web/src/features/editor/components/canvas/NodeRenderer.vue`: forward node inspect and content commit events without edit slot callbacks.
- `apps/web/src/features/editor/components/canvas/node-content/TopicNodeContent.vue`: own local topic editing and double-click inspect behavior.
- `apps/web/src/features/editor/components/canvas/node-content/ImageNodeContent.vue`: remove BaseNode-driven editing props; keep read-only render.
- `apps/web/src/features/editor/components/canvas/node-content/LinkNodeContent.vue`: remove BaseNode-driven editing props; prevent read-only anchor navigation.
- `apps/web/src/features/editor/components/canvas/node-content/AttachmentNodeContent.vue`: remove BaseNode-driven editing props; prevent read-only anchor navigation.
- `apps/web/src/features/editor/components/canvas/node-content/CodeNodeContent.vue`: remove BaseNode-driven editing props; keep read-only highlighted code.
- `apps/web/src/features/editor/components/canvas/node-content/TaskNodeContent.vue`: remove BaseNode-driven editing props; keep read-only task list.
- `apps/web/src/features/editor/__tests__/editorControls.test.ts`: assert inspection state drives `InspectorPanel`.
- `apps/web/src/features/editor/__tests__/edgeRenderer.test.ts`: assert edge click selects and double-click inspects.
- `apps/web/src/features/editor/__tests__/baseNode.test.ts`: assert BaseNode owns shell interaction but not edit state.
- `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`: assert NodeRenderer forwards inspect/commit and no longer uses edit slot callbacks.

No new production files are needed.

---

### Task 1: Add Target-By-Id Editor Session And Store APIs

**Files:**

- Modify: `packages/mind-engine/src/editorSession/types.ts`
- Modify: `packages/mind-engine/src/editorSession/session.ts`
- Modify: `packages/mind-engine/src/__tests__/editorSession.test.ts`
- Modify: `apps/web/src/features/editor/stores/editor.ts`
- Modify: `apps/web/src/features/editor/__tests__/editor.store.test.ts`

- [ ] **Step 1: Write failing engine-session tests**

Add these tests near the existing selected style tests in `packages/mind-engine/src/__tests__/editorSession.test.ts`:

```ts
  it('updates node styles by id without relying on current selection', () => {
    const session = createEditorSession()
    session.load(documentWithEdge())
    session.selectOnly('child')

    session.setNodeShellStyle('root', { colorToken: 'purple' })
    session.setNodeContentStyle('root', { textWeight: 'bold' })

    const root = session.getState().document?.nodes.find((node) => node.id === 'root')
    expect(root?.shellStyle.colorToken).toBe('purple')
    expect(root?.contentStyle).toMatchObject({ textWeight: 'bold' })
    expect(session.getState().selectedNodeIds).toEqual(['child'])
    expect(session.getState().selectedEdgeId).toBeNull()
    expect(session.getState().canUndo).toBe(true)
  })

  it('updates and deletes edges by id without relying on current selection', () => {
    const session = createEditorSession()
    session.load(documentWithEdge())
    session.selectOnly('root')

    session.setEdgeStyle('root->child', { colorToken: 'warning' })

    expect(session.getState().document?.edges[0].style.colorToken).toBe('warning')
    expect(session.getState().selectedNodeIds).toEqual(['root'])
    expect(session.getState().selectedEdgeId).toBeNull()

    session.deleteEdge('root->child')

    expect(session.getState().document?.edges).toEqual([])
    expect(session.getState().document?.nodes.map((node) => node.id)).toEqual(['root', 'child'])
    expect(session.getState().selectedNodeIds).toEqual(['root'])
    expect(session.getState().selectedEdgeId).toBeNull()
  })
```

- [ ] **Step 2: Run the failing engine-session tests**

Run:

```bash
npm test -- packages/mind-engine/src/__tests__/editorSession.test.ts
```

Expected: FAIL with TypeScript or runtime errors that `setNodeShellStyle`, `setNodeContentStyle`, `setEdgeStyle`, and `deleteEdge` do not exist.

- [ ] **Step 3: Extend `EditorSession` types**

In `packages/mind-engine/src/editorSession/types.ts`, add these methods next to the selected-object methods:

```ts
  deleteEdge(edgeId: string): void
  setEdgeStyle(edgeId: string, stylePatch: Partial<EdgeStyle>): void
  setNodeContentStyle(nodeId: string, stylePatch: Record<string, unknown>): void
  setNodeShellStyle(nodeId: string, stylePatch: Partial<NodeShellStyle>): void
```

Keep the existing `setSelectedEdgeStyle`, `setSelectedNodeContentStyle`, and `setSelectedNodeShellStyle` methods.

- [ ] **Step 4: Implement target-by-id methods in the editor session**

In `packages/mind-engine/src/editorSession/session.ts`, factor the selected-object methods through target-by-id functions. The implementation should preserve no-op style checks and pending-preview finalization.

Add these local functions before the returned `EditorSession` object:

```ts
  function deleteEdge(edgeId: string): void {
    if (!state.document) {
      return
    }

    finalizePendingPreview()
    if (!state.document.edges.some((edge) => edge.id === edgeId)) {
      if (state.selectedEdgeId === edgeId) {
        setState((draft) => {
          draft.selectedEdgeId = null
          draft.revision += 1
        })
      }
      return
    }

    if (state.selectedEdgeId === edgeId) {
      setState((draft) => {
        draft.selectedEdgeId = null
      })
    }
    commitCommandResult(executeCommand(cloneDocument(state.document), deleteEdgeDetachChildCommand, { edgeId }))
  }

  function setEdgeStyle(edgeId: string, stylePatch: Partial<EdgeStyle>): void {
    if (!state.document) {
      return
    }

    const edge = state.document.edges.find((candidate) => candidate.id === edgeId)
    if (!edge) {
      if (state.selectedEdgeId === edgeId) {
        setState((draft) => {
          draft.selectedEdgeId = null
          draft.revision += 1
        })
      }
      return
    }

    if (isStylePatchNoop(edge.style, stylePatch)) {
      return
    }

    finalizePendingPreview()
    commitCommandResult(
      executeCommand(cloneDocument(state.document), setEdgeStyleCommand, {
        edgeId,
        stylePatch
      })
    )
  }

  function setNodeShellStyle(nodeId: string, stylePatch: Partial<NodeShellStyle>): void {
    if (!state.document) {
      return
    }

    const node = state.document.nodes.find((candidate) => candidate.id === nodeId)
    if (!node) {
      if (state.selectedNodeIds.includes(nodeId)) {
        setState((draft) => {
          draft.selectedNodeIds = compactSelection(draft.document, draft.selectedNodeIds)
          draft.revision += 1
        })
      }
      return
    }

    if (isStylePatchNoop(node.shellStyle, stylePatch)) {
      return
    }

    finalizePendingPreview()
    commitCommandResult(
      executeCommand(cloneDocument(state.document), setNodeShellStyleCommand, {
        nodeId,
        stylePatch
      })
    )
  }

  function setNodeContentStyle(nodeId: string, stylePatch: Record<string, unknown>): void {
    if (!state.document) {
      return
    }

    const node = state.document.nodes.find((candidate) => candidate.id === nodeId)
    if (!node) {
      if (state.selectedNodeIds.includes(nodeId)) {
        setState((draft) => {
          draft.selectedNodeIds = compactSelection(draft.document, draft.selectedNodeIds)
          draft.revision += 1
        })
      }
      return
    }

    if (isStylePatchNoop(node.contentStyle, stylePatch)) {
      return
    }

    finalizePendingPreview()
    commitCommandResult(
      executeCommand(cloneDocument(state.document), setNodeContentStyleCommand, {
        nodeId,
        stylePatch
      })
    )
  }
```

Add these shorthand entries to the returned object:

```ts
    deleteEdge,
    setEdgeStyle,
    setNodeContentStyle,
    setNodeShellStyle,
```

Then replace the bodies of the selected-object wrappers in the returned object with:

```ts
    setSelectedEdgeStyle(stylePatch: Partial<EdgeStyle>) {
      if (!state.selectedEdgeId) {
        return
      }

      setEdgeStyle(state.selectedEdgeId, stylePatch)
    },
    setSelectedNodeShellStyle(stylePatch: Partial<NodeShellStyle>) {
      if (state.selectedNodeIds.length !== 1) {
        return
      }

      setNodeShellStyle(state.selectedNodeIds[0], stylePatch)
    },
    setSelectedNodeContentStyle(stylePatch: Record<string, unknown>) {
      if (state.selectedNodeIds.length !== 1) {
        return
      }

      setNodeContentStyle(state.selectedNodeIds[0], stylePatch)
    },
```

- [ ] **Step 5: Add store adapter tests for target-by-id methods**

In `apps/web/src/features/editor/__tests__/editor.store.test.ts`, add this test after `delegates generic node actions to the engine session and syncs fields after each action`:

```ts
  it('delegates target-specific style and edge delete actions', () => {
    const store = useEditorStore()
    store.load(
      emptyDocument({
        nodes: [
          topicNode('root', 'Root', { x: 0, y: 0 }),
          topicNode('child', 'Child', { x: 240, y: 0 })
        ],
        edges: [{ id: 'root->child', source: 'root', target: 'child', type: 'mind-parent', style: DEFAULT_EDGE_STYLE }]
      })
    )
    store.selectOnly('child')

    store.setNodeShellStyle('root', { colorToken: 'purple' })
    store.setNodeContentStyle('root', { textWeight: 'bold' })
    store.setEdgeStyle('root->child', { colorToken: 'warning' })

    const root = store.document?.nodes.find((node) => node.id === 'root')
    expect(root?.shellStyle.colorToken).toBe('purple')
    expect(root?.contentStyle).toMatchObject({ textWeight: 'bold' })
    expect(store.document?.edges[0].style.colorToken).toBe('warning')
    expect(store.selectedNodeIds).toEqual(['child'])

    store.deleteEdge('root->child')

    expect(store.document?.edges).toEqual([])
    expect(store.document?.nodes.map((node) => node.id)).toEqual(['root', 'child'])
  })
```

- [ ] **Step 6: Expose target-by-id methods from the Pinia store**

In `apps/web/src/features/editor/stores/editor.ts`, add these functions next to the selected-object style functions:

```ts
  function deleteEdge(edgeId: string): void {
    session.deleteEdge(edgeId)
    syncFromSession()
  }

  function setEdgeStyle(edgeId: string, stylePatch: Partial<EdgeStyle>): void {
    session.setEdgeStyle(edgeId, stylePatch)
    syncFromSession()
  }

  function setNodeShellStyle(nodeId: string, stylePatch: Partial<NodeShellStyle>): void {
    session.setNodeShellStyle(nodeId, stylePatch)
    syncFromSession()
  }

  function setNodeContentStyle(nodeId: string, stylePatch: Record<string, unknown>): void {
    session.setNodeContentStyle(nodeId, stylePatch)
    syncFromSession()
  }
```

Add `deleteEdge`, `setEdgeStyle`, `setNodeShellStyle`, and `setNodeContentStyle` to the returned store object.

- [ ] **Step 7: Run target-by-id tests**

Run:

```bash
npm test -- packages/mind-engine/src/__tests__/editorSession.test.ts apps/web/src/features/editor/__tests__/editor.store.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit target-by-id APIs**

Run:

```bash
git add packages/mind-engine/src/editorSession/types.ts packages/mind-engine/src/editorSession/session.ts packages/mind-engine/src/__tests__/editorSession.test.ts apps/web/src/features/editor/stores/editor.ts apps/web/src/features/editor/__tests__/editor.store.test.ts
git commit -m "refactor(editor): add target object editing APIs"
```

---

### Task 2: Update Architecture Tests For Double-Click Inspection

**Files:**

- Modify: `apps/web/src/features/editor/__tests__/editorControls.test.ts`
- Modify: `apps/web/src/features/editor/__tests__/edgeRenderer.test.ts`
- Modify: `apps/web/src/features/editor/__tests__/baseNode.test.ts`
- Modify: `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`

- [ ] **Step 1: Update MindEditor source-boundary assertions**

In `apps/web/src/features/editor/__tests__/editorControls.test.ts`, update `routes selected node content and shell style changes from MindEditor` so it checks inspection state rather than selected object rendering:

```ts
    expect(source).toContain("type InspectionTarget =")
    expect(source).toContain("const inspectionTarget = ref<InspectionTarget | null>(null)")
    expect(source).toContain('const inspectedNode = computed<MindNode | null>')
    expect(source).toContain('const inspectedEdge = computed<MindEdge | null>')
    expect(source).toContain("function inspectNode(nodeId: string): void")
    expect(source).toContain("function inspectEdge(edgeId: string): void")
    expect(source).toContain("inspectionTarget.value = { id: nodeId, type: 'node' }")
    expect(source).toContain("inspectionTarget.value = { id: edgeId, type: 'edge' }")
    expect(source).toContain('v-if="inspectedNode"')
    expect(source).toContain(':node="inspectedNode"')
    expect(source).toContain('v-if="inspectedEdge"')
    expect(source).toContain(':style="inspectedEdge.style"')
    expect(source).toContain('@inspect="inspectNode"')
    expect(source).toContain('@inspect="inspectEdge"')
    expect(source).toContain('editor.setNodeShellStyle(inspectedNode.value.id, stylePatch)')
    expect(source).toContain('editor.setNodeContentStyle(inspectedNode.value.id, stylePatch)')
    expect(source).toContain('editor.setEdgeStyle(inspectedEdge.value.id, stylePatch)')
    expect(source).toContain('editor.deleteEdge(inspectedEdge.value.id)')
```

Keep the existing toolbar, add-node, and NodeInspector event wiring assertions that are still valid.

- [ ] **Step 2: Update EdgeRenderer source-boundary assertions**

In `apps/web/src/features/editor/__tests__/edgeRenderer.test.ts`, add a test:

```ts
  it('selects edges on click and inspects edges on double-click', () => {
    const { template } = readEdgeRendererSections()

    expect(template).toContain("@click.stop=\"emit('select', edge.id)\"")
    expect(template).toContain("@dblclick.stop=\"emit('inspect', edge.id)\"")
    expect(template).toContain("data-editor-edge")
    expect(template).toContain(":data-editor-edge-id=\"edge.id\"")
  })
```

- [ ] **Step 3: Update BaseNode source-boundary assertions**

Replace the existing `BaseNode` test body in `apps/web/src/features/editor/__tests__/baseNode.test.ts` with:

```ts
  it('owns the common node shell affordances without owning inline editing', () => {
    const source = readBaseNodeSource()

    expect(source).toContain('data-editor-node')
    expect(source).toContain("inspect: [nodeId: string]")
    expect(source).toContain("@dblclick.stop=\"emit('inspect', node.id)\"")
    expect(source).toContain('base-node__resize-handle')
    expect(source).toContain("emit('resize'")
    expect(source).toContain("emit('drag'")
    expect(source).toContain("emit('select', props.node.id)")
    expect(source).not.toContain('const editing = ref(false)')
    expect(source).not.toContain('function startEditing')
    expect(source).not.toContain('function commitEdit')
    expect(source).not.toContain('function cancelEdit')
    expect(source).not.toContain('base-node__content--blocked')
    expect(source).not.toContain(':editing')
    expect(source).not.toContain(':commit-edit')
    expect(source).not.toContain(':cancel-edit')
  })
```

- [ ] **Step 4: Update NodeRenderer source-boundary assertions**

In `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`, replace the `routes topic title commits and object data patch commits` test with:

```ts
  it('forwards inspect events and content commits without owning edit state', () => {
    const source = readNodeRendererSource()

    expect(source).toContain('inspect: [nodeId: string]')
    expect(source).toContain("@inspect=\"emit('inspect', $event)\"")
    expect(source).toContain("@inspect=\"emit('inspect', node.id)\"")
    expect(source).toContain("emit('editCommit', node.id, dataPatch)")
    expect(source).not.toContain('finishEdit')
    expect(source).not.toContain('commitEdit')
    expect(source).not.toContain('cancelEdit')
    expect(source).not.toContain(':editing')
  })
```

Remove the tests named `keeps task no-op edits on the cancel path` and `keeps oversized code edits out of commit payloads`, because this plan keeps inline editing only in `TopicNodeContent`. Code and task data remain editable through their inspector components.

- [ ] **Step 5: Run updated architecture tests and verify they fail**

Run:

```bash
npm test -- apps/web/src/features/editor/__tests__/editorControls.test.ts apps/web/src/features/editor/__tests__/edgeRenderer.test.ts apps/web/src/features/editor/__tests__/baseNode.test.ts apps/web/src/features/editor/__tests__/nodeRenderer.test.ts
```

Expected: FAIL because the implementation still opens inspectors from selection and `BaseNode` still owns edit state.

- [ ] **Step 6: Commit failing test updates only after implementation starts**

Do not commit this task while tests fail. Leave these changes staged for the implementation tasks, or commit them together with the code that makes them pass.

---

### Task 3: Implement MindEditor Inspection State And Edge Double-Click Wiring

**Files:**

- Modify: `apps/web/src/features/editor/components/MindEditor.vue`
- Modify: `apps/web/src/features/editor/components/canvas/EdgeRenderer.vue`
- Modify: `apps/web/src/features/editor/__tests__/editorControls.test.ts`
- Modify: `apps/web/src/features/editor/__tests__/edgeRenderer.test.ts`

- [ ] **Step 1: Add `inspect` emit to EdgeRenderer**

In `apps/web/src/features/editor/components/canvas/EdgeRenderer.vue`, change the emit definition to:

```ts
const emit = defineEmits<{
  inspect: [edgeId: string]
  select: [edgeId: string]
}>()
```

Add the double-click handler to the transparent hit path:

```vue
          <path
            class="edge-renderer__hit-path"
            :d="getPath(edge) ?? undefined"
            @click.stop="emit('select', edge.id)"
            @dblclick.stop="emit('inspect', edge.id)"
            @pointerdown.stop
            @pointerenter="hoveredEdgeId = edge.id"
            @pointerleave="hoveredEdgeId = hoveredEdgeId === edge.id ? null : hoveredEdgeId"
          />
```

- [ ] **Step 2: Add inspection target state to MindEditor**

In `apps/web/src/features/editor/components/MindEditor.vue`, add this type after `defineEmits`:

```ts
type InspectionTarget =
  | { id: string; type: 'edge' }
  | { id: string; type: 'node' }
```

Add the ref near `inspectorPosition`:

```ts
const inspectionTarget = ref<InspectionTarget | null>(null)
```

Replace the current `selectedNode` and `selectedEdge` computed values with inspected-object computed values:

```ts
const inspectedNode = computed<MindNode | null>(() => {
  if (!documentState.value || inspectionTarget.value?.type !== 'node') {
    return null
  }

  return documentState.value.nodes.find((node) => node.id === inspectionTarget.value?.id) ?? null
})
const inspectedEdge = computed<MindEdge | null>(() => {
  if (!documentState.value || inspectionTarget.value?.type !== 'edge') {
    return null
  }

  return documentState.value.edges.find((edge) => edge.id === inspectionTarget.value?.id) ?? null
})
```

Add a stale-target cleanup watch below the existing document load watch:

```ts
watch(
  [documentState, inspectionTarget],
  () => {
    if (inspectionTarget.value === null) {
      return
    }

    if (inspectionTarget.value.type === 'node' && inspectedNode.value === null) {
      inspectionTarget.value = null
    } else if (inspectionTarget.value.type === 'edge' && inspectedEdge.value === null) {
      inspectionTarget.value = null
    }
  },
  { flush: 'post' }
)
```

- [ ] **Step 3: Add explicit inspect and close handlers**

In `MindEditor.vue`, add these functions near `selectEdge`:

```ts
function inspectNode(nodeId: string): void {
  closeContextMenu()
  editor.selectOnly(nodeId)
  inspectionTarget.value = { id: nodeId, type: 'node' }
}

function inspectEdge(edgeId: string): void {
  closeContextMenu()
  editor.selectEdge(edgeId)
  inspectionTarget.value = { id: edgeId, type: 'edge' }
}

function closeInspector(): void {
  inspectionTarget.value = null
}
```

Update `clearSelectionFromCanvas` so every branch that clears selection also clears inspection:

```ts
function clearSelectionFromCanvas(event: PointerEvent): void {
  const target = event.target
  if (!(target instanceof Element)) {
    editor.clearSelection()
    inspectionTarget.value = null
    return
  }

  if (target.closest('[data-editor-node], [data-editor-edge], [data-editor-control], .editor-toolbar, .editor-context-menu')) {
    return
  }

  editor.clearSelection()
  inspectionTarget.value = null
}
```

- [ ] **Step 4: Retarget inspector edit handlers to inspected objects**

Replace selected-node and selected-edge inspector handlers in `MindEditor.vue` with:

```ts
function setInspectedNodeContent(dataPatch: Record<string, unknown>): void {
  if (!inspectedNode.value) {
    return
  }

  editor.updateNodeData(inspectedNode.value.id, dataPatch)
}

function setInspectedNodeShellStyle(stylePatch: Partial<NodeShellStyle>): void {
  if (!inspectedNode.value) {
    return
  }

  editor.setNodeShellStyle(inspectedNode.value.id, stylePatch)
}

function setInspectedNodeContentStyle(stylePatch: Record<string, unknown>): void {
  if (!inspectedNode.value) {
    return
  }

  editor.setNodeContentStyle(inspectedNode.value.id, stylePatch)
}

function setInspectedEdgeStyle(stylePatch: Partial<EdgeStyle>): void {
  if (!inspectedEdge.value) {
    return
  }

  editor.setEdgeStyle(inspectedEdge.value.id, stylePatch)
}

function deleteInspectedEdgeFromInspector(): void {
  if (!inspectedEdge.value) {
    return
  }

  editor.deleteEdge(inspectedEdge.value.id)
  inspectionTarget.value = null
}
```

- [ ] **Step 5: Update MindEditor template wiring**

Update `EdgeRenderer`, `NodeRenderer`, and `InspectorPanel` wiring in `MindEditor.vue`:

```vue
      <EdgeRenderer
        :edges="documentState.edges"
        :nodes="documentState.nodes"
        :selected-edge-id="editor.selectedEdgeId"
        @inspect="inspectEdge"
        @select="selectEdge"
      />
```

```vue
      <NodeRenderer
        :nodes="documentState.nodes"
        :selected-node-ids="editor.selectedNodeIds"
        @drag="moveNode"
        @drag-end="editor.finishInteraction"
        @edit-commit="editor.updateNodeData"
        @inspect="inspectNode"
        @resize="resizeNode"
        @resize-end="editor.finishInteraction"
        @select="editor.selectOnly"
      />
```

```vue
    <InspectorPanel
      v-if="inspectedNode"
      :position="inspectorPosition"
      title="Node"
      @close="closeInspector"
      @position-change="setInspectorPosition"
    >
      <NodeInspector
        :node="inspectedNode"
        @content-change="setInspectedNodeContent"
        @content-style-change="setInspectedNodeContentStyle"
        @shell-style-change="setInspectedNodeShellStyle"
      />
    </InspectorPanel>

    <InspectorPanel
      v-if="inspectedEdge"
      :position="inspectorPosition"
      title="Edge"
      @close="closeInspector"
      @position-change="setInspectorPosition"
    >
      <EdgeInspector
        :style="inspectedEdge.style"
        @delete="deleteInspectedEdgeFromInspector"
        @style-change="setInspectedEdgeStyle"
      />
    </InspectorPanel>
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- apps/web/src/features/editor/__tests__/editorControls.test.ts apps/web/src/features/editor/__tests__/edgeRenderer.test.ts
```

Expected: PASS for these files after Task 2 test updates and Task 3 implementation are both present.

- [ ] **Step 7: Commit inspection state and edge wiring**

Run:

```bash
git add apps/web/src/features/editor/components/MindEditor.vue apps/web/src/features/editor/components/canvas/EdgeRenderer.vue apps/web/src/features/editor/__tests__/editorControls.test.ts apps/web/src/features/editor/__tests__/edgeRenderer.test.ts
git commit -m "refactor(web): inspect objects on double click"
```

---

### Task 4: Refactor BaseNode And NodeRenderer Event Flow

**Files:**

- Modify: `apps/web/src/features/editor/components/canvas/BaseNode.vue`
- Modify: `apps/web/src/features/editor/components/canvas/NodeRenderer.vue`
- Modify: `apps/web/src/features/editor/__tests__/baseNode.test.ts`
- Modify: `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`

- [ ] **Step 1: Refactor BaseNode emits and remove edit state**

In `apps/web/src/features/editor/components/canvas/BaseNode.vue`, remove `ref` from the Vue import:

```ts
import { computed, ref } from 'vue'
```

becomes:

```ts
import { computed } from 'vue'
```

Change the emit definition to:

```ts
const emit = defineEmits<{
  drag: [nodeId: string, delta: Point]
  dragEnd: []
  inspect: [nodeId: string]
  resize: [nodeId: string, delta: { width: number; height: number }]
  resizeEnd: []
  select: [nodeId: string]
}>()
```

Delete these declarations and functions:

```ts
const editing = ref(false)

function startEditing(): void {
  editing.value = true
}

function commitEdit(payload: unknown): void {
  editing.value = false
  emit('editCommit', props.node.id, payload)
}

function cancelEdit(): void {
  editing.value = false
  emit('cancelEdit', props.node.id)
}
```

Remove the early `editing.value` returns from `onPointerDown` and `onResizePointerDown`.

- [ ] **Step 2: Refactor BaseNode template**

Replace the root and content slot in `BaseNode.vue` with:

```vue
  <div
    class="base-node"
    data-editor-node
    :data-editor-node-id="node.id"
    :class="nodeClass"
    :style="nodeStyle"
    @dblclick.stop="emit('inspect', node.id)"
    @pointercancel="endDrag"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="endDrag"
  >
    <div class="base-node__content">
      <slot />
    </div>
    <span
      aria-hidden="true"
      class="base-node__resize-handle"
      @pointercancel="endResize"
      @pointerdown="onResizePointerDown"
      @pointermove="onResizePointerMove"
      @pointerup="endResize"
    />
  </div>
```

Delete this CSS rule entirely:

```css
.base-node__content--blocked {
  pointer-events: none;
}
```

- [ ] **Step 3: Refactor NodeRenderer emits and content commit handling**

In `apps/web/src/features/editor/components/canvas/NodeRenderer.vue`, change the emits to:

```ts
const emit = defineEmits<{
  drag: [nodeId: string, delta: Point]
  dragEnd: []
  editCommit: [nodeId: string, dataPatch: Record<string, unknown>]
  inspect: [nodeId: string]
  resize: [nodeId: string, delta: { width: number; height: number }]
  resizeEnd: []
  select: [nodeId: string]
}>()
```

Replace `onContentCommit` and `handleContentCommit` with:

```ts
function onContentCommit(node: MindNode, payload: unknown): void {
  if (isDataPatch(payload)) {
    emit('editCommit', node.id, payload)
  }
}
```

- [ ] **Step 4: Refactor NodeRenderer template**

Replace the `BaseNode` block in `NodeRenderer.vue` with:

```vue
    <BaseNode
      :node="node"
      :selected="selectedNodeIds.includes(node.id)"
      @drag="(nodeId, delta) => emit('drag', nodeId, delta)"
      @drag-end="emit('dragEnd')"
      @inspect="emit('inspect', $event)"
      @resize="(nodeId, delta) => emit('resize', nodeId, delta)"
      @resize-end="emit('resizeEnd')"
      @select="emit('select', $event)"
    >
      <component
        :is="getContentComponent(node)"
        :node="node"
        @commit="onContentCommit(node, $event)"
        @inspect="emit('inspect', node.id)"
      />
    </BaseNode>
```

- [ ] **Step 5: Run focused shell/renderer tests**

Run:

```bash
npm test -- apps/web/src/features/editor/__tests__/baseNode.test.ts apps/web/src/features/editor/__tests__/nodeRenderer.test.ts
```

Expected: PASS after the Task 2 test updates and Task 4 implementation are both present, except for failures caused by content components still expecting `editing`; those are resolved in Task 5.

- [ ] **Step 6: Commit BaseNode and NodeRenderer flow**

Run this after Task 5 also passes, because `NodeRenderer.vue` and content contracts must stay in one working commit if TypeScript fails between them:

```bash
git add apps/web/src/features/editor/components/canvas/BaseNode.vue apps/web/src/features/editor/components/canvas/NodeRenderer.vue apps/web/src/features/editor/__tests__/baseNode.test.ts apps/web/src/features/editor/__tests__/nodeRenderer.test.ts
git commit -m "refactor(web): move node edit ownership into content"
```

---

### Task 5: Move Inline Editing Into TopicNodeContent And Simplify Other Content

**Files:**

- Modify: `apps/web/src/features/editor/components/canvas/node-content/TopicNodeContent.vue`
- Modify: `apps/web/src/features/editor/components/canvas/node-content/ImageNodeContent.vue`
- Modify: `apps/web/src/features/editor/components/canvas/node-content/LinkNodeContent.vue`
- Modify: `apps/web/src/features/editor/components/canvas/node-content/AttachmentNodeContent.vue`
- Modify: `apps/web/src/features/editor/components/canvas/node-content/CodeNodeContent.vue`
- Modify: `apps/web/src/features/editor/components/canvas/node-content/TaskNodeContent.vue`
- Modify: `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`

- [ ] **Step 1: Refactor TopicNodeContent props and emits**

In `TopicNodeContent.vue`, change props and emits to:

```ts
const props = defineProps<{
  node: TopicNodeModel
}>()

const emit = defineEmits<{
  commit: [dataPatch: { title: string }]
  inspect: []
}>()
```

Add local editing state:

```ts
const editing = ref(false)
```

Replace the existing `watch(() => props.editing, ...)` with:

```ts
async function startEditing(): Promise<void> {
  editError.value = ''
  draftTitle.value = props.node.data.title
  editing.value = true
  emit('inspect')
  await nextTick()
  titleInputRef.value?.focus()
  titleInputRef.value?.select()
}
```

Keep the existing watch that syncs `draftTitle` from `props.node.data.title` when not editing.

- [ ] **Step 2: Refactor TopicNodeContent commit and cancel**

In `TopicNodeContent.vue`, replace commit and cancel with:

```ts
async function commitEdit(): Promise<void> {
  const title = draftTitle.value.trim()
  const error = validateTitle(title)
  if (error) {
    editError.value = error
    await nextTick()
    titleInputRef.value?.focus()
    return
  }

  editError.value = ''
  editing.value = false
  if (title.length > 0 && title !== props.node.data.title) {
    emit('commit', { title })
  } else {
    draftTitle.value = props.node.data.title
  }
}

function cancelEdit(): void {
  editError.value = ''
  editing.value = false
  draftTitle.value = props.node.data.title
}
```

- [ ] **Step 3: Refactor TopicNodeContent template**

In `TopicNodeContent.vue`, add the double-click handler to the content root and keep the existing edit UI under local state:

```vue
  <div class="topic-node__content" :class="contentClass" @dblclick.stop="startEditing">
    <template v-if="editing">
      <input
        ref="titleInputRef"
        v-model="draftTitle"
        :aria-invalid="editError.length > 0"
        class="topic-node__input"
        maxlength="120"
        @blur="commitEdit"
        @input="editError = ''"
        @keydown.enter.prevent="commitEdit"
        @keydown.esc.prevent="cancelEdit"
        @pointerdown.stop
      />
      <span v-if="editError" class="topic-node__error">{{ editError }}</span>
    </template>
    <span v-else class="topic-node__title">{{ node.data.title }}</span>
  </div>
```

- [ ] **Step 4: Simplify ImageNodeContent to read-only content**

In `ImageNodeContent.vue`, remove `nextTick`, `ref`, and `watch` imports and all draft/edit state. The script should be:

```vue
<script setup lang="ts">
import type { MindNode } from '@mind-x/shared'
import { computed } from 'vue'

type ImageNodeModel = Extract<MindNode, { type: 'image' }>

const props = defineProps<{
  node: ImageNodeModel
}>()

const objectFit = computed(() => props.node.contentStyle.objectFit)
</script>
```

The template should render only the image:

```vue
<template>
  <div class="image-node__content">
    <img
      class="image-node__image"
      :alt="node.data.alt ?? ''"
      :src="node.data.url"
      :style="{ objectFit }"
    />
  </div>
</template>
```

Remove `.image-node__input` and `.image-node__error` CSS rules.

- [ ] **Step 5: Simplify LinkNodeContent and prevent navigation**

In `LinkNodeContent.vue`, remove `nextTick`, `ref`, `watch`, all draft/edit state, and the `commit/cancel` emits. The props should be:

```ts
const props = defineProps<{
  node: LinkNodeModel
}>()
```

The template should be:

```vue
<template>
  <div class="link-node__content">
    <a
      class="link-node__anchor"
      :href="node.data.url"
      rel="noopener noreferrer"
      target="_blank"
      @click.prevent
    >
      <span class="link-node__title">{{ node.data.title }}</span>
      <span class="link-node__url">{{ node.data.url }}</span>
    </a>
  </div>
</template>
```

Remove `.link-node__input`, `.link-node__input--title`, and `.link-node__error` CSS rules.

- [ ] **Step 6: Simplify AttachmentNodeContent and prevent navigation**

In `AttachmentNodeContent.vue`, remove `nextTick`, `ref`, `watch`, all draft/edit state, and the `commit/cancel` emits. The props should be:

```ts
const props = defineProps<{
  node: AttachmentNodeModel
}>()
```

The template should be:

```vue
<template>
  <div class="attachment-node__content">
    <a
      class="attachment-node__link"
      :href="node.data.url"
      rel="noopener noreferrer"
      target="_blank"
      @click.prevent
    >
      <span aria-hidden="true" class="attachment-node__icon">FILE</span>
      <span class="attachment-node__meta">
        <span class="attachment-node__name">{{ node.data.fileName }}</span>
        <span v-if="node.data.fileSizeLabel" class="attachment-node__size">{{ node.data.fileSizeLabel }}</span>
        <span class="attachment-node__url">{{ node.data.url }}</span>
      </span>
    </a>
  </div>
</template>
```

Remove `.attachment-node__input`, `.attachment-node__input--name`, and `.attachment-node__error` CSS rules.

- [ ] **Step 7: Simplify CodeNodeContent to read-only content**

In `CodeNodeContent.vue`, remove `CODE_NODE_CODE_MAX_LENGTH`, `nextTick`, `ref`, `watch`, `isValidCode`, all draft/edit state, and the `commit/cancel` emits. Keep highlighting:

```ts
import type { MindNode } from '@mind-x/shared'
import { computed } from 'vue'
import { highlightCode } from '../../../utils/codeHighlight'
```

Use props only:

```ts
const props = defineProps<{
  node: CodeNodeModel
}>()
```

The template should render only:

```vue
<template>
  <div class="code-node__content">
    <pre class="code-node__pre" :class="wrapClass"><code :class="codeClass" v-html="highlighted.html" /></pre>
  </div>
</template>
```

Remove `.code-node__textarea` and `.code-node__error` CSS rules. Keep `.code-node__pre`, `.code-node__code--wrap`, `.hljs`, and syntax color rules.

- [ ] **Step 8: Simplify TaskNodeContent to read-only content**

In `TaskNodeContent.vue`, remove `nextTick`, `ref`, `watch`, `TaskItem`, draft state, validation, replacement, commit, cancel, and `commit/cancel` emits. Use props only:

```ts
const props = defineProps<{
  node: TaskNodeModel
}>()
```

The template should render only:

```vue
<template>
  <div class="task-node__content" :class="`task-node__content--${node.contentStyle.density}`">
    <div v-for="item in node.data.items" :key="item.id" class="task-node__item">
      <input class="task-node__checkbox" :checked="item.done" disabled type="checkbox" />
      <span class="task-node__title" :class="{ 'task-node__title--done': item.done }">{{ item.title }}</span>
    </div>
  </div>
</template>
```

Remove `.task-node__item--editing`, `.task-node__input`, `.task-node__done`, and `.task-node__error` CSS rules.

- [ ] **Step 9: Add TopicNodeContent source-boundary coverage**

In `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`, add:

```ts
function readTopicNodeContentSource(): string {
  return readFileSync(new URL('../components/canvas/node-content/TopicNodeContent.vue', import.meta.url), 'utf8')
}
```

Add this test:

```ts
  it('keeps topic inline editing inside TopicNodeContent', () => {
    const source = readTopicNodeContentSource()

    expect(source).toContain('const editing = ref(false)')
    expect(source).toContain('function startEditing')
    expect(source).toContain("emit('inspect')")
    expect(source).toContain("@dblclick.stop=\"startEditing\"")
    expect(source).toContain("emit('commit', { title })")
    expect(source).not.toContain('editing: boolean')
  })
```

- [ ] **Step 10: Run focused content and renderer tests**

Run:

```bash
npm test -- apps/web/src/features/editor/__tests__/nodeRenderer.test.ts apps/web/src/features/editor/__tests__/baseNode.test.ts
```

Expected: PASS.

- [ ] **Step 11: Commit content ownership changes**

If Task 4 was not committed because TypeScript needed content changes too, include Task 4 files in this commit:

```bash
git add apps/web/src/features/editor/components/canvas/BaseNode.vue apps/web/src/features/editor/components/canvas/NodeRenderer.vue apps/web/src/features/editor/components/canvas/node-content/TopicNodeContent.vue apps/web/src/features/editor/components/canvas/node-content/ImageNodeContent.vue apps/web/src/features/editor/components/canvas/node-content/LinkNodeContent.vue apps/web/src/features/editor/components/canvas/node-content/AttachmentNodeContent.vue apps/web/src/features/editor/components/canvas/node-content/CodeNodeContent.vue apps/web/src/features/editor/components/canvas/node-content/TaskNodeContent.vue apps/web/src/features/editor/__tests__/baseNode.test.ts apps/web/src/features/editor/__tests__/nodeRenderer.test.ts
git commit -m "refactor(web): let node content own inline editing"
```

---

### Task 6: Final Verification

**Files:**

- Verify repository state.

- [ ] **Step 1: Run guard searches**

Run:

```bash
rg -n "const selectedNode|const selectedEdge|v-if=\"selectedNode|v-if=\"selectedEdge|:node=\"selectedNode|:style=\"selectedEdge" apps/web/src/features/editor/components/MindEditor.vue
rg -n "editRequest|finishEdit|commitEdit|cancelEdit|base-node__content--blocked|:editing" apps/web/src/features/editor/components/canvas
rg -n "@click.stop=\"emit\\('select', edge.id\\)\" apps/web/src/features/editor/components/canvas/EdgeRenderer.vue
rg -n "@dblclick.stop=\"emit\\('inspect', edge.id\\)\" apps/web/src/features/editor/components/canvas/EdgeRenderer.vue
```

Expected:

- First command has no output.
- Second command has no output, except `commitEdit` is allowed inside `TopicNodeContent.vue`.
- Third command shows the edge select handler.
- Fourth command shows the edge inspect handler.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: Check git status**

Run:

```bash
git status --short
```

Expected: no uncommitted implementation changes.

If documentation-only changes remain because this plan or the spec status was updated after the implementation commits, commit them with:

```bash
git add docs/superpowers/specs/2026-04-29-node-edge-double-click-inspector-design.md docs/superpowers/plans/2026-04-29-node-edge-double-click-inspector.md
git commit -m "docs: plan double-click inspector interactions"
```

---

## Self-Review

- Spec coverage: Tasks cover selection vs inspection state, node and edge double-click inspection, close/empty-canvas lifecycle, stale inspected object cleanup, target-by-id inspector edits, BaseNode edit removal, TopicNodeContent inline editing ownership, non-topic read-only content, and verification.
- Placeholder scan: This plan has no placeholder task names or deferred implementation steps.
- Type consistency: The plan consistently uses `InspectionTarget`, `inspectionTarget`, `inspectedNode`, `inspectedEdge`, `inspectNode`, `inspectEdge`, `setNodeShellStyle`, `setNodeContentStyle`, `setEdgeStyle`, and `deleteEdge`.
