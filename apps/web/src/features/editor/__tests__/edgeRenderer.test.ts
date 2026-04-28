import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readEdgeRendererSections(): { styles: string; template: string } {
  const source = readFileSync(new URL('../components/canvas/EdgeRenderer.vue', import.meta.url), 'utf8')
  const template = source.match(/<template>([\s\S]*?)<\/template>/)?.[1] ?? ''
  const styles = [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map((match) => match[1])
    .join('\n')

  return {
    styles,
    template
  }
}

describe('EdgeRenderer', () => {
  it('keeps edge layer positioning off the serialized SVG root', () => {
    const { styles, template } = readEdgeRendererSections()

    expect(template).toContain('<div class="edge-renderer" aria-hidden="true" :style="edgeRendererStyle">')
    expect(template).toContain('<svg class="edge-renderer__svg" :viewBox="edgeViewport.viewBox">')
    expect(template).not.toMatch(/<svg[^>]*:style="edgeRendererStyle"/)
    expect(styles).toMatch(/\.edge-renderer\s*{[^}]*position:\s*absolute;/s)
    expect(styles).toMatch(/\.edge-renderer__svg\s*{[^}]*width:\s*100%;[^}]*height:\s*100%;/s)
  })
})
