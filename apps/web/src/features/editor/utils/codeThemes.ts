import {
  CODE_BLOCK_THEMES,
  DEFAULT_CODE_THEME,
  type CodeBlockTheme
} from '@mind-x/shared'

type CodeThemeCssVariable =
  | '--code-bg'
  | '--code-text'
  | '--code-keyword'
  | '--code-string'
  | '--code-number'
  | '--code-literal'
  | '--code-title'
  | '--code-attr'
  | '--code-comment'

export type CodeThemeStyle = Record<CodeThemeCssVariable, string>

export interface CodeThemeSwatch {
  label: string
  color: string
}

export interface CodeThemeOption {
  value: CodeBlockTheme
  label: string
  swatches: CodeThemeSwatch[]
}

const CODE_THEME_STYLES: Record<CodeBlockTheme, CodeThemeStyle> = {
  'github-light': {
    '--code-bg': '#ffffff',
    '--code-text': '#24292f',
    '--code-keyword': '#cf222e',
    '--code-string': '#0a3069',
    '--code-number': '#0550ae',
    '--code-literal': '#8250df',
    '--code-title': '#953800',
    '--code-attr': '#116329',
    '--code-comment': '#6e7781'
  },
  'github-dark': {
    '--code-bg': '#0d1117',
    '--code-text': '#c9d1d9',
    '--code-keyword': '#ff7b72',
    '--code-string': '#a5d6ff',
    '--code-number': '#79c0ff',
    '--code-literal': '#d2a8ff',
    '--code-title': '#ffa657',
    '--code-attr': '#7ee787',
    '--code-comment': '#8b949e'
  },
  'vscode-dark': {
    '--code-bg': '#1e1e1e',
    '--code-text': '#d4d4d4',
    '--code-keyword': '#569cd6',
    '--code-string': '#ce9178',
    '--code-number': '#b5cea8',
    '--code-literal': '#4ec9b0',
    '--code-title': '#dcdcaa',
    '--code-attr': '#9cdcfe',
    '--code-comment': '#6a9955'
  },
  dracula: {
    '--code-bg': '#282a36',
    '--code-text': '#f8f8f2',
    '--code-keyword': '#ff79c6',
    '--code-string': '#f1fa8c',
    '--code-number': '#bd93f9',
    '--code-literal': '#8be9fd',
    '--code-title': '#50fa7b',
    '--code-attr': '#8be9fd',
    '--code-comment': '#6272a4'
  },
  monokai: {
    '--code-bg': '#272822',
    '--code-text': '#f8f8f2',
    '--code-keyword': '#f92672',
    '--code-string': '#e6db74',
    '--code-number': '#ae81ff',
    '--code-literal': '#66d9ef',
    '--code-title': '#a6e22e',
    '--code-attr': '#a6e22e',
    '--code-comment': '#75715e'
  },
  nord: {
    '--code-bg': '#2e3440',
    '--code-text': '#d8dee9',
    '--code-keyword': '#81a1c1',
    '--code-string': '#a3be8c',
    '--code-number': '#b48ead',
    '--code-literal': '#88c0d0',
    '--code-title': '#ebcb8b',
    '--code-attr': '#8fbcbb',
    '--code-comment': '#616e88'
  },
  'solarized-light': {
    '--code-bg': '#fdf6e3',
    '--code-text': '#657b83',
    '--code-keyword': '#859900',
    '--code-string': '#2aa198',
    '--code-number': '#d33682',
    '--code-literal': '#6c71c4',
    '--code-title': '#b58900',
    '--code-attr': '#268bd2',
    '--code-comment': '#93a1a1'
  },
  'solarized-dark': {
    '--code-bg': '#002b36',
    '--code-text': '#839496',
    '--code-keyword': '#859900',
    '--code-string': '#2aa198',
    '--code-number': '#d33682',
    '--code-literal': '#6c71c4',
    '--code-title': '#b58900',
    '--code-attr': '#268bd2',
    '--code-comment': '#586e75'
  }
}

const THEME_LABELS: Record<CodeBlockTheme, string> = {
  'github-light': 'GitHub Light',
  'github-dark': 'GitHub Dark',
  'vscode-dark': 'VS Code Dark',
  dracula: 'Dracula',
  monokai: 'Monokai',
  nord: 'Nord',
  'solarized-light': 'Solarized Light',
  'solarized-dark': 'Solarized Dark'
}

function buildSwatches(style: CodeThemeStyle): CodeThemeSwatch[] {
  return [
    { label: 'Background', color: style['--code-bg'] },
    { label: 'Text', color: style['--code-text'] },
    { label: 'Keyword', color: style['--code-keyword'] },
    { label: 'String', color: style['--code-string'] }
  ]
}

export const CODE_THEME_OPTIONS: CodeThemeOption[] = CODE_BLOCK_THEMES.map(
  (theme) => ({
    value: theme,
    label: THEME_LABELS[theme],
    swatches: buildSwatches(CODE_THEME_STYLES[theme])
  })
)

export function resolveCodeTheme(theme: unknown): CodeBlockTheme {
  return typeof theme === 'string' && CODE_BLOCK_THEMES.includes(theme as CodeBlockTheme)
    ? (theme as CodeBlockTheme)
    : DEFAULT_CODE_THEME
}

export function resolveCodeThemeStyle(theme: unknown): CodeThemeStyle {
  return CODE_THEME_STYLES[resolveCodeTheme(theme)]
}
