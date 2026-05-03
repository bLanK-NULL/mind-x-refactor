import { readFileSync } from 'node:fs'
import type { MindNode } from '@mind-x/shared'
import { renderToString } from '@vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import NodeRenderer from '../components/canvas/NodeRenderer.vue'

function readNodeRendererSource(): string {
  return readFileSync(new URL('../components/canvas/NodeRenderer.vue', import.meta.url), 'utf8')
}

function readTopicNodeContentSource(): string {
  return readFileSync(new URL('../components/canvas/node-content/TopicNodeContent.vue', import.meta.url), 'utf8')
}

function readNodeContentSource(fileName: string): string {
  return readFileSync(new URL(`../components/canvas/node-content/${fileName}.vue`, import.meta.url), 'utf8')
}

function readEditorSource(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

function createImageNode(): Extract<MindNode, { type: 'image' }> {
  return {
    id: 'image-1',
    type: 'image',
    position: { x: 10, y: 20 },
    size: { height: 160, width: 240 },
    shellStyle: {
      borderStyle: 'solid',
      colorToken: 'default',
      shadowLevel: 'sm',
      shape: 'rounded',
      tone: 'soft'
    },
    data: {
      alt: 'Diagram',
      url: 'https://example.com/diagram.png'
    },
    contentStyle: {
      objectFit: 'cover'
    }
  }
}

function createAttachmentNode(): Extract<MindNode, { type: 'attachment' }> {
  return {
    id: 'attachment-1',
    type: 'attachment',
    position: { x: 10, y: 20 },
    size: { height: 72, width: 240 },
    shellStyle: {
      borderStyle: 'solid',
      colorToken: 'default',
      shadowLevel: 'sm',
      shape: 'rounded',
      tone: 'soft'
    },
    data: {
      fileName: 'Brief.pdf',
      fileSizeLabel: '48 KB',
      url: 'https://example.com/brief.pdf'
    },
    contentStyle: {
      icon: 'file'
    }
  }
}

describe('NodeRenderer', () => {
  it('renders nodes through BaseNode and dynamic content components', () => {
    const source = readNodeRendererSource()

    expect(source).toContain("import BaseNode from './BaseNode.vue'")
    expect(source).toContain('contentComponentByType')
    expect(source).toContain('<BaseNode')
    expect(source).toContain('<component')
    expect(source).not.toContain("import TopicNode from './TopicNode.vue'")
  })

  it('imports and maps real content components for every node type', () => {
    const source = readNodeRendererSource()

    for (const component of [
      'AttachmentNodeContent',
      'CodeNodeContent',
      'ImageNodeContent',
      'LinkNodeContent',
      'TaskNodeContent',
      'TopicNodeContent'
    ]) {
      expect(source).toContain(`import ${component}`)
      expect(source).toContain(component)
    }

    expect(source).toContain('attachment: AttachmentNodeContent')
    expect(source).toContain('code: CodeNodeContent')
    expect(source).toContain('image: ImageNodeContent')
    expect(source).toContain('link: LinkNodeContent')
    expect(source).toContain('task: TaskNodeContent')
    expect(source).toContain('topic: TopicNodeContent')
    expect(source).not.toContain('NodeFallbackContent')
    expect(source).not.toContain('node-fallback')
  })

  it('renders image nodes through real image content', async () => {
    const html = await renderToString(
      createSSRApp(NodeRenderer, {
        nodes: [createImageNode()],
        selectedNodeIds: []
      })
    )

    expect(html).toContain('image-node__image')
    expect(html).toContain('https://example.com/diagram.png')
    expect(html).toContain('Diagram')
    expect(html).not.toContain('topic-node__title')
    expect(html).not.toContain('node-fallback')
  })

  it('supports selected image node preview from the Space key', () => {
    const rendererSource = readNodeRendererSource()
    const imageSource = readNodeContentSource('ImageNodeContent')

    expect(rendererSource).toContain('const props = defineProps')
    expect(rendererSource).toContain('function getContentProps(node: MindNode)')
    expect(rendererSource).toContain("node.type === 'image'")
    expect(rendererSource).toContain('selected: props.selectedNodeIds.includes(node.id)')
    expect(rendererSource).toContain('v-bind="getContentProps(node)"')

    expect(imageSource).toContain('selected?: boolean')
    expect(imageSource).toContain('const previewOpen = ref(false)')
    expect(imageSource).toContain('const previewRootRef = ref<HTMLElement | null>(null)')
    expect(imageSource).toContain('const previewDialogRef = ref<HTMLElement | null>(null)')
    expect(imageSource).toContain('function openPreview')
    expect(imageSource).toContain('if (!props.selected)')
    expect(imageSource).toContain('function closePreview')
    expect(imageSource).toContain('function keepPreviewFocus')
    expect(imageSource).toContain("event.key !== 'Tab'")
    expect(imageSource).toContain(':tabindex="selected ? 0 : -1"')
    expect(imageSource).toContain('@keydown.space.prevent.stop="openPreview"')
    expect(imageSource).toContain('@keydown.enter.prevent.stop="openPreview"')
    expect(imageSource).toContain('<Teleport to="body">')
    expect(imageSource).toContain('role="dialog"')
    expect(imageSource).toContain('aria-modal="true"')
    expect(imageSource).toContain('@keydown.esc.prevent.stop="closePreview"')
    expect(imageSource).toContain('@keydown.tab="keepPreviewFocus"')
  })

  it('renders attachment nodes with file name and visible URL', async () => {
    const html = await renderToString(
      createSSRApp(NodeRenderer, {
        nodes: [createAttachmentNode()],
        selectedNodeIds: []
      })
    )

    expect(html).toContain('attachment-node__name')
    expect(html).toContain('Brief.pdf')
    expect(html).toContain('attachment-node__url')
    expect(html).toContain('https://example.com/brief.pdf')
    expect(html).toContain('48 KB')
  })

  it('forwards inspect events and content commits without owning edit state', () => {
    const source = readNodeRendererSource()

    expect(source).toContain('inspect: [nodeId: string]')
    expect(source).toContain("@inspect=\"emit('inspect', $event)\"")
    expect(source).toContain("@inspect=\"emit('inspect', node.id)\"")
    expect(source).toContain("emit('editCommit', node.id, dataPatch)")
    expect(source).not.toContain("typeof payload === 'string'")
    expect(source).not.toContain('finishEdit')
    expect(source).not.toContain('handleContentCommit')
    expect(source).not.toContain('commitEdit')
    expect(source).not.toContain('cancelEdit')
    expect(source).not.toContain(':editing')
  })

  it('keeps topic inline editing inside TopicNodeContent', () => {
    const source = readTopicNodeContentSource()

    expect(source).toContain('const editing = ref(false)')
    expect(source).toContain('function startEditing')
    expect(source).toMatch(/async function startEditing\(\): Promise<void> \{\s+if \(editing\.value\) \{\s+return\s+\}/)
    expect(source).toContain("emit('inspect')")
    expect(source).toContain('@dblclick.stop="startEditing"')
    expect(source).toContain('validateTitle')
    expect(source).toContain('titleInputRef')
    expect(source).toContain('@keydown.enter.prevent="commitEdit"')
    expect(source).toContain('@keydown.esc.prevent="cancelEdit"')
    expect(source).toContain('@pointerdown.stop')
    expect(source).toContain("emit('commit', { title })")
    expect(source).not.toContain('editing: boolean')
    expect(source).not.toContain('selected?: boolean')
    expect(source).not.toContain('previewOpen')
  })

  it('keeps task item interactions inside TaskNodeContent instead of the inspector pane', () => {
    const taskContentSource = readNodeContentSource('TaskNodeContent')
    const taskInspectorSource = readEditorSource('../components/inspectors/node-inspectors/TaskNodeInspector.vue')

    expect(taskContentSource).toContain("type TaskItem = TaskNodeModel['data']['items'][number]")
    expect(taskContentSource).toContain("import { PLAIN_TEXT_MAX_LENGTH, type MindNode } from '@mind-x/shared'")
    expect(taskContentSource).toContain("import { isValidPlainText } from '@mind-x/mind-engine'")
    expect(taskContentSource).toContain('commit: [dataPatch: Record<string, unknown>]')
    expect(taskContentSource).toContain('function createNextTaskId')
    expect(taskContentSource).toContain('function draftTitleFor')
    expect(taskContentSource).toContain('function createDraftItems')
    expect(taskContentSource).toContain('function commitItems')
    expect(taskContentSource).toContain('function addTaskItem')
    expect(taskContentSource).toContain('function deleteTaskItem')
    expect(taskContentSource).toContain('function toggleTaskItem')
    expect(taskContentSource).toContain('function commitTaskTitle')
    expect(taskContentSource).not.toContain('const PLAIN_TEXT_MAX_LENGTH = 500')
    expect(taskContentSource).not.toContain('function cloneItems')
    expect(taskContentSource).toContain('...createDraftItems(),')
    expect(taskContentSource).toContain('commitItems(createDraftItems().filter')
    expect(taskContentSource).toContain('commitItems(createDraftItems().map((item) =>')
    expect(taskContentSource).toContain('commitItems(createDraftItems().map((candidate) =>')
    expect(taskContentSource).toContain("emit('commit', { items: nextItems })")
    expect(taskContentSource).toContain('task-node__input')
    expect(taskContentSource).toContain('task-node__add')
    expect(taskContentSource).toContain('task-node__delete')
    expect(taskContentSource).toContain(':aria-label="`Mark ${draftTitles[item.id] ?? item.title} complete`"')
    expect(taskContentSource).toContain(':aria-label="`Edit task ${draftTitles[item.id] ?? item.title}`"')
    expect(taskContentSource).toContain(':aria-label="`Delete task ${draftTitles[item.id] ?? item.title}`"')
    expect(taskContentSource).toContain('@pointerdown.stop')
    expect(taskContentSource).toContain('@keydown.enter.prevent')
    expect(taskContentSource).toContain('@keydown.esc.prevent')

    expect(taskInspectorSource).not.toContain("type TaskItem = TaskNodeModel['data']['items'][number]")
    expect(taskInspectorSource).not.toContain('contentChange')
    expect(taskInspectorSource).not.toContain('replaceTaskItem')
    expect(taskInspectorSource).not.toContain('label="Tasks"')
    expect(taskInspectorSource).not.toContain('<a-input')
    expect(taskInspectorSource).not.toContain('<a-checkbox')
    expect(taskInspectorSource).toContain('label="Density"')
    expect(taskInspectorSource).toContain('contentStyleChange')
  })

  it('keeps attachment content read-only while code and link own their own interactions', () => {
    const attachmentSource = readNodeContentSource('AttachmentNodeContent')

    expect(attachmentSource).toContain('node:')
    expect(attachmentSource).not.toContain('editing: boolean')
    expect(attachmentSource).not.toContain('defineEmits')
    expect(attachmentSource).not.toContain('function commitEdit')
    expect(attachmentSource).not.toContain('function cancelEdit')
    expect(attachmentSource).not.toContain('v-if="editing"')
    expect(attachmentSource).not.toContain('@commit')
    expect(attachmentSource).not.toContain('@keydown.esc.prevent')
    expect(attachmentSource).toContain('@click.prevent')
    expect(readNodeContentSource('CodeNodeContent')).toContain('vue-codemirror')
    expect(readNodeContentSource('CodeNodeContent')).toContain("emit('commit', { code: editorCode.value })")
    expect(readNodeContentSource('CodeNodeContent')).toContain('@blur="commitCode"')
    expect(readNodeContentSource('CodeNodeContent')).toContain('@keydown.esc')
  })

  it('renders code nodes as an always-editable CodeMirror surface', () => {
    const source = readNodeContentSource('CodeNodeContent')

    expect(source).toContain("import { Codemirror } from 'vue-codemirror'")
    expect(source).toContain("import { isValidCode } from '@mind-x/mind-engine'")
    expect(source).toContain("import { createCodeEditorExtensions } from '../../../utils/codeEditor'")
    expect(source).toContain('const editorCode = ref(props.node.data.code)')
    expect(source).toContain('createCodeEditorExtensions')
    expect(source).toContain('props.node.data.language')
    expect(source).toContain('props.node.contentStyle.theme')
    expect(source).toContain('props.node.contentStyle.wrap')
    expect(source).toContain('<Codemirror')
    expect(source).toContain('v-model="editorCode"')
    expect(source).toContain(':extensions="extensions"')
    expect(source).toContain('@blur="commitCode"')
    expect(source).toContain('@pointerdown.stop')
    expect(source).not.toContain('v-html="highlighted.html"')
    expect(source).not.toContain('highlightCode')
  })

  it('keeps export-specific concerns out of node content components', () => {
    for (const fileName of [
      'AttachmentNodeContent',
      'CodeNodeContent',
      'ImageNodeContent',
      'LinkNodeContent',
      'TaskNodeContent',
      'TopicNodeContent'
    ]) {
      const source = readNodeContentSource(fileName)

      expect(source).not.toContain('exportMode')
      expect(source).not.toContain('data-editor-export')
      expect(source).not.toContain('html2canvas')
      expect(source).not.toContain('prepareExportClone')
    }
  })

  it('uses html2canvas-compatible color syntax in node content styles', () => {
    for (const fileName of [
      'AttachmentNodeContent',
      'CodeNodeContent',
      'ImageNodeContent',
      'LinkNodeContent',
      'TaskNodeContent',
      'TopicNodeContent'
    ]) {
      expect(readNodeContentSource(fileName)).not.toContain('color-mix(')
    }
  })

  it('prevents native image and link dragging from competing with canvas drag', () => {
    for (const fileName of ['AttachmentNodeContent', 'ImageNodeContent', 'LinkNodeContent']) {
      const source = readNodeContentSource(fileName)

      expect(source).toContain('draggable="false"')
      expect(source).toContain('@dragstart.prevent')
    }
  })
})
