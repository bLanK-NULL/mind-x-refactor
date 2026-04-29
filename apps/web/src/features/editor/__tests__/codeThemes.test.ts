import { CODE_BLOCK_THEMES, DEFAULT_CODE_THEME } from '@mind-x/shared'
import { describe, expect, it } from 'vitest'

import {
  CODE_THEME_OPTIONS,
  resolveCodeTheme,
  resolveCodeThemeStyle
} from '../utils/codeThemes'

describe('codeThemes', () => {
  it('exposes one option per shared theme in stable order', () => {
    expect(CODE_THEME_OPTIONS.map((option) => option.value)).toEqual([
      ...CODE_BLOCK_THEMES
    ])
    expect(CODE_THEME_OPTIONS.map((option) => option.label)).toEqual([
      'GitHub Light',
      'GitHub Dark',
      'VS Code Dark',
      'Dracula',
      'Monokai',
      'Nord',
      'Solarized Light',
      'Solarized Dark'
    ])
  })

  it('includes swatches for compact inspector previews', () => {
    for (const option of CODE_THEME_OPTIONS) {
      expect(option.swatches.length).toBeGreaterThanOrEqual(3)
      expect(option.swatches.every((swatch) => swatch.color.startsWith('#'))).toBe(true)
    }
  })

  it('resolves unsupported values to the default theme', () => {
    expect(resolveCodeTheme('dracula')).toBe('dracula')
    expect(resolveCodeTheme('missing')).toBe(DEFAULT_CODE_THEME)
    expect(resolveCodeTheme('toString')).toBe(DEFAULT_CODE_THEME)
    expect(resolveCodeTheme(undefined)).toBe(DEFAULT_CODE_THEME)
  })

  it('falls back to default theme styles for inherited object keys', () => {
    expect(resolveCodeThemeStyle('toString')).toEqual(resolveCodeThemeStyle(DEFAULT_CODE_THEME))
  })

  it('returns the CSS variables required by the code renderer', () => {
    const style = resolveCodeThemeStyle('github-light')

    expect(style).toEqual(
      expect.objectContaining({
        '--code-bg': expect.any(String),
        '--code-text': expect.any(String),
        '--code-keyword': expect.any(String),
        '--code-string': expect.any(String),
        '--code-number': expect.any(String),
        '--code-literal': expect.any(String),
        '--code-title': expect.any(String),
        '--code-attr': expect.any(String),
        '--code-comment': expect.any(String)
      })
    )
  })
})
