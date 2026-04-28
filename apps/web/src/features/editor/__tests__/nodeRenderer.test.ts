import { readFileSync } from 'node:fs'
import type { MindNode } from '@mind-x/shared'
import { renderToString } from '@vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import NodeRenderer from '../components/canvas/NodeRenderer.vue'

function readNodeRendererSource(): string {
  return readFileSync(new URL('../components/canvas/NodeRenderer.vue', import.meta.url), 'utf8')
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

function readTaskNodeContentSource(): string {
  return readFileSync(new URL('../components/canvas/node-content/TaskNodeContent.vue', import.meta.url), 'utf8')
}

function readCodeNodeContentSource(): string {
  return readFileSync(new URL('../components/canvas/node-content/CodeNodeContent.vue', import.meta.url), 'utf8')
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

  it('routes topic title commits and object data patch commits', () => {
    const source = readNodeRendererSource()

    expect(source).not.toContain('getTopicContentNode')
    expect(source).toContain("emit('editCommit', node.id, { title })")
    expect(source).toContain("emit('editCommit', node.id, dataPatch)")
  })

  it('keeps task no-op edits on the cancel path', () => {
    const source = readTaskNodeContentSource()

    expect(source).toContain('areItemsEqual(items, props.node.data.items)')
    expect(source).toContain("emit('cancel')")
    expect(source).toContain("emit('commit', { items })")
  })

  it('keeps oversized code edits out of commit payloads', () => {
    const source = readCodeNodeContentSource()

    expect(source).toContain('CODE_NODE_CODE_MAX_LENGTH')
    expect(source).toContain('isValidCode(draftCode.value)')
    expect(source).toContain('editError.value')
    expect(source).toContain(':maxlength="CODE_NODE_CODE_MAX_LENGTH"')
  })
})
