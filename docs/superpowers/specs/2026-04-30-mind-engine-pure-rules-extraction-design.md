# Mind Engine Pure Rules Extraction Design

Date: 2026-04-30

Status: Approved for spec review

## Goal

Move reusable, side-effect-free editor logic from `apps/web` into `packages/mind-engine` so the engine owns more of the core mind-map rules while the web app stays focused on Vue, DOM, browser APIs, network sync, local storage, and PNG export orchestration.

This is a conservative extraction. Only pure functions that operate on `MindDocument`, node content input, or save-state decisions move into `mind-engine`. Browser-dependent helpers and presentation mappings stay in the web app.

## Chosen Approach

Use a pure rules extraction with direct package exports.

Add focused modules under `packages/mind-engine/src/` and export them from `packages/mind-engine/src/index.ts`. Update web imports to consume these helpers from `@mind-x/mind-engine`, then remove the duplicate web modules.

This keeps the package boundary simple: engine rules are imported directly where needed, and web-only code does not keep compatibility shims for modules that have only a few call sites.

## Scope

Move these helpers into `packages/mind-engine`:

- `calculateDocumentBounds`, `DocumentBounds`, and `EXPORT_PADDING` from `apps/web/src/features/editor/services/exportBounds.ts`.
- `isValidPlainText`, `isValidOptionalPlainText`, `isValidCode`, and `isValidWebUrl` from `apps/web/src/features/editor/utils/nodeValidation.ts`.
- `selectFailedSaveDraftDocument` from `apps/web/src/features/editor/services/saveFailureDraft.ts`.

Do not move:

- `objectStyles.ts`, because it maps document style tokens to CSS classes, CSS variables, and renderer-specific color values.
- `codeThemes.ts`, because it maps code block themes to CSS custom properties and inspector swatches.
- `codeHighlight.ts`, because it depends on `highlight.js` and is rendering behavior.
- `keyboardTargets.ts`, `viewportGestureFilter.ts`, and `inspectorPosition.ts`, because they depend on DOM objects, selectors, browser globals, or session storage.
- `exportPng.ts`, `exportClone.ts`, and `syncService.ts`, because they coordinate browser rendering, network calls, local drafts, or other side effects.
- `NODE_TYPE_OPTIONS` as currently shaped, because its labels are UI control copy. A future engine-owned node-type order can be introduced separately if more consumers need it.

## Architecture Boundary

`packages/shared` continues to own schemas, constants, DTOs, migration, and shared document types.

`packages/mind-engine` owns pure editor and document rules:

- Command execution.
- Graph validation and traversal.
- Session state, history, selection, and viewport math.
- Document bounds calculation from node positions and sizes.
- Node input validation helpers that mirror strict document constraints.
- Save failure document selection logic.

`apps/web` owns:

- Vue components and Pinia adapters.
- DOM event filtering and keyboard target checks.
- Inspector browser storage.
- CSS class and CSS variable resolution.
- Syntax highlighting.
- PNG rendering, clone preparation, and download side effects.
- API sync, local draft persistence, and route-level orchestration.

## Engine File Structure

Create these modules:

```text
packages/mind-engine/src/documentBounds.ts
packages/mind-engine/src/nodeValidation.ts
packages/mind-engine/src/saveFailureDraft.ts
```

Update `packages/mind-engine/src/index.ts`:

```ts
export * from './documentBounds.js'
export * from './nodeValidation.js'
export * from './saveFailureDraft.js'
```

`documentBounds.ts` keeps the existing function and type names. Although the first consumer is PNG export, the function itself is a pure document geometry rule based on node positions and sizes.

`nodeValidation.ts` keeps using `PLAIN_TEXT_MAX_LENGTH` and `CODE_NODE_CODE_MAX_LENGTH` from `@mind-x/shared`. `isValidWebUrl` continues using the standard `URL` constructor and remains usable in Node tests.

`saveFailureDraft.ts` keeps the existing `selectFailedSaveDraftDocument` name because it accurately describes the editor save failure decision.

## Web Changes

Remove these web modules after their call sites are updated:

```text
apps/web/src/features/editor/services/exportBounds.ts
apps/web/src/features/editor/services/saveFailureDraft.ts
apps/web/src/features/editor/utils/nodeValidation.ts
```

Update web imports to use `@mind-x/mind-engine`.

`exportPng.ts` should import `calculateDocumentBounds` from the engine but continue to own html2canvas setup, clone preparation, filename creation, blob creation, link clicking, and object URL cleanup.

Inspector and node content components should import validation helpers from the engine but continue to own user interaction, local component state, and emitted changes.

`EditorView.vue` or save-failure orchestration code should import `selectFailedSaveDraftDocument` from the engine while retaining async save handling and local draft persistence in web.

## Data Flow

Node edit validation:

```text
Vue input event
  -> web component local edit state
  -> engine validation helper
  -> if valid, emit/store update
  -> EditorSession command updates MindDocument
```

PNG export bounds:

```text
web export command
  -> engine calculateDocumentBounds(MindDocument)
  -> web html2canvas options
  -> web clone preparation
  -> web PNG download side effects
```

Failed save draft selection:

```text
web save failure
  -> engine selectFailedSaveDraftDocument(...)
  -> web saveLocalDraft(...)
```

## Error Handling

Moved helpers remain total and predictable:

- Bounds calculation returns `null` for empty documents.
- Validation helpers return booleans rather than throwing.
- Save failure draft selection returns either the captured save snapshot or the current document based on the supplied flags.

Browser, network, storage, and export errors remain handled by web services and views.

## Testing

Move or add engine tests:

- `packages/mind-engine/src/__tests__/nodeValidation.test.ts` covers plain text, optional text, code length, and URL validation.
- `packages/mind-engine/src/__tests__/documentBounds.test.ts` covers empty documents, explicit node sizes, padding, and negative node positions.
- `packages/mind-engine/src/__tests__/saveFailureDraft.test.ts` covers navigation changes, stale save sessions, and newer live edits.

Adjust web tests:

- Remove the bounds unit assertion from `apps/web/src/features/editor/__tests__/exportPng.test.ts` after equivalent engine coverage exists.
- Keep `exportPng.test.ts` focused on export orchestration: returning false for empty bounds, passing calculated bounds to html2canvas and clone preparation, filename creation, and download cleanup.
- Update component and service tests to import moved helpers from `@mind-x/mind-engine` where they need direct assertions.

Verification commands:

```bash
npm run test:engine
npm run test -w apps/web
npm run typecheck
```

## Acceptance Criteria

- The three selected pure logic areas are exported by `@mind-x/mind-engine`.
- The duplicate web modules for bounds, node validation, and save failure draft selection are removed.
- No DOM, Vue, browser storage, network, html2canvas, highlight.js, or CSS mapping code is moved into `mind-engine`.
- Engine tests cover the extracted pure rules.
- Web tests still cover browser orchestration around the extracted rules.
- `npm run test:engine`, `npm run test -w apps/web`, and `npm run typecheck` pass.
