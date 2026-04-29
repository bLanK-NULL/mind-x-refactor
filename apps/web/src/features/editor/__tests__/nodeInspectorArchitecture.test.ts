import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readEditorSource(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

describe('node inspector architecture', () => {
  it('extracts BaseNode shell style controls into NodeShellStyleInspector', () => {
    const source = readEditorSource('../components/inspectors/NodeShellStyleInspector.vue')

    expect(source).toContain("import type { NodeShellStyle } from '@mind-x/shared'")
    expect(source).toContain('style: NodeShellStyle')
    expect(source).toContain('styleChange: [stylePatch: Partial<NodeShellStyle>]')
    expect(source).toContain('<ColorTokenPicker')
    expect(source).toContain('label="Color"')
    expect(source).toContain('label="Tone"')
    expect(source).toContain('label="Shape"')
    expect(source).toContain('label="Border"')
    expect(source).toContain('label="Shadow"')
    expect(source).toContain("emit('styleChange', { colorToken })")
    expect(source).toContain("emit('styleChange', { tone: tone as NodeShellStyle['tone'] })")
    expect(source).toContain("emit('styleChange', { shape: shape as NodeShellStyle['shape'] })")
    expect(source).toContain("emit('styleChange', { borderStyle: borderStyle as NodeShellStyle['borderStyle'] })")
    expect(source).toContain("emit('styleChange', { shadowLevel: shadowLevel as NodeShellStyle['shadowLevel'] })")
  })
})
