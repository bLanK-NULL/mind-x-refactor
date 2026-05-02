# Node Content Editing Optimizations Design

## Goal

Make common node content interactions happen directly on the mind map canvas instead of routing primary content through the inspector. Code nodes become real always-editable code editors, topic titles edit directly on the node, image nodes default to contained image display, link nodes gain stronger link semantics, new child placement becomes more canvas-friendly, and the editor intercepts browser save shortcuts for document save.

## Context

The current editor already separates node shell styling from type-specific node content:

- `NodeRenderer.vue` dispatches to `*NodeContent.vue` components.
- `NodeInspector.vue` hosts shell style controls and delegates type-specific controls to `node-inspectors/*`.
- `TaskNodeContent.vue` already owns task-item content editing directly on the node, while `TaskNodeInspector.vue` owns only task style.
- `TopicNodeContent.vue` supports inline title editing, but `TopicNodeInspector.vue` still exposes a `Title` field.
- `CodeNodeContent.vue` renders highlighted read-only code, while `CodeNodeInspector.vue` owns the code textarea.
- `LinkNodeContent.vue` currently prevents anchor clicks, so links do not open.
- `DEFAULT_IMAGE_CONTENT_STYLE.objectFit` is currently `cover`.
- Child node placement is currently right of the parent with y based on child index.
- `MindEditor.vue` already owns editor-level shortcuts, undo, redo, delete, tab-to-child, and emits `save`.

## Approved Approach

Use a node-content-owned editing model for content that users naturally edit on the canvas. The inspector remains a property surface for styling and metadata.

This is intentionally not a full content-inline refactor for every node type. Image URL, link URL/title, attachment URL/name, and other less frequently edited fields remain in their existing inspectors unless explicitly covered below.

## Architecture

`NodeRenderer.vue` remains the node-content dispatcher and continues forwarding content commits from node content components through `editCommit`.

`NodeInspector.vue` remains the node shell style host and the exhaustive type dispatcher. Type inspectors keep controls for style and metadata, but stop owning the main content fields that this design moves onto the canvas:

- `TopicNodeInspector.vue` removes the `Title` field and keeps `Text` weight.
- `CodeNodeInspector.vue` removes the `Code` textarea and keeps code configuration controls.
- `ImageNodeInspector.vue` keeps URL, Alt, and Fit.
- `LinkNodeInspector.vue` keeps Title and URL because link text/url editing is not part of this optimization.

`CodeNodeContent.vue` becomes a CodeMirror-backed editor surface. It owns a draft value while the editor has uncommitted changes, emits `{ code }` on blur when the draft differs from the stored node code, and responds to external document changes by syncing from `props.node.data.code`.

Add a small web editor utility for CodeMirror configuration. It maps `node.data.language`, `node.contentStyle.theme`, and `node.contentStyle.wrap` to CodeMirror extensions. This keeps CodeMirror setup out of the Vue component and leaves a clean boundary for future language/theme additions.

## CodeMirror Integration

Add CodeMirror for the web app using Vue 3 compatible CodeMirror 6 packages. Current documentation for `vue-codemirror` supports:

- `v-model` for editor document value.
- `@change` for value updates.
- `@blur` and `@focus` for editor focus lifecycle.
- `extensions` for language support, themes, and editor behavior.

The implementation should use CodeMirror as the actual editing surface rather than layering a textarea over highlighted HTML. This gives correct cursor placement, selection, multi-line editing, and editor behavior.

The first supported language set should be compact and practical:

- `plaintext`
- `javascript`
- `typescript`
- `json`
- `css`
- `html`
- `markdown`
- `python`
- `bash`

If a stored language is missing or unknown at runtime, render and edit with the default language.

## Shared Schema And Defaults

Code node data gains a language field:

```ts
{
  code: string
  language: CodeLanguage
}
```

Add a shared `codeLanguageSchema`, exported `CODE_LANGUAGES`, and `DEFAULT_CODE_LANGUAGE`. The default language is `typescript`.

`defaultNodeData('code')` creates:

```ts
{ code: '', language: DEFAULT_CODE_LANGUAGE }
```

Migration/read boundaries normalize historical code nodes that only have `code` by adding `language: DEFAULT_CODE_LANGUAGE`.

Image content default changes to:

```ts
export const DEFAULT_IMAGE_CONTENT_STYLE = {
  objectFit: 'contain'
}
```

Existing valid documents that explicitly store `objectFit: 'cover'` keep that value. Defaults synthesized during creation or migration use `contain`.

## Topic Node Behavior

Topic title editing happens directly on the node.

Behavior:

- A click on the title enters editing and focuses the input.
- Blur commits the trimmed title.
- Esc cancels and restores the stored title.
- Invalid titles do not commit. Invalid means empty after trimming or containing `<` or `>`.
- Pointer events inside the active input do not start canvas drag.

The inspector no longer exposes a `Title` input. It only exposes topic content style, currently text weight.

This changes the current double-click behavior to single-click direct editing, matching the approved interaction choice.

## Code Node Behavior

Code nodes are always editable.

Behavior:

- The normal CodeNode surface is the CodeMirror editor.
- Users can click to place the cursor, select text, and edit immediately.
- There is no read-only mode and no separate edit-mode toggle.
- Blur commits the current editor value if changed.
- Esc cancels the uncommitted draft and restores the stored code.
- Inspector no longer exposes a code textarea.
- Inspector exposes `Language`, `Theme`, and `Wrap`.
- Changing language updates `node.data.language`.
- Changing theme or wrap updates `node.contentStyle`.

The node should still work inside the canvas interaction model:

- Pointer interaction inside CodeMirror should not trigger canvas drag.
- Selecting code text should not move the node.
- Editor-level `Cmd+S` / `Ctrl+S` still saves the document while focus is in CodeMirror.

Validation uses the existing code validation rules before committing. Invalid code should not corrupt the document state.

## Link Node Behavior

Link nodes gain stronger link affordance while preserving canvas selection and drag.

Visual behavior:

- The title row shows a favicon to the left of the title.
- The favicon source is derived locally from the link URL: `new URL(node.data.url).origin + '/favicon.ico'`.
- Invalid URLs or image load failures show a fallback link icon.
- Hover adds subtle link affordance such as title underline, external icon emphasis, or slight color shift without changing layout size.

Click behavior:

- Clicking the title, URL, or external-link icon opens `node.data.url` in a new tab.
- The anchor uses `target="_blank"` and `rel="noopener noreferrer"`.
- Clicking other node padding or shell area selects or drags the node, rather than opening the link.
- Native link and image dragging remains disabled where it would compete with canvas drag.

No third-party favicon service is used. This avoids privacy leakage to a favicon provider and avoids relying on an external free API.

## Image Node Behavior

New image nodes default to `contain`.

The current Fit inspector remains available with `cover` and `contain`. Users can explicitly set `cover` when they want a cropped preview.

Existing image nodes with explicit `cover` remain unchanged.

## Child Node Placement

Creating a child node should place the child to the right and lower than its parent, rather than directly level with the parent.

Rule:

- `x = parent.position.x + parent.size.width + CHILD_GAP_X`
- `y = parent.position.y + CHILD_GAP_Y + childCount * SIBLING_GAP_Y`

`CHILD_GAP_Y` is a positive vertical offset. The existing sibling gap concept remains so multiple children are less likely to overlap. The exact constants should be chosen to fit the existing node sizes and canvas feel.

This intentionally remains deterministic engine behavior, not a layout algorithm. It does not scan the whole canvas for collisions in this phase.

## Save Shortcut

`MindEditor.vue` intercepts `Cmd+S` and `Ctrl+S` globally while the editor is mounted.

Behavior:

- Always call `event.preventDefault()` for `Cmd+S` / `Ctrl+S`.
- Emit the existing `save` event with the current document when a document exists.
- Intercept even when focus is inside Topic input, CodeMirror, inspector inputs, or other editor controls.
- Existing save guards still apply in `EditorView.vue`, such as no-op while already saving.

This intentionally differs from undo/redo/delete shortcuts, which still need input-target filtering so text editing behavior is not broken.

## Data Flow

Topic edit flow:

`TopicNodeContent -> commit { title } -> NodeRenderer -> MindEditor -> editor.updateNodeData`

Code edit flow:

`CodeNodeContent(CodeMirror blur) -> commit { code } -> NodeRenderer -> MindEditor -> editor.updateNodeData`

Code language flow:

`CodeNodeInspector -> contentChange { language } -> NodeInspector -> MindEditor -> editor.updateNodeData`

Code theme/wrap flow:

`CodeNodeInspector -> contentStyleChange -> NodeInspector -> MindEditor -> editor.setNodeContentStyle`

Save shortcut flow:

`window keydown -> MindEditor save() -> emit('save', editor.document) -> EditorView.saveDocument()`

## Error Handling

CodeMirror dependency or type issues should be caught by build/typecheck. Runtime editing failures should not throw visible errors during normal typing.

Invalid topic titles do not commit. The existing inline error behavior may stay local to the topic node.

Invalid code edits do not commit. Esc restores the stored value.

Unknown code languages fall back to `DEFAULT_CODE_LANGUAGE` for editor configuration. Migration should prevent valid loaded documents from containing missing language.

Favicon failures are best-effort and silent. A broken favicon image is replaced with the fallback link icon.

Invalid link URLs should fall back visually and avoid throwing during render. Existing schema validation should still prevent invalid saved link nodes.

Save shortcut interception should prevent browser save even if there is no document. In that case the save helper simply returns without emitting.

## Testing Strategy

Shared schema tests:

- `DEFAULT_IMAGE_CONTENT_STYLE.objectFit` is `contain`.
- Code data schema requires and accepts supported languages.
- `DEFAULT_CODE_LANGUAGE` is `typescript`.
- New default code data includes `{ code: '', language: 'typescript' }`.
- Historical code nodes missing language migrate to the default language.
- Defaulted/migrated image content style uses `contain` when a default is synthesized.

Engine tests:

- Adding a code child creates code data with default language.
- Adding an image child creates image content style with `contain`.
- Child node placement uses the right-lower rule and stacks siblings with the configured gaps.

Web component/source tests:

- `TopicNodeInspector.vue` no longer renders a `Title` field or imports title validation helpers.
- `TopicNodeContent.vue` uses click-to-edit, blur commit, Esc cancel, validation, and pointer isolation.
- `CodeNodeInspector.vue` no longer renders a code textarea or imports `CODE_NODE_CODE_MAX_LENGTH` / `isValidCode`.
- `CodeNodeInspector.vue` renders Language, Theme, and Wrap controls.
- `CodeNodeContent.vue` uses CodeMirror and emits content commits from the node content path.
- `NodeRenderer.vue` continues forwarding content commits for topic and code node content.
- `ImageNodeContent.vue` continues rendering with `node.contentStyle.objectFit`.
- `LinkNodeContent.vue` derives local favicon URL, supports fallback icon state, uses safe `_blank` anchors on clickable text/icon targets, and no longer prevents all link clicks.
- Node content components stay free of export-specific branching.

Keyboard tests:

- `Cmd+S` / `Ctrl+S` calls preventDefault and triggers the save path from normal canvas focus.
- `Cmd+S` / `Ctrl+S` also triggers save when the event target is an input-like editor control.
- Existing undo/redo/delete shortcut filtering for input targets remains intact.

Build verification:

- `npm run test -w apps/web`
- `npm run test -w packages/shared`
- `npm run test -w packages/mind-engine`
- `npm run typecheck`

## Non-Goals

- Do not move Link title/URL editing out of the inspector in this phase.
- Do not move Image URL/Alt editing out of the inspector in this phase.
- Do not build a full automatic graph layout or collision-avoidance engine.
- Do not use a third-party favicon service.
- Do not add export-specific conditionals to node content components.

## Acceptance Criteria

- Topic titles are edited directly on the node with click, blur commit, and Esc cancel.
- Topic inspector has no `Title` field.
- Code nodes are always editable with CodeMirror and syntax highlighting.
- Code inspector has no `Code` field and exposes Language, Theme, and Wrap.
- Code node data stores a language, with migration/default handling for existing documents.
- New image nodes default to `contain`.
- Link nodes show a local favicon or fallback icon, make only title/URL/icon targets open the link in a new tab, and preserve selection/drag on other node areas.
- New child nodes appear to the right and lower than their parent.
- `Cmd+S` / `Ctrl+S` saves through the editor save path and blocks browser save, including while focus is in inputs or CodeMirror.

## Self-Review

Placeholder scan: no placeholder requirements remain.

Internal consistency: node content owns Topic and Code editing, while inspectors own style and metadata. Data flow uses the existing `commit` and inspector event paths.

Scope check: this is one implementation plan covering shared schema defaults, engine placement/defaults, and focused web editor behavior. It does not expand into unrelated node types or a general layout engine.

Ambiguity check: favicon source, save shortcut scope, child placement rule, CodeMirror role, default language, and inspector ownership are all explicit.
