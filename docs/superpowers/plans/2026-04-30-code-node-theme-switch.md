# Code Node Theme Switch Implementation Plan

> **For blank:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute this plan.

**Goal:** Add per-code-node syntax theme switching from the CodeNode inspector pane, with current and historical code nodes treated as having a `theme` field. Missing historical themes migrate on read to `vscode-dark`; the document version remains unchanged.

**Spec:** `docs/superpowers/specs/2026-04-30-code-node-theme-switch-design.md`

**Branch:** `codex/node-content-interactions`

## Architecture

Add a shared `CodeBlockTheme` enum and make `CodeContentStyle` include `theme`. The shared package owns the valid theme values and default. The web app owns visual theme palettes and inspector option metadata.

The v3 document schema remains version `3`, but the migration path gains a legacy-v3 parser that accepts code nodes with `contentStyle.theme` missing and normalizes them to `vscode-dark`. Runtime code should use `node.contentStyle.theme` as present after parsing/migration.

## File Structure

Modify:

```text
packages/shared/src/document.ts
packages/shared/src/document.test.ts
packages/mind-engine/src/__tests__/commands.test.ts
packages/mind-engine/src/__tests__/editorSession.test.ts
apps/web/src/features/editor/__tests__/editor.store.test.ts
apps/web/src/features/editor/components/canvas/node-content/CodeNodeContent.vue
apps/web/src/features/editor/components/inspectors/node-inspectors/CodeNodeInspector.vue
apps/web/src/features/editor/__tests__/nodeRenderer.test.ts
apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts
```

Add:

```text
apps/web/src/features/editor/utils/codeThemes.ts
apps/web/src/features/editor/__tests__/codeThemes.test.ts
```

## Theme Values

Use this stable order everywhere options are displayed:

```ts
export const CODE_BLOCK_THEMES = [
  'github-light',
  'github-dark',
  'vscode-dark',
  'dracula',
  'monokai',
  'nord',
  'solarized-light',
  'solarized-dark',
] as const
```

Default:

```ts
export const DEFAULT_CODE_THEME: CodeBlockTheme = 'vscode-dark'
export const DEFAULT_CODE_CONTENT_STYLE: CodeContentStyle = {
  wrap: true,
  theme: DEFAULT_CODE_THEME,
}
```

## Task 1: Shared Schema And Migration

### 1.1 Write Failing Shared Tests

Edit `packages/shared/src/document.test.ts`.

Add imports:

```ts
  CODE_BLOCK_THEMES,
  DEFAULT_CODE_THEME,
  codeBlockThemeSchema,
```

Add tests near the existing code node/default style tests:

```ts
it('defines the code block theme defaults', () => {
  expect(DEFAULT_CODE_THEME).toBe('vscode-dark')
  expect(DEFAULT_CODE_CONTENT_STYLE).toEqual({
    wrap: true,
    theme: 'vscode-dark',
  })
})

it('accepts the supported code block themes', () => {
  expect(CODE_BLOCK_THEMES).toEqual([
    'github-light',
    'github-dark',
    'vscode-dark',
    'dracula',
    'monokai',
    'nord',
    'solarized-light',
    'solarized-dark',
  ])

  for (const theme of CODE_BLOCK_THEMES) {
    expect(codeBlockThemeSchema.parse(theme)).toBe(theme)
  }
})
```

Add a strict-schema rejection test so invalid current documents do not silently coerce bad theme values:

```ts
it('rejects current code nodes with missing or unknown themes', () => {
  const missingTheme = v3Document({
    nodes: [
      {
        id: 'code-1',
        type: 'code',
        parentId: null,
        position: { x: 0, y: 0 },
        size: { width: 320, height: 180 },
        title: 'Code',
        collapsed: false,
        content: { code: 'const value = 1', language: 'typescript' },
        contentStyle: { wrap: true },
      },
    ],
  })

  const unknownTheme = v3Document({
    nodes: [
      {
        id: 'code-1',
        type: 'code',
        parentId: null,
        position: { x: 0, y: 0 },
        size: { width: 320, height: 180 },
        title: 'Code',
        collapsed: false,
        content: { code: 'const value = 1', language: 'typescript' },
        contentStyle: { wrap: true, theme: 'unknown-theme' },
      },
    ],
  })

  expect(mindDocumentV3Schema.safeParse(missingTheme).success).toBe(false)
  expect(mindDocumentV3Schema.safeParse(unknownTheme).success).toBe(false)
})
```

Add a migration test for historical v3 documents:

```ts
it('migrates historical v3 code nodes missing themes to vscode dark', () => {
  const historicalV3 = v3Document({
    nodes: [
      {
        id: 'code-1',
        type: 'code',
        parentId: null,
        position: { x: 0, y: 0 },
        size: { width: 320, height: 180 },
        title: 'Code',
        collapsed: false,
        content: { code: 'const value = 1', language: 'typescript' },
        contentStyle: { wrap: false },
      },
    ],
  })

  expect(migrateMindDocumentToV3(historicalV3).nodes[0]).toMatchObject({
    type: 'code',
    contentStyle: {
      wrap: false,
      theme: 'vscode-dark',
    },
  })
})
```

Run the focused test and confirm it fails:

```bash
npm test -- packages/shared/src/document.test.ts
```

### 1.2 Implement Shared Theme Schema

Edit `packages/shared/src/document.ts`.

Add the theme constants and schema before `codeContentStyleSchema`:

```ts
export const CODE_BLOCK_THEMES = [
  'github-light',
  'github-dark',
  'vscode-dark',
  'dracula',
  'monokai',
  'nord',
  'solarized-light',
  'solarized-dark',
] as const

export const codeBlockThemeSchema = z.enum(CODE_BLOCK_THEMES)
export type CodeBlockTheme = z.infer<typeof codeBlockThemeSchema>

export const DEFAULT_CODE_THEME: CodeBlockTheme = 'vscode-dark'
```

Change `codeContentStyleSchema`:

```ts
export const codeContentStyleSchema = z
  .object({
    wrap: z.boolean(),
    theme: codeBlockThemeSchema,
  })
  .strict()
```

Change default style:

```ts
export const DEFAULT_CODE_CONTENT_STYLE: CodeContentStyle = {
  wrap: true,
  theme: DEFAULT_CODE_THEME,
}
```

### 1.3 Add Legacy V3 Read Migration

Still in `packages/shared/src/document.ts`, add a legacy parser next to the v3 schemas:

```ts
const legacyCodeContentStyleSchema = z
  .object({
    wrap: z.boolean(),
    theme: codeBlockThemeSchema.optional(),
  })
  .strict()

const legacyCodeNodeV3Schema = nodeBaseV3Schema
  .extend({
    type: z.literal('code'),
    content: codeContentSchema,
    contentStyle: legacyCodeContentStyleSchema,
  })
  .strict()

const migratableMindNodeV3Schema = z.discriminatedUnion('type', [
  topicNodeV3Schema,
  imageNodeV3Schema,
  linkNodeV3Schema,
  attachmentNodeV3Schema,
  legacyCodeNodeV3Schema,
  taskNodeV3Schema,
])

const migratableMindDocumentV3Schema = z
  .object({
    version: z.literal(3),
    title: z.string(),
    nodes: z.array(migratableMindNodeV3Schema),
    edges: z.array(edgeSchema),
    viewport: viewportSchema,
    metadata: metadataSchema,
  })
  .strict()
```

Add normalization helpers:

```ts
function normalizeV3MindNode(
  node: z.infer<typeof migratableMindNodeV3Schema>,
): MindNode {
  if (node.type !== 'code') {
    return node
  }

  return {
    ...node,
    contentStyle: {
      ...node.contentStyle,
      theme: node.contentStyle.theme ?? DEFAULT_CODE_THEME,
    },
  }
}

function migrateV3MindDocumentToCurrent(
  document: z.infer<typeof migratableMindDocumentV3Schema>,
): MindDocument {
  return mindDocumentV3Schema.parse({
    ...document,
    nodes: document.nodes.map(normalizeV3MindNode),
  })
}
```

Update the two migration entry points so current v3 parses first, then legacy v3 normalizes:

```ts
const migratableMindDocumentSchema = z.union([
  mindDocumentV3Schema,
  migratableMindDocumentV3Schema.transform(migrateV3MindDocumentToCurrent),
  mindDocumentV2Schema.transform(migrateV2ToV3),
  mindDocumentV1Schema.transform(migrateV1ToV3),
])

export function migrateMindDocumentToV3(input: unknown): MindDocument {
  return z
    .union([
      mindDocumentV3Schema,
      migratableMindDocumentV3Schema.transform(migrateV3MindDocumentToCurrent),
      mindDocumentV2Schema.transform(migrateV2ToV3),
      mindDocumentV1Schema.transform(migrateV1ToV3),
    ])
    .parse(input)
}
```

Run:

```bash
npm test -- packages/shared/src/document.test.ts
npm run typecheck
```

Commit:

```bash
git add packages/shared/src/document.ts packages/shared/src/document.test.ts
git commit -m "feat(shared): add code node theme style"
```

## Task 2: Engine And Store History Coverage

### 2.1 Write Failing Behavioral Tests

Edit `packages/mind-engine/src/__tests__/commands.test.ts`.

In the content-style command coverage, include theme updates:

```ts
const command = setNodeContentStyleCommand('code-1', {
  wrap: false,
  theme: 'dracula',
})
```

Assert merged style includes both values:

```ts
expect(result.document.nodes[0]).toMatchObject({
  type: 'code',
  contentStyle: {
    ...DEFAULT_CODE_CONTENT_STYLE,
    wrap: false,
    theme: 'dracula',
  },
})
```

Edit `packages/mind-engine/src/__tests__/editorSession.test.ts`.

In the selected code-node style test, update the style through session API:

```ts
session.setSelectedNodeContentStyle({
  wrap: false,
  theme: 'dracula',
})

expect(codeNode?.contentStyle).toEqual({
  ...DEFAULT_CODE_CONTENT_STYLE,
  wrap: false,
  theme: 'dracula',
})
```

Keep undo assertions against `DEFAULT_CODE_CONTENT_STYLE`, which now includes `theme: 'vscode-dark'`.

Edit `apps/web/src/features/editor/__tests__/editor.store.test.ts`.

Extend the store action coverage:

```ts
store.setSelectedNodeContentStyle({
  wrap: false,
  theme: 'dracula',
})

expect(store.nodes[0]).toMatchObject({
  type: 'code',
  contentStyle: {
    ...DEFAULT_CODE_CONTENT_STYLE,
    wrap: false,
    theme: 'dracula',
  },
})
```

Run focused tests and confirm failures if Task 1 is not implemented:

```bash
npm test -- packages/mind-engine/src/__tests__/commands.test.ts packages/mind-engine/src/__tests__/editorSession.test.ts apps/web/src/features/editor/__tests__/editor.store.test.ts
```

### 2.2 Implement Only If Tests Reveal Gaps

Expected production impact is small because `defaultContentStyle('code')` already spreads `DEFAULT_CODE_CONTENT_STYLE`, and content-style patches already merge through the engine.

If TypeScript rejects `{ theme: 'dracula' }` patches, update the relevant exported `ContentStyle` or command patch type to use the new `CodeContentStyle` union from shared. Keep this scoped to the narrow type surface causing the failure.

Run:

```bash
npm test -- packages/mind-engine/src/__tests__/commands.test.ts packages/mind-engine/src/__tests__/editorSession.test.ts apps/web/src/features/editor/__tests__/editor.store.test.ts
npm run typecheck
```

Commit:

```bash
git add packages/mind-engine/src/__tests__/commands.test.ts packages/mind-engine/src/__tests__/editorSession.test.ts apps/web/src/features/editor/__tests__/editor.store.test.ts
git commit -m "test: cover code node theme history"
```

## Task 3: Web Theme Registry

### 3.1 Write Failing Theme Utility Tests

Create `apps/web/src/features/editor/__tests__/codeThemes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { CODE_BLOCK_THEMES, DEFAULT_CODE_THEME } from '@mind-x/shared'

import {
  CODE_THEME_OPTIONS,
  resolveCodeTheme,
  resolveCodeThemeStyle,
} from '../utils/codeThemes'

describe('codeThemes', () => {
  it('exposes one option per shared theme in stable order', () => {
    expect(CODE_THEME_OPTIONS.map((option) => option.value)).toEqual([
      ...CODE_BLOCK_THEMES,
    ])
    expect(CODE_THEME_OPTIONS.map((option) => option.label)).toEqual([
      'GitHub Light',
      'GitHub Dark',
      'VS Code Dark',
      'Dracula',
      'Monokai',
      'Nord',
      'Solarized Light',
      'Solarized Dark',
    ])
  })

  it('includes swatches for compact inspector previews', () => {
    for (const option of CODE_THEME_OPTIONS) {
      expect(option.swatches.length).toBeGreaterThanOrEqual(3)
      expect(option.swatches.every((swatch) => swatch.color.startsWith('#'))).toBe(
        true,
      )
    }
  })

  it('resolves unsupported values to the default theme', () => {
    expect(resolveCodeTheme('dracula')).toBe('dracula')
    expect(resolveCodeTheme('missing')).toBe(DEFAULT_CODE_THEME)
    expect(resolveCodeTheme(undefined)).toBe(DEFAULT_CODE_THEME)
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
        '--code-comment': expect.any(String),
      }),
    )
  })
})
```

Run and confirm failure:

```bash
npm test -- apps/web/src/features/editor/__tests__/codeThemes.test.ts
```

### 3.2 Implement Theme Utility

Create `apps/web/src/features/editor/utils/codeThemes.ts`:

```ts
import {
  CODE_BLOCK_THEMES,
  DEFAULT_CODE_THEME,
  type CodeBlockTheme,
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
    '--code-comment': '#6e7781',
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
    '--code-comment': '#8b949e',
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
    '--code-comment': '#6a9955',
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
    '--code-comment': '#6272a4',
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
    '--code-comment': '#75715e',
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
    '--code-comment': '#616e88',
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
    '--code-comment': '#93a1a1',
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
    '--code-comment': '#586e75',
  },
}

const THEME_LABELS: Record<CodeBlockTheme, string> = {
  'github-light': 'GitHub Light',
  'github-dark': 'GitHub Dark',
  'vscode-dark': 'VS Code Dark',
  dracula: 'Dracula',
  monokai: 'Monokai',
  nord: 'Nord',
  'solarized-light': 'Solarized Light',
  'solarized-dark': 'Solarized Dark',
}

function buildSwatches(style: CodeThemeStyle): CodeThemeSwatch[] {
  return [
    { label: 'Background', color: style['--code-bg'] },
    { label: 'Text', color: style['--code-text'] },
    { label: 'Keyword', color: style['--code-keyword'] },
    { label: 'String', color: style['--code-string'] },
  ]
}

export const CODE_THEME_OPTIONS: CodeThemeOption[] = CODE_BLOCK_THEMES.map(
  (theme) => ({
    value: theme,
    label: THEME_LABELS[theme],
    swatches: buildSwatches(CODE_THEME_STYLES[theme]),
  }),
)

export function resolveCodeTheme(theme: unknown): CodeBlockTheme {
  return typeof theme === 'string' && theme in CODE_THEME_STYLES
    ? (theme as CodeBlockTheme)
    : DEFAULT_CODE_THEME
}

export function resolveCodeThemeStyle(theme: unknown): CodeThemeStyle {
  return CODE_THEME_STYLES[resolveCodeTheme(theme)]
}
```

Run:

```bash
npm test -- apps/web/src/features/editor/__tests__/codeThemes.test.ts
npm run typecheck
```

Commit:

```bash
git add apps/web/src/features/editor/utils/codeThemes.ts apps/web/src/features/editor/__tests__/codeThemes.test.ts
git commit -m "feat(web): add code block theme registry"
```

## Task 4: Apply Theme Variables In Code Renderer

### 4.1 Update Renderer Tests First

Edit `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`.

Replace hard-coded palette assertions for `CodeNodeContent.vue` with source assertions that the renderer:

```ts
expect(source).toContain("resolveCodeThemeStyle(props.node.contentStyle.theme)")
expect(source).toContain(':style="themeStyle"')
expect(source).toContain('background: var(--code-bg)')
expect(source).toContain('color: var(--code-text)')
expect(source).toContain('color: var(--code-keyword)')
expect(source).toContain('color: var(--code-string)')
expect(source).toContain('color: var(--code-number)')
expect(source).toContain('color: var(--code-literal)')
expect(source).toContain('color: var(--code-title)')
expect(source).toContain('color: var(--code-attr)')
expect(source).toContain('color: var(--code-comment)')
```

Keep the existing read-only assertions that ensure code editing remains out of canvas.

Run and confirm failure:

```bash
npm test -- apps/web/src/features/editor/__tests__/nodeRenderer.test.ts
```

### 4.2 Update `CodeNodeContent.vue`

Edit `apps/web/src/features/editor/components/canvas/node-content/CodeNodeContent.vue`.

Import the theme resolver:

```ts
import { resolveCodeThemeStyle } from '../../../utils/codeThemes'
```

Keep `props` as a variable if it already exists, then add:

```ts
const themeStyle = computed(() =>
  resolveCodeThemeStyle(props.node.contentStyle.theme),
)
```

Apply style to the `<pre>`:

```vue
<pre class="code-node__pre" :class="wrapClass" :style="themeStyle">
```

Replace hard-coded code token colors:

```css
.code-node__pre {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 10px 12px;
  overflow: auto;
  scrollbar-gutter: stable;
  background: var(--code-bg);
  color: var(--code-text);
  font-family:
    SFMono-Regular, Consolas, 'Liberation Mono', Menlo, Courier, monospace;
  font-size: 12px;
  line-height: 1.6;
}

:deep(.hljs-keyword),
:deep(.hljs-selector-tag),
:deep(.hljs-built_in) {
  color: var(--code-keyword);
}

:deep(.hljs-string),
:deep(.hljs-symbol),
:deep(.hljs-bullet) {
  color: var(--code-string);
}

:deep(.hljs-number) {
  color: var(--code-number);
}

:deep(.hljs-literal) {
  color: var(--code-literal);
}

:deep(.hljs-title),
:deep(.hljs-section) {
  color: var(--code-title);
}

:deep(.hljs-attr),
:deep(.hljs-attribute),
:deep(.hljs-name) {
  color: var(--code-attr);
}

:deep(.hljs-comment),
:deep(.hljs-quote) {
  color: var(--code-comment);
}
```

Run:

```bash
npm test -- apps/web/src/features/editor/__tests__/nodeRenderer.test.ts apps/web/src/features/editor/__tests__/codeThemes.test.ts
npm run typecheck
```

Commit:

```bash
git add apps/web/src/features/editor/components/canvas/node-content/CodeNodeContent.vue apps/web/src/features/editor/__tests__/nodeRenderer.test.ts
git commit -m "feat(web): render code nodes with selected theme"
```

## Task 5: Add Theme Select To Code Inspector

### 5.1 Update Inspector Architecture Tests First

Edit `apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts`.

In the Code inspector test, keep existing assertions for `Code` and `Wrap`, then add assertions:

```ts
expect(source).toContain("label=\"Theme\"")
expect(source).toContain('CODE_THEME_OPTIONS')
expect(source).toContain('resolveCodeTheme(node.contentStyle.theme)')
expect(source).toContain('emitThemeChange')
expect(source).toContain("emit('contentStyleChange', { theme")
expect(source).toContain('code-node-inspector__theme-swatch')
```

If the test already checks inspector control order, assert `Theme` appears after `Code` and before `Wrap`:

```ts
expect(source.indexOf('label="Code"')).toBeLessThan(source.indexOf('label="Theme"'))
expect(source.indexOf('label="Theme"')).toBeLessThan(source.indexOf('label="Wrap"'))
```

Run and confirm failure:

```bash
npm test -- apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts
```

### 5.2 Implement Inspector Select

Edit `apps/web/src/features/editor/components/inspectors/node-inspectors/CodeNodeInspector.vue`.

Add imports:

```ts
import { computed } from 'vue'
import type { CodeBlockTheme } from '@mind-x/shared'
import {
  CODE_THEME_OPTIONS,
  resolveCodeTheme,
} from '../../../utils/codeThemes'
```

Keep props accessible:

```ts
const props = defineProps<{
  node: CodeNodeModel
}>()
```

Add:

```ts
const selectedTheme = computed(() =>
  resolveCodeTheme(props.node.contentStyle.theme),
)

function emitThemeChange(theme: CodeBlockTheme): void {
  emit('contentStyleChange', { theme })
}
```

Insert `Theme` between the code textarea field and wrap field:

```vue
<StyleField label="Theme">
  <a-select
    :value="selectedTheme"
    size="small"
    class="code-node-inspector__theme-select"
    @change="emitThemeChange"
  >
    <a-select-option
      v-for="option in CODE_THEME_OPTIONS"
      :key="option.value"
      :value="option.value"
    >
      <span class="code-node-inspector__theme-option">
        <span>{{ option.label }}</span>
        <span class="code-node-inspector__theme-swatches" aria-hidden="true">
          <span
            v-for="swatch in option.swatches"
            :key="swatch.label"
            class="code-node-inspector__theme-swatch"
            :style="{ backgroundColor: swatch.color }"
          />
        </span>
      </span>
    </a-select-option>
  </a-select>
</StyleField>
```

Add compact styles:

```css
.code-node-inspector__theme-select {
  width: 100%;
}

.code-node-inspector__theme-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.code-node-inspector__theme-swatches {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.code-node-inspector__theme-swatch {
  width: 10px;
  height: 10px;
  border: 1px solid rgb(0 0 0 / 12%);
  border-radius: 2px;
}
```

Run:

```bash
npm test -- apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts
npm run typecheck
```

Commit:

```bash
git add apps/web/src/features/editor/components/inspectors/node-inspectors/CodeNodeInspector.vue apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts
git commit -m "feat(web): add code theme inspector control"
```

## Task 6: Final Verification

Run the complete local verification:

```bash
npm run typecheck
npm test
git diff --check
```

Inspect status:

```bash
git status --short --branch
```

If any test fails, use `superpowers:systematic-debugging` before changing implementation.

If verification passes and `git status --short` shows remaining intentional docs or test adjustments, stage the concrete files listed by `git status` and commit them:

```bash
git commit -m "test(web): verify code node theme switching"
```

## Expected User-Facing Behavior

1. Creating a new code node gives `contentStyle.theme: 'vscode-dark'`.
2. Opening old v3 documents with code nodes missing `theme` produces parsed nodes with `theme: 'vscode-dark'`.
3. The Code inspector shows `Code`, `Theme`, then `Wrap`.
4. Changing `Theme` updates only `contentStyle.theme`.
5. Canvas code nodes apply the selected theme only inside the `<pre>/<code>` block.
6. Theme changes participate in existing undo/redo history through content-style patches.
7. Document version remains `3`.

## Self-Review Checklist

- No document version bump.
- No global code theme preference.
- No official highlight.js theme CSS imports.
- No theme logic in task/image/topic node content.
- No canvas-side code editing introduced.
- Historical v3 missing-theme migration is covered by tests.
- Unknown theme values are rejected by current schema.
- Inspector theme select emits a style patch instead of editing content.
- `npm run typecheck`, `npm test`, and `git diff --check` pass before completion.
