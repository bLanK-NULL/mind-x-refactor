import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { python } from '@codemirror/lang-python'
import { StreamLanguage } from '@codemirror/language'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { basicSetup } from 'codemirror'
import {
  CODE_LANGUAGES,
  DEFAULT_CODE_LANGUAGE,
  type CodeBlockTheme,
  type CodeLanguage
} from '@mind-x/shared'
import { resolveCodeTheme, resolveCodeThemeStyle } from './codeThemes'

export interface CodeLanguageOption {
  value: CodeLanguage
  label: string
}

export interface CreateCodeEditorExtensionsInput {
  language: unknown
  theme: unknown
  wrap: boolean
}

const CODE_LANGUAGE_LABELS: Record<CodeLanguage, string> = {
  plaintext: 'Plain Text',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  json: 'JSON',
  css: 'CSS',
  html: 'HTML',
  markdown: 'Markdown',
  python: 'Python',
  bash: 'Bash'
}

const DARK_CODE_THEMES = new Set<CodeBlockTheme>([
  'github-dark',
  'vscode-dark',
  'dracula',
  'monokai',
  'nord',
  'solarized-dark'
])

export const CODE_LANGUAGE_OPTIONS: CodeLanguageOption[] = CODE_LANGUAGES.map((language) => ({
  value: language,
  label: CODE_LANGUAGE_LABELS[language]
}))

export function resolveCodeLanguage(language: unknown): CodeLanguage {
  return typeof language === 'string' && CODE_LANGUAGES.includes(language as CodeLanguage)
    ? (language as CodeLanguage)
    : DEFAULT_CODE_LANGUAGE
}

function languageExtension(language: CodeLanguage): Extension {
  if (language === 'javascript') {
    return javascript()
  }
  if (language === 'typescript') {
    return javascript({ typescript: true })
  }
  if (language === 'json') {
    return json()
  }
  if (language === 'css') {
    return css()
  }
  if (language === 'html') {
    return html()
  }
  if (language === 'markdown') {
    return markdown()
  }
  if (language === 'python') {
    return python()
  }
  if (language === 'bash') {
    return StreamLanguage.define(shell)
  }
  return []
}

function editorThemeExtension(theme: unknown): Extension {
  const resolvedTheme = resolveCodeTheme(theme)
  const style = resolveCodeThemeStyle(resolvedTheme)

  return EditorView.theme(
    {
      '&': {
        width: '100%',
        height: '100%',
        borderRadius: '4px',
        backgroundColor: style['--code-bg'],
        color: style['--code-text'],
        fontSize: '12px'
      },
      '&.cm-focused': {
        outline: 'none'
      },
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
        lineHeight: '1.45'
      },
      '.cm-content': {
        padding: '10px 12px'
      },
      '.cm-gutters': {
        borderRight: '1px solid rgb(148 163 184 / 24%)',
        backgroundColor: style['--code-bg'],
        color: style['--code-comment']
      }
    },
    { dark: DARK_CODE_THEMES.has(resolvedTheme) }
  )
}

export function createCodeEditorExtensions(input: CreateCodeEditorExtensionsInput): Extension[] {
  const extensions: Extension[] = [
    basicSetup,
    languageExtension(resolveCodeLanguage(input.language)),
    editorThemeExtension(input.theme)
  ]

  if (input.wrap) {
    extensions.push(EditorView.lineWrapping)
  }

  return extensions
}
