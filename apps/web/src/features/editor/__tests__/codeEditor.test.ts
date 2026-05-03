import { CODE_LANGUAGES, DEFAULT_CODE_LANGUAGE } from '@mind-x/shared'
import { describe, expect, it } from 'vitest'
import {
  CODE_LANGUAGE_OPTIONS,
  createCodeEditorExtensions,
  resolveCodeLanguage
} from '../utils/codeEditor'

describe('codeEditor', () => {
  it('exposes language options in shared schema order', () => {
    expect(CODE_LANGUAGE_OPTIONS.map((option) => option.value)).toEqual([...CODE_LANGUAGES])
    expect(CODE_LANGUAGE_OPTIONS.map((option) => option.label)).toEqual([
      'Plain Text',
      'JavaScript',
      'TypeScript',
      'JSON',
      'CSS',
      'HTML',
      'Markdown',
      'Python',
      'Bash'
    ])
  })

  it('resolves unsupported language values to the default language', () => {
    expect(resolveCodeLanguage('python')).toBe('python')
    expect(resolveCodeLanguage('ruby')).toBe(DEFAULT_CODE_LANGUAGE)
    expect(resolveCodeLanguage(undefined)).toBe(DEFAULT_CODE_LANGUAGE)
  })

  it('creates CodeMirror extensions for language, theme, and wrapping', () => {
    expect(
      createCodeEditorExtensions({
        language: 'typescript',
        theme: 'vscode-dark',
        wrap: true
      }).length
    ).toBeGreaterThan(2)
    expect(
      createCodeEditorExtensions({
        language: 'plaintext',
        theme: 'missing',
        wrap: false
      }).length
    ).toBeGreaterThan(1)
  })
})
