<script setup lang="ts">
import type { EdgeStyle, MindDocument, MindEdge, MindNode, Point, TopicNodeStyle } from '@mind-x/shared'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useEditorStore } from '@/features/editor/stores/editor'
import EdgeInspector from './inspectors/EdgeInspector.vue'
import EdgeRenderer from './canvas/EdgeRenderer.vue'
import EditorContextMenu from './context-menu/EditorContextMenu.vue'
import EditorToolbar from './toolbar/EditorToolbar.vue'
import InspectorPanel from './inspectors/InspectorPanel.vue'
import { readStoredInspectorPosition, writeStoredInspectorPosition } from '../utils/inspectorPosition'
import { isTextEditingTarget } from '../utils/keyboardTargets'
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

const documentState = computed(() => editor.document)
const hasDocument = computed(() => documentState.value !== null)
const hasNodes = computed(() => (documentState.value?.nodes.length ?? 0) > 0)
const hasSelection = computed(() => editor.selectedNodeIds.length > 0)
const hasDeletableSelection = computed(() => hasSelection.value || editor.selectedEdgeId !== null)
const selectedNode = computed<MindNode | null>(() => {
  if (!documentState.value || editor.selectedNodeIds.length !== 1) {
    return null
  }

  return documentState.value.nodes.find((node) => node.id === editor.selectedNodeIds[0]) ?? null
})
const selectedEdge = computed<MindEdge | null>(() => {
  if (!documentState.value || !editor.selectedEdgeId) {
    return null
  }

  return documentState.value.edges.find((edge) => edge.id === editor.selectedEdgeId) ?? null
})

watch(
  () => props.document,
  (document) => editor.load(document),
  { immediate: true }
)

function addTopic(): void {
  editor.addRootTopic({ title: 'Central topic' })
}

function addChild(): void {
  editor.addChildTopic({ title: 'New topic' })
}

function moveNode(nodeId: string, delta: Point): void {
  if (!editor.selectedNodeIds.includes(nodeId)) {
    editor.selectOnly(nodeId)
  }
  editor.previewMoveSelectedByScreenDelta(delta)
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

function setInspectorPosition(position: Point): void {
  inspectorPosition.value = position
  writeStoredInspectorPosition(position)
}

function setSelectedNodeStyle(stylePatch: Partial<TopicNodeStyle>): void {
  editor.setSelectedNodeStyle(stylePatch)
}

function setSelectedEdgeStyle(stylePatch: Partial<EdgeStyle>): void {
  editor.setSelectedEdgeStyle(stylePatch)
}

function deleteSelectedEdgeFromInspector(): void {
  editor.deleteSelected()
}

function addChildFromContextMenu(): void {
  addChild()
  closeContextMenu()
}

function deleteFromContextMenu(): void {
  editor.deleteSelected()
  closeContextMenu()
}

function onKeydown(event: KeyboardEvent): void {
  if (isTextEditingTarget(event.target)) {
    return
  }

  if (event.key === 'Tab' && hasSelection.value) {
    event.preventDefault()
    addChild()
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

    <InspectorPanel
      v-if="selectedNode"
      :position="inspectorPosition"
      title="Node"
      @close="editor.clearSelection"
      @position-change="setInspectorPosition"
    >
      <NodeInspector :style="selectedNode.style" @style-change="setSelectedNodeStyle" />
    </InspectorPanel>

    <InspectorPanel
      v-if="selectedEdge"
      :position="inspectorPosition"
      title="Edge"
      @close="editor.clearSelection"
      @position-change="setInspectorPosition"
    >
      <EdgeInspector
        :style="selectedEdge.style"
        @delete="deleteSelectedEdgeFromInspector"
        @style-change="setSelectedEdgeStyle"
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
