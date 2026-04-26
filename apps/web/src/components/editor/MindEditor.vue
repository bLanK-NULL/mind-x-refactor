<script setup lang="ts">
import type { MindDocument, Point } from '@mind-x/shared'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useEditorStore } from '@/stores/editor'
import EdgeRenderer from './EdgeRenderer.vue'
import EditorContextMenu from './EditorContextMenu.vue'
import EditorToolbar from './EditorToolbar.vue'
import NodeRenderer from './NodeRenderer.vue'
import SelectionLayer from './SelectionLayer.vue'
import ViewportPane from './ViewportPane.vue'

const props = defineProps<{
  document: MindDocument
}>()

const emit = defineEmits<{
  save: [document: MindDocument]
}>()

const editor = useEditorStore()
const editorRootRef = ref<HTMLElement | null>(null)
const contextMenu = reactive({
  selectionActions: false,
  visible: false,
  x: 0,
  y: 0
})

const documentState = computed(() => editor.document)
const hasDocument = computed(() => documentState.value !== null)
const hasNodes = computed(() => (documentState.value?.nodes.length ?? 0) > 0)
const hasSelection = computed(() => editor.selectedNodeIds.length > 0)

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

function addChildFromContextMenu(): void {
  addChild()
  closeContextMenu()
}

function deleteFromContextMenu(): void {
  editor.deleteSelected()
  closeContextMenu()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    return
  }

  if (event.key === 'Tab' && hasSelection.value) {
    event.preventDefault()
    addChild()
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
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
        :has-nodes="hasNodes"
        :has-selection="hasSelection"
        @add-child="addChild"
        @add-topic="addTopic"
        @delete="editor.deleteSelected"
        @redo="editor.redo"
        @save="save"
        @undo="editor.undo"
      />
    </div>

    <ViewportPane
      v-if="documentState"
      :viewport="documentState.viewport"
      @contextmenu.prevent="openContextMenu"
      @viewport-change="editor.setViewport"
    >
      <EdgeRenderer :edges="documentState.edges" :nodes="documentState.nodes" />
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
  min-height: calc(100vh - 65px);
  overflow: hidden;
  background: #f8fafc;
}

.mind-editor__toolbar {
  position: absolute;
  z-index: 20;
  top: 16px;
  left: 16px;
}
</style>
