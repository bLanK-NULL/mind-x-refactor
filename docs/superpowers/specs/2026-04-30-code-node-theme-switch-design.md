# Code Node Theme Switch Design

Date: 2026-04-30

Status: Approved for spec review

## Goal

Add per-code-node syntax theme switching from the CodeNode inspector pane. Each CodeNode stores its own theme, and rendering uses that node-level theme for the code block interior only.

## Non-Goals

- Do not add user-defined custom themes.
- Do not import or bundle highlight.js official CSS theme files.
- Do not make code themes affect node shell color, tone, shape, border, shadow, or size.
- Do not change the document version number.
- Do not make theme switching a global editor preference.

## Chosen Approach

Add a required `theme` field to `CodeContentStyle`, alongside the existing `wrap` field.

```ts
type CodeBlockTheme =
  | 'github-light'
  | 'github-dark'
  | 'vscode-dark'
  | 'dracula'
  | 'monokai'
  | 'nord'
  | 'solarized-light'
  | 'solarized-dark'

type CodeContentStyle = {
  wrap: boolean
  theme: CodeBlockTheme
}
```

`vscode-dark` is the default theme because the current code block rendering is already dark and close to a VS Code dark style.

## Document Contract And Migration

The current document remains `version: 3`.

`codeContentStyleSchema` adds a required `theme` enum. `DEFAULT_CODE_CONTENT_STYLE` becomes:

```ts
{
  wrap: true,
  theme: 'vscode-dark'
}
```

Historical v3 code nodes may have `contentStyle: { wrap: boolean }` with no `theme`. Read/migration boundaries must normalize those nodes by adding `theme: 'vscode-dark'`. After migration, all engine, store, inspector, and renderer code may treat `node.contentStyle.theme` as present.

Valid v3 documents with missing `code.contentStyle.theme` should parse through the migration/read path, not through strict write validation. Strict write validation rejects unknown theme values and rejects code content style objects with missing required fields after migration.

## Theme Registry

Add a focused frontend registry, for example:

`apps/web/src/features/editor/utils/codeThemes.ts`

The registry owns:

- `CODE_THEME_OPTIONS`: ordered inspector options with `value`, `label`, and `swatches`.
- `DEFAULT_CODE_THEME = 'vscode-dark'`.
- `resolveCodeThemeStyle(theme)`: returns CSS custom properties for rendering.

Each theme provides at least:

- `--code-bg`
- `--code-text`
- `--code-keyword`
- `--code-string`
- `--code-number`
- `--code-literal`
- `--code-title`
- `--code-attr`
- `--code-comment`

The resolver must fall back to `vscode-dark` for unknown values so defensive rendering remains stable even if corrupted or transitional data reaches the component.

Highlight.js already emits stable `.hljs-*` classes such as `.hljs-keyword`, `.hljs-string`, and `.hljs-comment`; custom CSS rules can theme those classes directly.

## Rendering

`CodeNodeContent.vue` continues using `highlightCode(props.node.data.code)` and the existing wrap behavior.

The component derives `themeStyle` from `resolveCodeThemeStyle(props.node.contentStyle.theme)` and applies it to the `<pre>` element:

```vue
<pre class="code-node__pre" :class="wrapClass" :style="themeStyle">
  <code :class="codeClass" v-html="highlighted.html" />
</pre>
```

The scoped CSS keeps the same layout and scrolling behavior, but colors come from CSS variables instead of one hard-coded palette.

```css
.code-node__pre {
  background: var(--code-bg);
  color: var(--code-text);
}

:deep(.hljs-keyword) {
  color: var(--code-keyword);
}
```

The code theme affects only the code block interior: background, base text, token colors, and optional scrollbar/selection details. The surrounding node shell stays controlled by `shellStyle`.

## Inspector Interaction

`CodeNodeInspector.vue` adds a `Theme` field near the existing content controls. The inspector order is:

1. Code
2. Theme
3. Wrap

The `Theme` field uses Ant Design Vue `a-select`. Each option should display the theme label and a compact swatch preview using the registry's `swatches` data. If Ant Design option rendering becomes unexpectedly costly, the first implementation may render text-only options while preserving the same `CODE_THEME_OPTIONS` swatch data for a follow-up polish pass.

Theme changes emit content style patches:

```ts
emit('contentStyleChange', { theme: theme as CodeBlockTheme })
```

This follows the existing `wrap` path:

`CodeNodeInspector -> NodeInspector -> MindEditor -> editor.setNodeContentStyle`

Because theme changes use `setNodeContentStyle`, they become undoable and redoable through the existing engine history flow.

Unknown theme values should not crash the inspector. The select should resolve unknown values to the default option for display, and the renderer should also fall back to `vscode-dark`.

## Presets

First implementation ships these presets:

- GitHub Light
- GitHub Dark
- VS Code Dark
- Dracula
- Monokai
- Nord
- Solarized Light
- Solarized Dark

The precise colors can be local approximations inspired by those common themes. They do not need to import third-party theme CSS.

## Error Handling

- Strict schema validation rejects unknown theme strings.
- Migration normalizes missing theme values on historical code nodes to `vscode-dark`.
- Rendering falls back to `vscode-dark` if an unknown value reaches `resolveCodeThemeStyle`.
- Inspector display falls back to `vscode-dark` for unknown values.
- Theme switching does not modify `node.data.code`.

## Testing

Shared schema and migration tests:

- `codeContentStyleSchema` accepts every supported theme.
- `DEFAULT_CODE_CONTENT_STYLE.theme` is `vscode-dark`.
- Historical v3 code nodes missing `contentStyle.theme` migrate to `vscode-dark`.
- Unknown theme values are rejected by strict validation.

Engine/store tests:

- New code nodes receive `theme: 'vscode-dark'`.
- `setNodeContentStyle(codeId, { theme: 'dracula' })` updates code theme.
- Undo/redo restores theme changes.

Web utility tests:

- `CODE_THEME_OPTIONS` exposes all eight presets in a stable order.
- `resolveCodeThemeStyle('dracula')` returns expected CSS variables.
- `resolveCodeThemeStyle('unknown')` falls back to `vscode-dark`.

Renderer tests:

- `CodeNodeContent.vue` uses `resolveCodeThemeStyle(node.contentStyle.theme)`.
- Code colors are driven by CSS custom properties, not one hard-coded theme.
- Wrap behavior remains independent of theme.

Inspector tests:

- `CodeNodeInspector.vue` renders a `Theme` field.
- It uses `CODE_THEME_OPTIONS`.
- Theme changes emit `contentStyleChange` with `{ theme }`.
- Theme selection does not emit `contentChange`.
- Option rendering includes swatch preview data or a documented text-only fallback while preserving swatch data.

## Acceptance Criteria

- Each CodeNode stores its own code theme in `contentStyle.theme`.
- Existing code nodes without a theme read as `vscode-dark`.
- New code nodes default to `vscode-dark`.
- The inspector can switch among all eight presets.
- Theme changes are undoable/redoable through existing content style updates.
- Code themes affect only the code block interior.
- The renderer and inspector fall back safely to `vscode-dark` for unknown runtime values.
- Full typecheck and tests pass.

## Self-Review

Placeholder scan: no placeholder sections remain.

Internal consistency: the design stores theme in `contentStyle`, uses the existing content style patch flow, and keeps code themes separate from node shell styles.

Scope check: the feature is limited to CodeNode schema, migration, web theme registry, CodeNode rendering, CodeNode inspector, and focused tests. It is small enough for one implementation plan.

Ambiguity check: default theme, preset list, node-level persistence, migration behavior, and non-goals are explicit.
