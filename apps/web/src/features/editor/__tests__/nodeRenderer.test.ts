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

  it('renders a safe placeholder for non-topic nodes', async () => {
    const html = await renderToString(
      createSSRApp(NodeRenderer, {
        nodes: [createImageNode()],
        selectedNodeIds: []
      })
    )

    expect(html).toContain('node-fallback')
    expect(html).toContain('image')
    expect(html).not.toContain('topic-node__title')
    expect(html).not.toContain('Diagram')
  })

  it('does not route non-topic edit commits to topic title patches', () => {
    const source = readNodeRendererSource()

    expect(source).not.toContain('getTopicContentNode')
    expect(source).toContain("if (node.type !== 'topic'")
    expect(source).toContain("emit('editCommit', node.id, { title })")
  })
})
