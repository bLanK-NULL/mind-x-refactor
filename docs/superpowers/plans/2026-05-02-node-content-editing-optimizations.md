# Node Content Editing Optimizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move topic/code content editing onto the canvas, add CodeMirror-backed code nodes with language metadata, improve image/link defaults and behavior, optimize child placement, and intercept browser save shortcuts for document save.

**Architecture:** Keep the existing editor split: shared schemas define persisted document shape, mind-engine commands/session own document mutations, and web node content components own canvas interactions. `NodeInspector.vue` remains the shell/style host, while `TopicNodeContent.vue` and `CodeNodeContent.vue` own their primary content editing. CodeMirror setup is isolated in a small web utility so `CodeNodeContent.vue` stays focused on value sync and commit behavior.

**Tech Stack:** TypeScript, Vue 3 SFCs, Pinia editor store bridge, Vitest source/unit tests, Zod shared schemas, mind-engine patch commands, CodeMirror 6 via `vue-codemirror`.

---

## Spec

`docs/superpowers/specs/2026-05-02-node-content-editing-optimizations-design.md`

## File Structure

Modify:

- `package-lock.json`
  Records CodeMirror dependency installation for the workspace.
- `apps/web/package.json`
  Adds CodeMirror and `vue-codemirror` dependencies.
- `packages/shared/src/document.ts`
  Adds code language schema/defaults, makes current code nodes require `language`, migrates historical code nodes, and changes image fit default to `contain`.
- `packages/shared/src/document.test.ts`
  Covers code language defaults/schema/migration and image fit defaults.
- `packages/mind-engine/src/commands.ts`
  Adds default code language data and right-lower child placement.
- `packages/mind-engine/src/__tests__/commands.test.ts`
  Covers engine defaults and new child placement.
- `packages/mind-engine/src/__tests__/editorSession.test.ts`
  Updates code-node expectations to include language.
- `apps/web/src/features/editor/__tests__/editor.store.test.ts`
  Updates code-node store expectations to include language.
- `apps/web/src/features/editor/utils/codeEditor.ts`
  New CodeMirror language/theme/wrap extension builder.
- `apps/web/src/features/editor/__tests__/codeEditor.test.ts`
  Tests code language option order, fallback, and extension construction.
- `apps/web/src/features/editor/components/canvas/node-content/CodeNodeContent.vue`
  Replaces read-only highlighted code with an always-editable CodeMirror surface.
- `apps/web/src/features/editor/components/inspectors/node-inspectors/CodeNodeInspector.vue`
  Removes the code textarea and adds language control.
- `apps/web/src/features/editor/components/canvas/node-content/TopicNodeContent.vue`
  Changes topic editing trigger from double-click to click.
- `apps/web/src/features/editor/components/inspectors/node-inspectors/TopicNodeInspector.vue`
  Removes the inspector title field.
- `apps/web/src/features/editor/components/canvas/node-content/LinkNodeContent.vue`
  Adds favicon fallback, semantic clickable targets, hover affordance, and `_blank` opening.
- `apps/web/src/features/editor/components/MindEditor.vue`
  Intercepts `Cmd+S` / `Ctrl+S` before input-target shortcut filtering.
- `apps/web/src/features/editor/utils/keyboardTargets.ts`
  Adds a tested save-shortcut helper.
- `apps/web/src/features/editor/__tests__/keyboardTargets.test.ts`
  Covers save-shortcut detection.
- `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`
  Updates node content ownership/source tests for CodeMirror, Topic click editing, Link behavior, and export boundaries.
- `apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts`
  Updates inspector ownership tests for Topic and Code.
- `apps/web/src/features/editor/__tests__/editorControls.test.ts`
  Updates generic inspector and shortcut boundary tests.

Do not modify:

- `apps/web/src/features/editor/services/exportClone.ts`
- `apps/web/src/features/editor/services/exportPng.ts`
- `apps/web/src/features/editor/components/canvas/node-content/ImageNodeContent.vue`

Image rendering already uses `node.contentStyle.objectFit`; this phase changes the shared default, not the image renderer.

---

### Task 1: Shared Code Language Schema And Image Default

**Files:**

- Modify: `packages/shared/src/document.ts`
- Modify: `packages/shared/src/document.test.ts`

- [ ] **Step 1: Write failing shared schema tests**

In `packages/shared/src/document.test.ts`, extend the import from `./index.js`:

```ts
  CODE_LANGUAGES,
  DEFAULT_CODE_LANGUAGE,
  codeLanguageSchema,
```

Update the existing `defines the code block theme defaults` test to also assert the image and code language defaults:

```ts
  it('defines the code block, language, and image defaults', () => {
    expect(DEFAULT_CODE_THEME).toBe('vscode-dark')
    expect(DEFAULT_CODE_LANGUAGE).toBe('typescript')
    expect(DEFAULT_CODE_CONTENT_STYLE).toEqual({
      wrap: true,
      theme: 'vscode-dark'
    })
    expect(DEFAULT_IMAGE_CONTENT_STYLE).toEqual({
      objectFit: 'contain'
    })
  })
```

Add this test after `accepts the supported code block themes`:

```ts
  it('accepts the supported code languages', () => {
    expect(CODE_LANGUAGES).toEqual([
      'plaintext',
      'javascript',
      'typescript',
      'json',
      'css',
      'html',
      'markdown',
      'python',
      'bash'
    ])

    for (const language of CODE_LANGUAGES) {
      expect(codeLanguageSchema.parse(language)).toBe(language)
    }
  })
```

In the existing `accepts v3 documents with every supported node type` test, change the code node data to include language:

```ts
          data: { code: 'const answer = 42', language: DEFAULT_CODE_LANGUAGE },
```

Add this test near the existing historical code theme migration test:

```ts
  it('migrates historical v3 code nodes missing language to the default language', () => {
    const historicalV3 = v3Document({
      nodes: [
        {
          id: 'code',
          type: 'code',
          position: { x: 0, y: 0 },
          size: DEFAULT_NODE_SIZE_BY_TYPE.code,
          shellStyle: DEFAULT_NODE_SHELL_STYLE,
          data: { code: 'const value = 1' },
          contentStyle: DEFAULT_CODE_CONTENT_STYLE
        }
      ]
    })

    expect(migrateMindDocumentToV3(historicalV3).nodes[0]).toMatchObject({
      type: 'code',
      data: {
        code: 'const value = 1',
        language: DEFAULT_CODE_LANGUAGE
      }
    })
  })
```

Add this test near `rejects invalid v3 shell and content styles`:

```ts
  it('rejects current code nodes with missing or unknown languages', () => {
    const missingLanguage = v3Document({
      nodes: [
        {
          id: 'code',
          type: 'code',
          position: { x: 0, y: 0 },
          size: DEFAULT_NODE_SIZE_BY_TYPE.code,
          shellStyle: DEFAULT_NODE_SHELL_STYLE,
          data: { code: 'const value = 1' },
          contentStyle: DEFAULT_CODE_CONTENT_STYLE
        }
      ]
    })

    const unknownLanguage = v3Document({
      nodes: [
        {
          id: 'code',
          type: 'code',
          position: { x: 0, y: 0 },
          size: DEFAULT_NODE_SIZE_BY_TYPE.code,
          shellStyle: DEFAULT_NODE_SHELL_STYLE,
          data: { code: 'const value = 1', language: 'ruby' },
          contentStyle: DEFAULT_CODE_CONTENT_STYLE
        }
      ]
    })

    expect(mindDocumentV3Schema.safeParse(missingLanguage).success).toBe(false)
    expect(mindDocumentV3Schema.safeParse(unknownLanguage).success).toBe(false)
  })
```

Update every other test fixture in `packages/shared/src/document.test.ts` that creates a current code node so it includes:

```ts
language: DEFAULT_CODE_LANGUAGE
```

- [ ] **Step 2: Run the focused shared test and verify it fails**

Run:

```bash
npm test -w packages/shared -- src/document.test.ts
```

Expected: FAIL because `CODE_LANGUAGES`, `DEFAULT_CODE_LANGUAGE`, and `codeLanguageSchema` do not exist, image default is still `cover`, and current code-node language is optional.

- [ ] **Step 3: Implement shared language schema, migration, and image default**

In `packages/shared/src/document.ts`, add language constants after the code theme constants:

```ts
export const CODE_LANGUAGES = [
  'plaintext',
  'javascript',
  'typescript',
  'json',
  'css',
  'html',
  'markdown',
  'python',
  'bash'
] as const
export const codeLanguageSchema = z.enum(CODE_LANGUAGES)
export type CodeLanguage = z.infer<typeof codeLanguageSchema>
export const DEFAULT_CODE_LANGUAGE: CodeLanguage = 'typescript'
```

Change the image default:

```ts
export const DEFAULT_IMAGE_CONTENT_STYLE = {
  objectFit: 'contain'
} as const satisfies z.infer<typeof imageContentStyleSchema>
```

Change the current code node schema so `language` is required and validated:

```ts
const codeNodeV3Schema = nodeBaseV3Schema.extend({
  type: z.literal('code'),
  data: z.object({
    code: z.string().max(CODE_NODE_CODE_MAX_LENGTH),
    language: codeLanguageSchema
  }).strict(),
  contentStyle: codeContentStyleSchema
}).strict()
```

Change the legacy code node schema so historical documents may omit language but cannot contain unsupported language strings:

```ts
const legacyCodeNodeV3Schema = nodeBaseV3Schema.extend({
  type: z.literal('code'),
  data: z.object({
    code: z.string().max(CODE_NODE_CODE_MAX_LENGTH),
    language: codeLanguageSchema.optional()
  }).strict(),
  contentStyle: legacyCodeContentStyleSchema
}).strict()
```

Update `normalizeV3MindNode`:

```ts
function normalizeV3MindNode(node: z.infer<typeof migratableMindNodeV3Schema>): z.infer<typeof mindNodeV3Schema> {
  if (node.type !== 'code') {
    return node
  }

  return {
    ...node,
    data: {
      ...node.data,
      language: node.data.language ?? DEFAULT_CODE_LANGUAGE
    },
    contentStyle: {
      ...node.contentStyle,
      theme: node.contentStyle.theme ?? DEFAULT_CODE_THEME
    }
  }
}
```

Export the new type near the existing content style types:

```ts
export type CodeLanguage = z.infer<typeof codeLanguageSchema>
```

If TypeScript reports a duplicate type because the type is already exported near the constant, keep the earlier exported type and do not add the second export line.

- [ ] **Step 4: Run the focused shared test and verify it passes**

Run:

```bash
npm test -w packages/shared -- src/document.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit shared schema changes**

```bash
git add packages/shared/src/document.ts packages/shared/src/document.test.ts
git commit -m "feat(shared): add code language defaults"
```

---

### Task 2: Engine Defaults And Right-Lower Child Placement

**Files:**

- Modify: `packages/mind-engine/src/commands.ts`
- Modify: `packages/mind-engine/src/__tests__/commands.test.ts`
- Modify: `packages/mind-engine/src/__tests__/editorSession.test.ts`
- Modify: `apps/web/src/features/editor/__tests__/editor.store.test.ts`

- [ ] **Step 1: Write failing engine command tests**

In `packages/mind-engine/src/__tests__/commands.test.ts`, extend the shared import:

```ts
  DEFAULT_CODE_LANGUAGE,
```

In the existing `adds every node type as a child and keeps graph rules type-agnostic` test, after the content style expectations, add:

```ts
    expect(result.nodes.find((node) => node.id === 'node-4')).toMatchObject({
      type: 'code',
      data: {
        code: 'const x = 1',
        language: DEFAULT_CODE_LANGUAGE
      },
      contentStyle: DEFAULT_CODE_CONTENT_STYLE
    })
    expect(result.nodes.find((node) => node.id === 'node-1')).toMatchObject({
      type: 'image',
      contentStyle: DEFAULT_IMAGE_CONTENT_STYLE
    })
```

Replace the existing `adds a child node to the right of its parent` test with:

```ts
  it('adds child nodes to the right and lower than their parent', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push(topicNode('root', 'Root', { x: 10, y: 20 }, { width: 160, height: 48 }))

    const withFirstChild = addChildNode(doc, {
      parentId: 'root',
      id: 'child-1',
      title: 'Child 1'
    })
    const withSecondChild = addChildNode(withFirstChild, {
      parentId: 'root',
      id: 'child-2',
      title: 'Child 2'
    })

    expect(withFirstChild.nodes.find((node) => node.id === 'child-1')?.position).toEqual({ x: 250, y: 76 })
    expect(withSecondChild.nodes.find((node) => node.id === 'child-2')?.position).toEqual({ x: 250, y: 148 })
    expect(getParentId(withSecondChild, 'child-1')).toBe('root')
    expect(getParentId(withSecondChild, 'child-2')).toBe('root')
  })
```

Update `packages/mind-engine/src/__tests__/editorSession.test.ts` and `apps/web/src/features/editor/__tests__/editor.store.test.ts` wherever a code node is expected with `data: { code: ... }`; include language in the expected data:

```ts
data: { code: 'const a = 2', language: DEFAULT_CODE_LANGUAGE }
```

Add `DEFAULT_CODE_LANGUAGE` to those test imports when needed.

- [ ] **Step 2: Run focused engine/store tests and verify they fail**

Run:

```bash
npm test -w packages/mind-engine -- src/__tests__/commands.test.ts src/__tests__/editorSession.test.ts
npm test -w apps/web -- src/features/editor/__tests__/editor.store.test.ts
```

Expected: FAIL because default code node data lacks `language` and child placement still uses the old y-coordinate rule.

- [ ] **Step 3: Implement engine defaults and child placement**

In `packages/mind-engine/src/commands.ts`, add `DEFAULT_CODE_LANGUAGE` to the shared import:

```ts
  DEFAULT_CODE_LANGUAGE,
```

Add a new y offset constant next to the existing gap constants:

```ts
const CHILD_GAP_X = 80
const CHILD_GAP_Y = 56
const SIBLING_GAP_Y = 72
```

Change the code default data branch:

```ts
  if (type === 'code') {
    return { code: '', language: DEFAULT_CODE_LANGUAGE }
  }
```

Change the child placement calculation:

```ts
  const position = {
    x: parent.position.x + parentWidth + CHILD_GAP_X,
    y: parent.position.y + CHILD_GAP_Y + childCount * SIBLING_GAP_Y
  }
```

- [ ] **Step 4: Run focused engine/store tests and verify they pass**

Run:

```bash
npm test -w packages/mind-engine -- src/__tests__/commands.test.ts src/__tests__/editorSession.test.ts
npm test -w apps/web -- src/features/editor/__tests__/editor.store.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit engine default and placement changes**

```bash
git add packages/mind-engine/src/commands.ts packages/mind-engine/src/__tests__/commands.test.ts packages/mind-engine/src/__tests__/editorSession.test.ts apps/web/src/features/editor/__tests__/editor.store.test.ts
git commit -m "feat(engine): default code language and child placement"
```

---

### Task 3: CodeMirror Dependencies And Code Editor Utility

**Files:**

- Modify: `apps/web/package.json`
- Modify: `package-lock.json`
- Create: `apps/web/src/features/editor/utils/codeEditor.ts`
- Create: `apps/web/src/features/editor/__tests__/codeEditor.test.ts`

- [ ] **Step 1: Install CodeMirror dependencies for the web workspace**

Run:

```bash
npm install -w apps/web vue-codemirror codemirror @codemirror/state @codemirror/view @codemirror/language @codemirror/lang-javascript @codemirror/lang-json @codemirror/lang-css @codemirror/lang-html @codemirror/lang-markdown @codemirror/lang-python @codemirror/legacy-modes
```

Expected: `apps/web/package.json` and `package-lock.json` are updated with the CodeMirror packages.

- [ ] **Step 2: Write failing code editor utility tests**

Create `apps/web/src/features/editor/__tests__/codeEditor.test.ts`:

```ts
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
```

- [ ] **Step 3: Run the focused web test and verify it fails**

Run:

```bash
npm test -w apps/web -- src/features/editor/__tests__/codeEditor.test.ts
```

Expected: FAIL because `../utils/codeEditor` does not exist.

- [ ] **Step 4: Implement the CodeMirror utility**

Create `apps/web/src/features/editor/utils/codeEditor.ts`:

```ts
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
        minHeight: '100%',
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
```

- [ ] **Step 5: Run the focused web test and verify it passes**

Run:

```bash
npm test -w apps/web -- src/features/editor/__tests__/codeEditor.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit CodeMirror dependency and utility changes**

```bash
git add apps/web/package.json package-lock.json apps/web/src/features/editor/utils/codeEditor.ts apps/web/src/features/editor/__tests__/codeEditor.test.ts
git commit -m "feat(web): add codemirror editor utility"
```

---

### Task 4: CodeNodeContent Always-Editable CodeMirror Surface

**Files:**

- Modify: `apps/web/src/features/editor/components/canvas/node-content/CodeNodeContent.vue`
- Modify: `apps/web/src/features/editor/components/inspectors/node-inspectors/CodeNodeInspector.vue`
- Modify: `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`
- Modify: `apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts`
- Modify: `apps/web/src/features/editor/__tests__/editorControls.test.ts`

- [ ] **Step 1: Write failing CodeNode content and inspector tests**

In `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`, replace the `keeps non-topic content read-only on the canvas` test with:

```ts
  it('keeps attachment content read-only while code and link own their own interactions', () => {
    const attachmentSource = readNodeContentSource('AttachmentNodeContent')

    expect(attachmentSource).toContain('node:')
    expect(attachmentSource).not.toContain('editing: boolean')
    expect(attachmentSource).not.toContain('defineEmits')
    expect(attachmentSource).not.toContain('function commitEdit')
    expect(attachmentSource).not.toContain('function cancelEdit')
    expect(attachmentSource).not.toContain('v-if="editing"')
    expect(attachmentSource).not.toContain('@commit')
    expect(attachmentSource).not.toContain('@keydown.esc.prevent')
    expect(attachmentSource).toContain('@click.prevent')
    expect(readNodeContentSource('CodeNodeContent')).toContain('vue-codemirror')
    expect(readNodeContentSource('CodeNodeContent')).toContain("emit('commit', { code: editorCode.value })")
    expect(readNodeContentSource('CodeNodeContent')).toContain('@blur="commitCode"')
    expect(readNodeContentSource('CodeNodeContent')).toContain('@keydown.esc')
  })
```

Replace the existing `renders code highlighting with selected theme variables while staying scrollable` test with:

```ts
  it('renders code nodes as an always-editable CodeMirror surface', () => {
    const source = readNodeContentSource('CodeNodeContent')

    expect(source).toContain("import { Codemirror } from 'vue-codemirror'")
    expect(source).toContain("import { isValidCode } from '@mind-x/mind-engine'")
    expect(source).toContain("import { createCodeEditorExtensions } from '../../../utils/codeEditor'")
    expect(source).toContain('const editorCode = ref(props.node.data.code)')
    expect(source).toContain('createCodeEditorExtensions')
    expect(source).toContain('props.node.data.language')
    expect(source).toContain('props.node.contentStyle.theme')
    expect(source).toContain('props.node.contentStyle.wrap')
    expect(source).toContain('<Codemirror')
    expect(source).toContain('v-model="editorCode"')
    expect(source).toContain(':extensions="extensions"')
    expect(source).toContain('@blur="commitCode"')
    expect(source).toContain('@pointerdown.stop')
    expect(source).not.toContain('v-html="highlighted.html"')
    expect(source).not.toContain('highlightCode')
  })
```

In `apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts`, replace the code inspector test body with:

```ts
    expect(source).toContain("type CodeNodeModel = Extract<MindNode, { type: 'code' }>")
    expect(source).toContain('node: CodeNodeModel')
    expect(source).toContain('label="Language"')
    expect(source).toContain('label="Theme"')
    expect(source).toContain('label="Wrap"')
    expect(source.indexOf('label="Language"')).toBeLessThan(source.indexOf('label="Theme"'))
    expect(source.indexOf('label="Theme"')).toBeLessThan(source.indexOf('label="Wrap"'))
    expect(source).toContain('CODE_LANGUAGE_OPTIONS')
    expect(source).toContain('resolveCodeLanguage(props.node.data.language)')
    expect(source).toContain('CODE_THEME_OPTIONS')
    expect(source).toContain('resolveCodeTheme(props.node.contentStyle.theme)')
    expect(source).toContain("emit('contentChange', { language })")
    expect(source).toContain("emit('contentStyleChange', { theme })")
    expect(source).toContain("emit('contentStyleChange', { wrap: checkedValue(event) })")
    expect(source).not.toContain('CODE_NODE_CODE_MAX_LENGTH')
    expect(source).not.toContain('isValidCode')
    expect(source).not.toContain('label="Code"')
    expect(source).not.toContain('<a-textarea')
    expect(source).not.toContain("emit('contentChange', { code })")
```

In `apps/web/src/features/editor/__tests__/editorControls.test.ts`, update the generic NodeInspector boundary test so it no longer expects Code inspector content editing. Add:

```ts
    const codeInspectorSource = readEditorSource('../components/inspectors/node-inspectors/CodeNodeInspector.vue')
    expect(codeInspectorSource).not.toContain('label="Code"')
    expect(codeInspectorSource).not.toContain("emit('contentChange', { code })")
    expect(codeInspectorSource).toContain('label="Language"')
```

- [ ] **Step 2: Run focused web source tests and verify they fail**

Run:

```bash
npm test -w apps/web -- src/features/editor/__tests__/nodeRenderer.test.ts src/features/editor/__tests__/nodeInspectorArchitecture.test.ts src/features/editor/__tests__/editorControls.test.ts
```

Expected: FAIL because CodeNode is still read-only and Code inspector still owns the code textarea.

- [ ] **Step 3: Replace CodeNodeContent with CodeMirror editing**

Replace `apps/web/src/features/editor/components/canvas/node-content/CodeNodeContent.vue` with:

```vue
<script setup lang="ts">
import type { MindNode } from '@mind-x/shared'
import { isValidCode } from '@mind-x/mind-engine'
import { Codemirror } from 'vue-codemirror'
import { computed, ref, watch } from 'vue'
import { createCodeEditorExtensions } from '../../../utils/codeEditor'

type CodeNodeModel = Extract<MindNode, { type: 'code' }>

const props = defineProps<{
  node: CodeNodeModel
}>()

const emit = defineEmits<{
  commit: [dataPatch: { code: string }]
}>()

const editorCode = ref(props.node.data.code)

const extensions = computed(() =>
  createCodeEditorExtensions({
    language: props.node.data.language,
    theme: props.node.contentStyle.theme,
    wrap: props.node.contentStyle.wrap
  })
)

watch(
  () => props.node.data.code,
  (code) => {
    if (code !== editorCode.value) {
      editorCode.value = code
    }
  }
)

function commitCode(): void {
  if (editorCode.value === props.node.data.code) {
    return
  }

  if (!isValidCode(editorCode.value)) {
    editorCode.value = props.node.data.code
    return
  }

  emit('commit', { code: editorCode.value })
}

function cancelCode(): void {
  editorCode.value = props.node.data.code
}
</script>

<template>
  <div class="code-node__content" @dblclick.stop @pointerdown.stop>
    <Codemirror
      v-model="editorCode"
      class="code-node__editor"
      :autofocus="false"
      :auto-destroy="true"
      :disabled="false"
      :extensions="extensions"
      :indent-with-tab="true"
      :style="{ height: '100%', width: '100%' }"
      :tab-size="2"
      data-editor-control
      @blur="commitCode"
      @keydown.esc.prevent.stop="cancelCode"
    />
  </div>
</template>

<style scoped>
.code-node__content {
  display: grid;
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
}

.code-node__editor {
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
}

:deep(.cm-editor) {
  width: 100%;
  height: 100%;
}
</style>
```

- [ ] **Step 4: Replace CodeNodeInspector content controls**

Replace `apps/web/src/features/editor/components/inspectors/node-inspectors/CodeNodeInspector.vue` with:

```vue
<script setup lang="ts">
import type { MindNode } from '@mind-x/shared'
import { computed } from 'vue'
import {
  CODE_THEME_OPTIONS,
  resolveCodeTheme
} from '../../../utils/codeThemes'
import {
  CODE_LANGUAGE_OPTIONS,
  resolveCodeLanguage
} from '../../../utils/codeEditor'
import StyleField from '../StyleField.vue'

type CodeNodeModel = Extract<MindNode, { type: 'code' }>

const props = defineProps<{
  node: CodeNodeModel
}>()

const emit = defineEmits<{
  contentChange: [dataPatch: Record<string, unknown>]
  contentStyleChange: [stylePatch: Record<string, unknown>]
}>()

function checkedValue(event: Event): boolean {
  return (event.target as HTMLInputElement).checked
}

const selectedLanguage = computed(() => resolveCodeLanguage(props.node.data.language))
const selectedTheme = computed(() => resolveCodeTheme(props.node.contentStyle.theme))

function emitLanguageChange(value: unknown): void {
  const language = resolveCodeLanguage(value)
  emit('contentChange', { language })
}

function emitThemeChange(value: unknown): void {
  const theme = resolveCodeTheme(value)
  emit('contentStyleChange', { theme })
}
</script>

<template>
  <section class="code-node-inspector" aria-label="Code node inspector">
    <StyleField label="Language">
      <a-select
        :value="selectedLanguage"
        size="small"
        @change="emitLanguageChange"
      >
        <a-select-option
          v-for="option in CODE_LANGUAGE_OPTIONS"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </a-select-option>
      </a-select>
    </StyleField>
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
    <StyleField label="Wrap">
      <a-checkbox
        :checked="node.contentStyle.wrap"
        @change="(event: Event) => emit('contentStyleChange', { wrap: checkedValue(event) })"
      >
        Wrap long lines
      </a-checkbox>
    </StyleField>
  </section>
</template>

<style scoped>
.code-node-inspector {
  display: grid;
  gap: 10px;
}

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
  flex-shrink: 0;
  align-items: center;
  gap: 2px;
}

.code-node-inspector__theme-swatch {
  width: 10px;
  height: 10px;
  border: 1px solid rgb(0 0 0 / 12%);
  border-radius: 2px;
}
</style>
```

- [ ] **Step 5: Run focused web source tests and verify they pass**

Run:

```bash
npm test -w apps/web -- src/features/editor/__tests__/nodeRenderer.test.ts src/features/editor/__tests__/nodeInspectorArchitecture.test.ts src/features/editor/__tests__/editorControls.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit CodeNode UI changes**

```bash
git add apps/web/src/features/editor/components/canvas/node-content/CodeNodeContent.vue apps/web/src/features/editor/components/inspectors/node-inspectors/CodeNodeInspector.vue apps/web/src/features/editor/__tests__/nodeRenderer.test.ts apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts apps/web/src/features/editor/__tests__/editorControls.test.ts
git commit -m "feat(web): make code nodes directly editable"
```

---

### Task 5: Topic Click Editing And Inspector Cleanup

**Files:**

- Modify: `apps/web/src/features/editor/components/canvas/node-content/TopicNodeContent.vue`
- Modify: `apps/web/src/features/editor/components/inspectors/node-inspectors/TopicNodeInspector.vue`
- Modify: `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`
- Modify: `apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts`
- Modify: `apps/web/src/features/editor/__tests__/editorControls.test.ts`

- [ ] **Step 1: Write failing Topic ownership tests**

In `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`, update `keeps topic inline editing inside TopicNodeContent`:

```ts
    expect(source).toContain('@click.stop="startEditing"')
    expect(source).not.toContain('@dblclick.stop="startEditing"')
```

Keep the existing blur, Enter, Esc, validation, pointer isolation, and commit expectations in that test.

In `apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts`, update the topic inspector test body:

```ts
    expect(source).toContain("type TopicNodeModel = Extract<MindNode, { type: 'topic' }>")
    expect(source).toContain('node: TopicNodeModel')
    expect(source).toContain('label="Text"')
    expect(source).toContain("emit('contentStyleChange', { textWeight })")
    expect(source).not.toContain('isValidPlainText')
    expect(source).not.toContain('PLAIN_TEXT_MAX_LENGTH')
    expect(source).not.toContain('label="Title"')
    expect(source).not.toContain("emit('contentChange', { title })")
    expect(source).not.toContain('<a-input')
```

In `apps/web/src/features/editor/__tests__/editorControls.test.ts`, add to the generic boundary test:

```ts
    const topicInspectorSource = readEditorSource('../components/inspectors/node-inspectors/TopicNodeInspector.vue')
    expect(topicInspectorSource).not.toContain('label="Title"')
    expect(topicInspectorSource).not.toContain("emit('contentChange', { title })")
    expect(topicInspectorSource).toContain('label="Text"')
```

- [ ] **Step 2: Run focused web source tests and verify they fail**

Run:

```bash
npm test -w apps/web -- src/features/editor/__tests__/nodeRenderer.test.ts src/features/editor/__tests__/nodeInspectorArchitecture.test.ts src/features/editor/__tests__/editorControls.test.ts
```

Expected: FAIL because topic editing still uses double-click and the inspector still exposes `Title`.

- [ ] **Step 3: Change TopicNodeContent to click-to-edit**

In `apps/web/src/features/editor/components/canvas/node-content/TopicNodeContent.vue`, replace:

```vue
  <div class="topic-node__content" :class="contentClass" @dblclick.stop="startEditing">
```

with:

```vue
  <div class="topic-node__content" :class="contentClass" @click.stop="startEditing">
```

Keep the existing input behavior:

```vue
        @blur="commitEdit"
        @keydown.esc.prevent="cancelEdit"
        @pointerdown.stop
```

- [ ] **Step 4: Remove Topic title editing from the inspector**

Replace `apps/web/src/features/editor/components/inspectors/node-inspectors/TopicNodeInspector.vue` with:

```vue
<script setup lang="ts">
import type { MindNode } from '@mind-x/shared'
import StyleField from '../StyleField.vue'

type TopicNodeModel = Extract<MindNode, { type: 'topic' }>

defineProps<{
  node: TopicNodeModel
}>()

const emit = defineEmits<{
  contentStyleChange: [stylePatch: Record<string, unknown>]
}>()

function emitTextWeightChange(textWeight: unknown): void {
  emit('contentStyleChange', { textWeight })
}
</script>

<template>
  <section class="topic-node-inspector" aria-label="Topic node inspector">
    <StyleField label="Text">
      <a-select
        :value="node.contentStyle.textWeight"
        size="small"
        @change="emitTextWeightChange"
      >
        <a-select-option value="regular">Regular</a-select-option>
        <a-select-option value="medium">Medium</a-select-option>
        <a-select-option value="bold">Bold</a-select-option>
      </a-select>
    </StyleField>
  </section>
</template>

<style scoped>
.topic-node-inspector {
  display: grid;
  gap: 10px;
}
</style>
```

- [ ] **Step 5: Run focused web source tests and verify they pass**

Run:

```bash
npm test -w apps/web -- src/features/editor/__tests__/nodeRenderer.test.ts src/features/editor/__tests__/nodeInspectorArchitecture.test.ts src/features/editor/__tests__/editorControls.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Topic editing changes**

```bash
git add apps/web/src/features/editor/components/canvas/node-content/TopicNodeContent.vue apps/web/src/features/editor/components/inspectors/node-inspectors/TopicNodeInspector.vue apps/web/src/features/editor/__tests__/nodeRenderer.test.ts apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts apps/web/src/features/editor/__tests__/editorControls.test.ts
git commit -m "feat(web): edit topic titles on the node"
```

---

### Task 6: LinkNode Favicon And Clickable Targets

**Files:**

- Modify: `apps/web/src/features/editor/components/canvas/node-content/LinkNodeContent.vue`
- Modify: `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`

- [ ] **Step 1: Write failing LinkNode source tests**

In `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`, add this test:

```ts
  it('renders link nodes with local favicon fallback and clickable link targets', () => {
    const source = readNodeContentSource('LinkNodeContent')

    expect(source).toContain("import { ExportOutlined, LinkOutlined } from '@ant-design/icons-vue'")
    expect(source).toContain('function resolveFaviconUrl')
    expect(source).toContain("new URL(url).origin")
    expect(source).toContain("'/favicon.ico'")
    expect(source).toContain('faviconFailed')
    expect(source).toContain('@error="faviconFailed = true"')
    expect(source).toContain('<LinkOutlined />')
    expect(source).toContain('<ExportOutlined />')
    expect(source).toContain('target="_blank"')
    expect(source).toContain('rel="noopener noreferrer"')
    expect(source).toContain('@pointerdown.stop')
    expect(source).toContain('@dragstart.prevent')
    expect(source).not.toContain('@click.prevent')
  })
```

Update the existing native drag test expectations so LinkNode still has:

```ts
expect(readNodeContentSource('LinkNodeContent')).toContain('draggable="false"')
expect(readNodeContentSource('LinkNodeContent')).toContain('@dragstart.prevent')
```

Remove any assertion that expects `LinkNodeContent` to contain `@click.prevent`.

- [ ] **Step 2: Run focused node renderer tests and verify they fail**

Run:

```bash
npm test -w apps/web -- src/features/editor/__tests__/nodeRenderer.test.ts
```

Expected: FAIL because LinkNode currently prevents clicks and has no favicon fallback.

- [ ] **Step 3: Replace LinkNodeContent behavior and styles**

Replace `apps/web/src/features/editor/components/canvas/node-content/LinkNodeContent.vue` with:

```vue
<script setup lang="ts">
import type { MindNode } from '@mind-x/shared'
import { ExportOutlined, LinkOutlined } from '@ant-design/icons-vue'
import { computed, ref, watch } from 'vue'

type LinkNodeModel = Extract<MindNode, { type: 'link' }>

const props = defineProps<{
  node: LinkNodeModel
}>()

const faviconFailed = ref(false)

const faviconUrl = computed(() => resolveFaviconUrl(props.node.data.url))
const safeHref = computed(() => resolveWebUrl(props.node.data.url))

watch(
  () => props.node.data.url,
  () => {
    faviconFailed.value = false
  }
)

function resolveWebUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : undefined
  } catch {
    return undefined
  }
}

function resolveFaviconUrl(url: string): string {
  try {
    return `${new URL(url).origin}/favicon.ico`
  } catch {
    return ''
  }
}
</script>

<template>
  <div class="link-node__content">
    <a
      class="link-node__anchor"
      draggable="false"
      :href="safeHref"
      rel="noopener noreferrer"
      target="_blank"
      @dragstart.prevent
      @pointerdown.stop
    >
      <span class="link-node__title-row">
        <img
          v-if="faviconUrl && !faviconFailed"
          class="link-node__favicon"
          :alt="`${node.data.title} favicon`"
          draggable="false"
          :src="faviconUrl"
          @dragstart.prevent
          @error="faviconFailed = true"
        />
        <span v-else class="link-node__favicon-fallback" aria-hidden="true">
          <LinkOutlined />
        </span>
        <span class="link-node__title">{{ node.data.title }}</span>
        <ExportOutlined class="link-node__external" aria-hidden="true" />
      </span>
      <span class="link-node__url">{{ node.data.url }}</span>
    </a>
  </div>
</template>

<style scoped>
.link-node__content {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.link-node__anchor {
  display: inline-flex;
  max-width: 100%;
  min-width: 0;
  flex-direction: column;
  align-self: stretch;
  color: inherit;
  text-decoration: none;
}

.link-node__anchor:hover .link-node__title {
  text-decoration: underline;
}

.link-node__anchor:hover .link-node__external {
  opacity: 1;
  transform: translate(1px, -1px);
}

.link-node__title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.link-node__favicon,
.link-node__favicon-fallback {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  border-radius: 3px;
}

.link-node__favicon-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-subtle);
}

.link-node__title {
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 650;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.link-node__external {
  flex: 0 0 auto;
  opacity: 0.55;
  font-size: 12px;
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.link-node__url {
  overflow: hidden;
  padding-left: 22px;
  color: var(--color-text-subtle);
  font-size: 11px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
```

- [ ] **Step 4: Run focused node renderer tests and verify they pass**

Run:

```bash
npm test -w apps/web -- src/features/editor/__tests__/nodeRenderer.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit LinkNode behavior changes**

```bash
git add apps/web/src/features/editor/components/canvas/node-content/LinkNodeContent.vue apps/web/src/features/editor/__tests__/nodeRenderer.test.ts
git commit -m "feat(web): improve link node affordance"
```

---

### Task 7: Global Save Shortcut And Final Verification

**Files:**

- Modify: `apps/web/src/features/editor/utils/keyboardTargets.ts`
- Modify: `apps/web/src/features/editor/__tests__/keyboardTargets.test.ts`
- Modify: `apps/web/src/features/editor/components/MindEditor.vue`
- Modify: `apps/web/src/features/editor/__tests__/editorControls.test.ts`

- [ ] **Step 1: Write failing save shortcut tests**

In `apps/web/src/features/editor/__tests__/keyboardTargets.test.ts`, update the import:

```ts
import { isEditorShortcutTarget, isSaveShortcut } from '@/features/editor/utils/keyboardTargets'
```

Add this test:

```ts
  it('detects command and control save shortcuts independently of targets', () => {
    expect(isSaveShortcut({ key: 's', metaKey: true, ctrlKey: false })).toBe(true)
    expect(isSaveShortcut({ key: 'S', metaKey: true, ctrlKey: false })).toBe(true)
    expect(isSaveShortcut({ key: 's', metaKey: false, ctrlKey: true })).toBe(true)
    expect(isSaveShortcut({ key: 'z', metaKey: true, ctrlKey: false })).toBe(false)
    expect(isSaveShortcut({ key: 's', metaKey: false, ctrlKey: false })).toBe(false)
  })
```

In `apps/web/src/features/editor/__tests__/editorControls.test.ts`, add this test:

```ts
  it('handles save shortcuts before input-target shortcut filtering', () => {
    const source = readEditorSource('../components/MindEditor.vue')

    expect(source).toContain("import { isEditorShortcutTarget, isSaveShortcut } from '../utils/keyboardTargets'")
    expect(source).toContain('if (isSaveShortcut(event))')
    expect(source).toContain('event.preventDefault()')
    expect(source).toContain('save()')
    expect(source.indexOf('if (isSaveShortcut(event))')).toBeLessThan(source.indexOf('if (isEditorShortcutTarget(event.target))'))
  })
```

- [ ] **Step 2: Run focused shortcut tests and verify they fail**

Run:

```bash
npm test -w apps/web -- src/features/editor/__tests__/keyboardTargets.test.ts src/features/editor/__tests__/editorControls.test.ts
```

Expected: FAIL because `isSaveShortcut` does not exist and `MindEditor.vue` filters input targets before shortcut handling.

- [ ] **Step 3: Add save shortcut helper**

In `apps/web/src/features/editor/utils/keyboardTargets.ts`, add after `TEXT_EDITING_INPUT_TYPES`:

```ts
type KeyboardShortcutLike = {
  ctrlKey: boolean
  key: string
  metaKey: boolean
}

export function isSaveShortcut(event: KeyboardShortcutLike): boolean {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's'
}
```

- [ ] **Step 4: Handle save before input-target filtering**

In `apps/web/src/features/editor/components/MindEditor.vue`, replace the keyboard target import:

```ts
import { isEditorShortcutTarget, isSaveShortcut } from '../utils/keyboardTargets'
```

Change the start of `onKeydown`:

```ts
function onKeydown(event: KeyboardEvent): void {
  if (isSaveShortcut(event)) {
    event.preventDefault()
    save()
    return
  }

  if (isEditorShortcutTarget(event.target)) {
    return
  }
```

Keep the existing Tab, Delete, undo, and redo branches below this block.

- [ ] **Step 5: Run focused shortcut tests and verify they pass**

Run:

```bash
npm test -w apps/web -- src/features/editor/__tests__/keyboardTargets.test.ts src/features/editor/__tests__/editorControls.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run package-level verification**

Run:

```bash
npm test -w packages/shared
npm test -w packages/mind-engine
npm test -w apps/web
npm run typecheck
```

Expected: all commands PASS.

- [ ] **Step 7: Commit save shortcut and final verification changes**

```bash
git add apps/web/src/features/editor/utils/keyboardTargets.ts apps/web/src/features/editor/__tests__/keyboardTargets.test.ts apps/web/src/features/editor/components/MindEditor.vue apps/web/src/features/editor/__tests__/editorControls.test.ts
git commit -m "feat(web): intercept editor save shortcut"
```

---

## Plan Self-Review

Spec coverage:

- CodeNode editable CodeMirror surface: Task 3 and Task 4.
- CodeNode inspector removes code field and keeps language/theme/wrap: Task 4.
- Code language persistence and migration: Task 1 and Task 2.
- Topic direct editing and inspector title removal: Task 5.
- Image default `contain`: Task 1 and Task 2.
- Link favicon, fallback, hover affordance, and `_blank` targets: Task 6.
- Right-lower child placement: Task 2.
- Global `Cmd+S` / `Ctrl+S`: Task 7.

Placeholder scan: no `TBD`, `TODO`, incomplete sections, or unspecified implementation steps remain.

Type consistency:

- Shared schema exports `CodeLanguage`, `CODE_LANGUAGES`, and `DEFAULT_CODE_LANGUAGE`.
- Web code editor utility consumes `CodeLanguage` and existing `CodeBlockTheme`.
- Code inspector emits `contentChange` for `language` and `contentStyleChange` for theme/wrap.
- Code node content emits `{ code }` through the existing `NodeRenderer` commit path.
