import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readBaseNodeSource(): string {
  return readFileSync(new URL('../components/canvas/BaseNode.vue', import.meta.url), 'utf8')
}

describe('BaseNode', () => {
  it('owns the common node shell affordances', () => {
    const source = readBaseNodeSource()

    expect(source).toContain('data-editor-node')
    expect(source).toContain('@dblclick.stop="startEditing"')
    expect(source).toContain('base-node__content--blocked')
    expect(source).toContain('base-node__resize-handle')
    expect(source).toContain("emit('resize'")
  })
})
