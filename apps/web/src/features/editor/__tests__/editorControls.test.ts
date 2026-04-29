import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readEditorSource(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

const removedShellInspectorName = ['Node', 'ShellStyle', 'Inspector'].join('')

describe('editor multi-type controls', () => {
  it('defines ordered node type options for controls', async () => {
    const { NODE_TYPE_OPTIONS } = await import('../utils/nodeContent')

    expect(NODE_TYPE_OPTIONS).toEqual([
      { label: 'Topic', type: 'topic' },
      { label: 'Image', type: 'image' },
      { label: 'Link', type: 'link' },
      { label: 'Attachment', type: 'attachment' },
      { label: 'Code', type: 'code' },
      { label: 'Task', type: 'task' }
    ])
  })

  it('exposes type-aware add actions from toolbar and context menu', () => {
    const toolbarSource = readEditorSource('../components/toolbar/EditorToolbar.vue')
    const contextMenuSource = readEditorSource('../components/context-menu/EditorContextMenu.vue')

    expect(toolbarSource).toContain("import type { MindNodeType } from '@mind-x/shared'")
    expect(toolbarSource).toContain("import { NODE_TYPE_OPTIONS } from '../../utils/nodeContent'")
    expect(toolbarSource).toContain('addChild: [type?: MindNodeType]')
    expect(toolbarSource).toContain('addTopic: [type?: MindNodeType]')
    expect(toolbarSource).toContain("emit('addTopic', option.type)")
    expect(toolbarSource).toContain("emit('addChild', option.type)")
    expect(toolbarSource).toContain("emit('addTopic', 'topic')")
    expect(toolbarSource).toContain("emit('addChild', 'topic')")

    expect(contextMenuSource).toContain("import type { MindNodeType } from '@mind-x/shared'")
    expect(contextMenuSource).toContain("import { NODE_TYPE_OPTIONS } from '../../utils/nodeContent'")
    expect(contextMenuSource).toContain('addChild: [type: MindNodeType]')
    expect(contextMenuSource).toContain("emit('addChild', option.type)")
    expect(contextMenuSource).toContain('`Add ${option.label.toLowerCase()} child`')
  })

  it('routes selected node content and shell style changes from MindEditor', () => {
    const source = readEditorSource('../components/MindEditor.vue')

    expect(source).toContain("import type { EdgeStyle, MindDocument, MindEdge, MindNode, MindNodeType, Point }")
    expect(source).toContain("function addTopic(type: MindNodeType = 'topic'): void")
    expect(source).toContain('editor.addRootNode({ type })')
    expect(source).toContain("function addChild(type: MindNodeType = 'topic'): void")
    expect(source).toContain('editor.addChildNode({ type })')
    expect(source).toContain("addChild('topic')")
    expect(source).toContain('editor.updateNodeData(selectedNode.value.id, dataPatch)')
    expect(source).toContain('editor.setSelectedNodeContentStyle(stylePatch)')
    expect(source).toContain('editor.setSelectedNodeShellStyle(stylePatch)')
    expect(source).toContain(':node="selectedNode"')
    expect(source).toContain('@content-change="setSelectedNodeContent"')
    expect(source).toContain('@content-style-change="setSelectedNodeContentStyle"')
    expect(source).toContain('@shell-style-change="setSelectedNodeShellStyle"')
  })

  it('keeps NodeInspector as the selected node editing boundary', () => {
    const source = readEditorSource('../components/inspectors/NodeInspector.vue')

    expect(source).toContain("import type { MindNode, NodeShellStyle } from '@mind-x/shared'")
    expect(source).toContain('node: MindNode')
    expect(source).toContain('contentChange: [dataPatch: Record<string, unknown>]')
    expect(source).toContain('contentStyleChange: [stylePatch: Record<string, unknown>]')
    expect(source).toContain('shellStyleChange: [stylePatch: Partial<NodeShellStyle>]')
    expect(source).toContain("import ColorTokenPicker from './ColorTokenPicker.vue'")
    expect(source).toContain("import StyleField from './StyleField.vue'")
    expect(source).not.toContain(removedShellInspectorName)
    expect(source).toContain('<ColorTokenPicker')
    expect(source).toContain('<a-divider class="node-inspector__divider" />')
    expect(source).toContain('<component')
    expect(source).toContain(':is="getInspectorComponent(node)"')
    expect(source).toContain('@content-change="(dataPatch: Record<string, unknown>) => emit(\'contentChange\', dataPatch)"')
    expect(source).toContain('@content-style-change="(stylePatch: Record<string, unknown>) => emit(\'contentStyleChange\', stylePatch)"')
    expect(source).not.toMatch(/node\.type\s*===/)
    expect(source).not.toContain('v-else-if')
    expect(source).not.toContain('updateTopicTitle')
    expect(source).not.toContain('CODE_NODE_CODE_MAX_LENGTH')
    expect(source).not.toContain('PLAIN_TEXT_MAX_LENGTH')
    expect(source).not.toContain('isValidCode')
    expect(source).not.toContain('isValidPlainText')
    expect(source).not.toContain('replaceTaskItem')
  })
})
