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

  it('routes topic title commits and object data patch commits', () => {
    const source = readNodeRendererSource()

    expect(source).not.toContain('getTopicContentNode')
    expect(source).toContain("emit('editCommit', node.id, { title })")
    expect(source).toContain("emit('editCommit', node.id, dataPatch)")
  })
})
