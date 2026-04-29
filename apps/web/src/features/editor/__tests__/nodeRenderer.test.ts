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
    expect(source).toContain("emit('commit', { title })")
    expect(source).not.toContain('editing: boolean')
  })

  it('keeps non-topic content read-only on the canvas', () => {
    const readOnlyContent = [
      'AttachmentNodeContent',
      'CodeNodeContent',
      'ImageNodeContent',
      'LinkNodeContent',
      'TaskNodeContent'
    ]

    for (const fileName of readOnlyContent) {
      const source = readNodeContentSource(fileName)

      expect(source).toContain('node:')
      expect(source).not.toContain('editing: boolean')
      expect(source).not.toContain('defineEmits')
      expect(source).not.toContain('function commitEdit')
      expect(source).not.toContain('function cancelEdit')
      expect(source).not.toContain('v-if="editing"')
      expect(source).not.toContain('@commit')
      expect(source).not.toContain("@keydown.esc.prevent")
    }

    expect(readNodeContentSource('AttachmentNodeContent')).toContain('@click.prevent')
    expect(readNodeContentSource('LinkNodeContent')).toContain('@click.prevent')
    expect(readNodeContentSource('CodeNodeContent')).not.toContain('CODE_NODE_CODE_MAX_LENGTH')
    expect(readNodeContentSource('CodeNodeContent')).not.toContain('isValidCode')
    expect(readNodeContentSource('TaskNodeContent')).not.toContain('type TaskItem')
    expect(readNodeContentSource('TaskNodeContent')).not.toContain('replaceItem')
    expect(readNodeContentSource('TaskNodeContent')).not.toContain('task-node__input')
    expect(readNodeContentSource('TaskNodeContent')).not.toContain('task-node__done')
    expect(readNodeContentSource('TaskNodeContent')).not.toContain('task-node__error')
  })

  it('prevents native image and link dragging from competing with canvas drag', () => {
    for (const fileName of ['AttachmentNodeContent', 'ImageNodeContent', 'LinkNodeContent']) {
      const source = readNodeContentSource(fileName)

      expect(source).toContain('draggable="false"')
      expect(source).toContain('@dragstart.prevent')
    }
  })
})
