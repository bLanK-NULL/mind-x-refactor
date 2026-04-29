import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readEditorSource(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

const removedShellInspectorName = ['Node', 'ShellStyle', 'Inspector'].join('')

describe('node inspector architecture', () => {
  it('keeps BaseNode shell style controls in NodeInspector', () => {
    const source = readEditorSource('../components/inspectors/NodeInspector.vue')

    expect(source).toContain("import ColorTokenPicker from './ColorTokenPicker.vue'")
    expect(source).toContain("import StyleField from './StyleField.vue'")
    expect(source).not.toContain(removedShellInspectorName)
    expect(source).toContain('<ColorTokenPicker')
    expect(source).toContain('label="Color"')
    expect(source).toContain('label="Tone"')
    expect(source).toContain('label="Shape"')
    expect(source).toContain('label="Border"')
    expect(source).toContain('label="Shadow"')
    expect(source).toContain("emit('shellStyleChange', { colorToken })")
    expect(source).toContain("emit('shellStyleChange', { tone: tone as NodeShellStyle['tone'] })")
    expect(source).toContain("emit('shellStyleChange', { shape: shape as NodeShellStyle['shape'] })")
    expect(source).toContain("emit('shellStyleChange', { borderStyle: borderStyle as NodeShellStyle['borderStyle'] })")
    expect(source).toContain("emit('shellStyleChange', { shadowLevel: shadowLevel as NodeShellStyle['shadowLevel'] })")
    expect(source).toContain('<a-divider class="node-inspector__divider" />')
  })

  it('provides a focused inspector for topic nodes', () => {
    const source = readEditorSource('../components/inspectors/node-inspectors/TopicNodeInspector.vue')

    expect(source).toContain("type TopicNodeModel = Extract<MindNode, { type: 'topic' }>")
    expect(source).toContain('node: TopicNodeModel')
    expect(source).toContain('isValidPlainText')
    expect(source).toContain('label="Title"')
    expect(source).toContain('label="Text"')
    expect(source).toContain("emit('contentChange', { title })")
    expect(source).toContain("emit('contentStyleChange', { textWeight })")
  })

  it('provides a focused inspector for image nodes', () => {
    const source = readEditorSource('../components/inspectors/node-inspectors/ImageNodeInspector.vue')

    expect(source).toContain("type ImageNodeModel = Extract<MindNode, { type: 'image' }>")
    expect(source).toContain('node: ImageNodeModel')
    expect(source).toContain('isValidWebUrl')
    expect(source).toContain('isValidOptionalPlainText')
    expect(source).toContain('label="URL"')
    expect(source).toContain('label="Alt"')
    expect(source).toContain('label="Fit"')
    expect(source).toContain("emit('contentChange', { url, alt: props.node.data.alt })")
    expect(source).toContain("emit('contentStyleChange', { objectFit: objectFit as ImageContentStyle['objectFit'] })")
  })

  it('provides a focused inspector for link nodes', () => {
    const source = readEditorSource('../components/inspectors/node-inspectors/LinkNodeInspector.vue')

    expect(source).toContain("type LinkNodeModel = Extract<MindNode, { type: 'link' }>")
    expect(source).toContain('node: LinkNodeModel')
    expect(source).toContain('isValidPlainText')
    expect(source).toContain('isValidWebUrl')
    expect(source).toContain('label="Title"')
    expect(source).toContain('label="URL"')
    expect(source).toContain("emit('contentChange', { title, url: props.node.data.url })")
    expect(source).toContain("emit('contentChange', { title: props.node.data.title, url })")
    expect(source).not.toContain('label="Layout"')
  })

  it('provides a focused inspector for attachment nodes', () => {
    const source = readEditorSource('../components/inspectors/node-inspectors/AttachmentNodeInspector.vue')

    expect(source).toContain("type AttachmentNodeModel = Extract<MindNode, { type: 'attachment' }>")
    expect(source).toContain('node: AttachmentNodeModel')
    expect(source).toContain('isValidPlainText')
    expect(source).toContain('isValidWebUrl')
    expect(source).toContain('label="File"')
    expect(source).toContain('label="URL"')
    expect(source).toContain("emit('contentChange', { fileName, url: props.node.data.url })")
    expect(source).toContain("emit('contentChange', { fileName: props.node.data.fileName, url })")
    expect(source).not.toContain('label="Icon"')
  })

  it('provides a focused inspector for code nodes', () => {
    const source = readEditorSource('../components/inspectors/node-inspectors/CodeNodeInspector.vue')

    expect(source).toContain("type CodeNodeModel = Extract<MindNode, { type: 'code' }>")
    expect(source).toContain('node: CodeNodeModel')
    expect(source).toContain('CODE_NODE_CODE_MAX_LENGTH')
    expect(source).toContain('isValidCode')
    expect(source).toContain('label="Code"')
    expect(source).toContain('label="Wrap"')
    expect(source).toContain("emit('contentChange', { code })")
    expect(source).toContain("emit('contentStyleChange', { wrap: checkedValue(event) })")
  })

  it('provides a focused inspector for task nodes', () => {
    const source = readEditorSource('../components/inspectors/node-inspectors/TaskNodeInspector.vue')

    expect(source).toContain("type TaskNodeModel = Extract<MindNode, { type: 'task' }>")
    expect(source).toContain("type TaskItem = TaskNodeModel['data']['items'][number]")
    expect(source).toContain('node: TaskNodeModel')
    expect(source).toContain('isValidPlainText')
    expect(source).toContain('label="Tasks"')
    expect(source).toContain('label="Density"')
    expect(source).toContain('replaceTaskItem')
    expect(source).toContain("emit('contentChange', { items })")
    expect(source).toContain("emit('contentStyleChange', { density: density as TaskContentStyle['density'] })")
  })

  it('keeps NodeInspector as the shell style host and exhaustive type dispatcher', () => {
    const source = readEditorSource('../components/inspectors/NodeInspector.vue')

    expect(source).toContain("import type { MindNode, NodeShellStyle } from '@mind-x/shared'")
    expect(source).toContain("import type { Component } from 'vue'")
    expect(source).toContain("import ColorTokenPicker from './ColorTokenPicker.vue'")
    expect(source).toContain("import StyleField from './StyleField.vue'")
    expect(source).not.toContain(removedShellInspectorName)
    expect(source).toContain("import AttachmentNodeInspector from './node-inspectors/AttachmentNodeInspector.vue'")
    expect(source).toContain("import CodeNodeInspector from './node-inspectors/CodeNodeInspector.vue'")
    expect(source).toContain("import ImageNodeInspector from './node-inspectors/ImageNodeInspector.vue'")
    expect(source).toContain("import LinkNodeInspector from './node-inspectors/LinkNodeInspector.vue'")
    expect(source).toContain("import TaskNodeInspector from './node-inspectors/TaskNodeInspector.vue'")
    expect(source).toContain("import TopicNodeInspector from './node-inspectors/TopicNodeInspector.vue'")
    expect(source).toContain('satisfies Record<MindNode[\'type\'], Component>')
    expect(source).toContain('attachment: AttachmentNodeInspector')
    expect(source).toContain('code: CodeNodeInspector')
    expect(source).toContain('image: ImageNodeInspector')
    expect(source).toContain('link: LinkNodeInspector')
    expect(source).toContain('task: TaskNodeInspector')
    expect(source).toContain('topic: TopicNodeInspector')
    expect(source).toContain('<ColorTokenPicker')
    expect(source).toContain('<a-divider class="node-inspector__divider" />')
    expect(source).toContain('<component')
    expect(source).toContain(':is="getInspectorComponent(node)"')
    expect(source).not.toMatch(/node\.type\s*===/)
    expect(source).not.toContain('v-else-if')
    expect(source).not.toContain('updateTopicTitle')
    expect(source).not.toContain('replaceTaskItem')
  })
})
