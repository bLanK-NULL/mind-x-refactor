import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readBaseNodeSource(): string {
  return readFileSync(new URL('../components/canvas/BaseNode.vue', import.meta.url), 'utf8')
}

describe('BaseNode', () => {
  it('owns the common node shell affordances without owning inline editing', () => {
    const source = readBaseNodeSource()

    expect(source).toContain('data-editor-node')
    expect(source).toContain("import { computed } from 'vue'")
    expect(source).not.toMatch(/import\s+\{[^}]*\bref\b[^}]*\}\s+from 'vue'/)
    expect(source).not.toMatch(/\bref\(/)
    expect(source).toContain('inspect: [nodeId: string]')
    expect(source).toContain("@dblclick.stop=\"emit('inspect', node.id)\"")
    expect(source).toContain('base-node__resize-handle')
    expect(source).toContain('data-editor-export-ignore="true"')
    expect(source).toContain("emit('resize'")
    expect(source).toContain("emit('drag'")
    expect(source).toContain("emit('select', props.node.id)")
    expect(source).not.toContain('const editing = ref(false)')
    expect(source).not.toContain('function startEditing')
    expect(source).not.toContain('function commitEdit')
    expect(source).not.toContain('function cancelEdit')
    expect(source).not.toContain('base-node__content--blocked')
    expect(source).not.toContain(':editing')
    expect(source).not.toContain(':commit-edit')
    expect(source).not.toContain(':cancel-edit')
  })
})
