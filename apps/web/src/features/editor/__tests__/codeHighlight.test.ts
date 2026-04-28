import { describe, expect, it } from 'vitest'
import { highlightCode } from '../utils/codeHighlight'

describe('highlightCode', () => {
  it('auto-detects registered languages and returns highlighted html', () => {
    const result = highlightCode('const answer: number = 42')

    expect(result.language).toEqual(expect.any(String))
    expect(result.html).toContain('hljs-')
    expect(result.html).toContain('answer')
  })

  it('escapes raw HTML input through highlight.js output', () => {
    const result = highlightCode('<script>alert("xss")</script>')

    expect(result.html).toContain('&lt;')
    expect(result.html).toContain('&gt;')
    expect(result.html).not.toContain('<script>')
  })

  it('returns empty html and null language for empty code', () => {
    expect(highlightCode('')).toEqual({ html: '', language: null })
  })
})
