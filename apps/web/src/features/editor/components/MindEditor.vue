<script setup lang="ts">
import type { EdgeStyle, MindDocument, MindEdge, MindNode, MindNodeType, Point } from '@mind-x/shared'
import type { NodeShellStyle } from '@mind-x/shared'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useEditorStore } from '@/features/editor/stores/editor'
import EdgeInspector from './inspectors/EdgeInspector.vue'
import EdgeRenderer from './canvas/EdgeRenderer.vue'
import EditorContextMenu from './context-menu/EditorContextMenu.vue'
import EditorToolbar from './toolbar/EditorToolbar.vue'
import InspectorPanel from './inspectors/InspectorPanel.vue'
import { readStoredInspectorPosition, writeStoredInspectorPosition } from '../utils/inspectorPosition'
import { isEditorShortcutTarget } from '../utils/keyboardTargets'
import NodeInspector from './inspectors/NodeInspector.vue'
import NodeRenderer from './canvas/NodeRenderer.vue'
import SelectionLayer from './canvas/SelectionLayer.vue'
import ViewportPane from './canvas/ViewportPane.vue'

const props = defineProps<{
  document: MindDocument
}>()

const emit = defineEmits<{
  exportPng: [root: HTMLElement, document: MindDocument]
  save: [document: MindDocument]
}>()

type InspectionTarget =
  | { id: string; type: 'edge' }
  | { id: string; type: 'node' }

const editor = useEditorStore()
const editorRootRef = ref<HTMLElement | null>(null)
const viewportPaneRef = ref<{ getExportRoot: () => HTMLElement | null } | null>(null)
const contextMenu = reactive({
  selectionActions: false,
  visible: false,
  x: 0,
  y: 0
})
const inspectorPosition = ref<Point>(readStoredInspectorPosition())
const inspectionTarget = ref<InspectionTarget | null>(null)

const documentState = computed(() => editor.document)
const hasDocument = computed(() => documentState.value !== null)
const hasNodes = computed(() => (documentState.value?.nodes.length ?? 0) > 0)
const hasSelection = computed(() => editor.selectedNodeIds.length > 0)
const hasDeletableSelection = computed(() => hasSelection.value || editor.selectedEdgeId !== null)
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

watch(
  () => props.document,
  (document) => editor.load(document),
  { immediate: true }
)

watch([documentState, () => editor.revision], () => {
  const target = inspectionTarget.value
  if (!target) {
    return
  }

  if (!documentState.value) {
    inspectionTarget.value = null
    return
  }

  const targetExists =
    target.type === 'node'
      ? documentState.value.nodes.some((node) => node.id === target.id)
      : documentState.value.edges.some((edge) => edge.id === target.id)

  if (!targetExists) {
    inspectionTarget.value = null
  }
})

function addTopic(type: MindNodeType = 'topic'): void {
  editor.addRootNode({ type })
}

function addChild(type: MindNodeType = 'topic'): void {
  editor.addChildNode({ type })
}

function moveNode(nodeId: string, delta: Point): void {
  if (!editor.selectedNodeIds.includes(nodeId)) {
    editor.selectOnly(nodeId)
  }
  editor.previewMoveSelectedByScreenDelta(delta)
}

function resizeNode(nodeId: string, delta: { width: number; height: number }): void {
  if (!editor.selectedNodeIds.includes(nodeId)) {
    editor.selectOnly(nodeId)
  }
  editor.previewResizeSelectedByDelta(delta)
}

function save(): void {
  if (!editor.document) {
    return
  }

  emit('save', editor.document)
}

function exportPng(): void {
  const exportRoot = viewportPaneRef.value?.getExportRoot()
  if (!exportRoot || !editor.document) {
    return
  }

  emit('exportPng', exportRoot, editor.document)
}

function closeContextMenu(): void {
  contextMenu.visible = false
}

function openContextMenu(event: MouseEvent): void {
  const bounds = editorRootRef.value?.getBoundingClientRect()
  const nodeElement =
    event.target instanceof Element ? event.target.closest<HTMLElement>('[data-editor-node]') : null
  const nodeId = nodeElement?.dataset.editorNodeId
  if (nodeId) {
    editor.selectOnly(nodeId)
  } else {
    editor.clearSelection()
  }

  contextMenu.selectionActions = Boolean(nodeId)
  contextMenu.x = event.clientX - (bounds?.left ?? 0)
  contextMenu.y = event.clientY - (bounds?.top ?? 0)
  contextMenu.visible = true
}

function selectEdge(edgeId: string): void {
  closeContextMenu()
  editor.selectEdge(edgeId)
}

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

function setInspectorPosition(position: Point): void {
  inspectorPosition.value = position
  writeStoredInspectorPosition(position)
}

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

function addChildFromContextMenu(type: MindNodeType): void {
  addChild(type)
  closeContextMenu()
}

function deleteFromContextMenu(): void {
  editor.deleteSelected()
  closeContextMenu()
}

function onKeydown(event: KeyboardEvent): void {
  if (isEditorShortcutTarget(event.target)) {
    return
  }

  if (event.key === 'Tab' && hasSelection.value) {
    event.preventDefault()
    addChild('topic')
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    editor.deleteSelected()
  } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && event.shiftKey) {
    event.preventDefault()
    editor.redo()
  } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    editor.undo()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <section ref="editorRootRef" class="mind-editor" aria-label="Mind map editor">
    <div class="mind-editor__toolbar">
      <EditorToolbar
        :can-redo="editor.canRedo"
        :can-undo="editor.canUndo"
        :dirty="editor.dirty"
        :has-document="hasDocument"
        :has-deletable-selection="hasDeletableSelection"
        :has-nodes="hasNodes"
        :has-selection="hasSelection"
        @add-child="addChild"
        @add-topic="addTopic"
        @delete="editor.deleteSelected"
        @export-png="exportPng"
        @redo="editor.redo"
        @save="save"
        @undo="editor.undo"
      />
    </div>

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
        @inspect="inspectEdge"
        @select="selectEdge"
      />
      <SelectionLayer :nodes="documentState.nodes" :selected-node-ids="editor.selectedNodeIds" />
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
    </ViewportPane>

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

    <EditorContextMenu
      :can-add-child="contextMenu.selectionActions && hasSelection"
      :can-delete="contextMenu.selectionActions && hasSelection"
      :visible="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      @add-child="addChildFromContextMenu"
      @close="closeContextMenu"
      @delete="deleteFromContextMenu"
    />
  </section>
</template>

<style scoped>
.mind-editor {
  position: relative;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  height: calc(100vh - 65px);
  min-height: calc(100vh - 65px);
  overflow: hidden;
  background: var(--color-canvas);
}

.mind-editor__toolbar {
  position: relative;
  z-index: 20;
  padding: 16px;
}
</style>
