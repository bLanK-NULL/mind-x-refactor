# Export Image Node Content Design

Date: 2026-04-30

Status: Approved for spec review

## Goal

Improve PNG export so it handles the current multi-type node canvas cleanly while preserving the real rendered output of each `*NodeContent` component.

The exported image should be a clean whole-map PNG suitable for sharing, but it must not introduce type-specific export renderers or export-only branches inside node content components.

## Non-Goals

- Do not add `exportMode` props to `TopicNodeContent`, `ImageNodeContent`, `LinkNodeContent`, `AttachmentNodeContent`, `CodeNodeContent`, or `TaskNodeContent`.
- Do not create a separate canvas, SVG, or server-side renderer for node contents.
- Do not add backend image proxying, image caching, uploads, or asset storage.
- Do not convert interactive node content into custom static markup just for export.
- Do not add selected-region or viewport-only export in this phase.
- Do not auto-submit or cancel edits before exporting.

## Chosen Approach

Keep the existing `html2canvas` based export pipeline and capture the same DOM that the editor uses for the canvas.

`NodeContent` stays WYSIWYG. Export only performs generic editor-shell cleanup around that content:

- Reset viewport transforms in the cloned DOM so whole-document bounds can be captured.
- Hide selection overlays and resize handles.
- Remove selected-node visual treatment from the cloned DOM.
- Preserve node shells, edges, code highlighting, task controls, links, attachments, and image nodes as they currently render.
- Preserve the canvas background and grid.

This keeps export behavior close to what users see while avoiding a second rendering model that would drift from the actual editor.

## Export Semantics

The export always captures the full mind map. Bounds come from all document nodes using `position + size`, with padding around the outermost nodes.

The current viewport pan and zoom do not affect the exported map area. The export still uses the current document data and current mounted DOM, so in-progress UI state inside node content remains visible if it is currently visible.

If a node is being edited, export does not call `blur()`, does not commit the edit, and does not mutate editor history. The current input or focused control may appear in the PNG because it is part of the current DOM.

The exported PNG includes:

- All rendered nodes.
- All rendered edges.
- Node shell styles.
- Type-specific content as currently rendered.
- Code highlighting and code theme styles.
- Canvas background and grid.

The exported PNG excludes:

- Toolbar, inspector, context menu, and other UI outside the export root.
- Selection layer.
- Resize handles.
- Selected-node border and selected-node shadow.
- Other generic editor-only affordances that are not node content.

## Architecture

Split the export service into focused utilities.

```text
apps/web/src/features/editor/services/
  exportBounds.ts
  exportClone.ts
  exportPng.ts
```

`exportBounds.ts` owns document bounds calculation. It should operate on v3 node `position` and `size` and keep padding decisions separate from download behavior.

`exportClone.ts` owns cloned-DOM preparation for `html2canvas`. It should expose a helper that receives the cloned export root and the calculated bounds, then applies export-only cleanup to the clone.

`exportPng.ts` remains the public entry point. It should compose bounds, clone preparation, `html2canvas` options, filename generation, and download triggering.

Component changes should stay generic. For example, `BaseNode.vue` may mark resize handles with `data-html2canvas-ignore="true"` or a project-specific export-ignore data attribute. `SelectionLayer.vue` already uses `data-html2canvas-ignore="true"` and should remain ignored.

Do not change node content components to understand export.

## html2canvas Configuration

Use the existing `html2canvas` integration with these option-level behaviors:

- Keep `scale: 2` for crisp output.
- Keep `x`, `y`, `width`, and `height` based on calculated whole-document bounds.
- Use `onclone` to prepare the cloned export root.
- Use `useCORS: true` so cross-origin images can render when the source server permits it.
- Set a bounded `imageTimeout` so export does not wait indefinitely on slow images.
- Do not use a backend `proxy` in this phase.

`backgroundColor` should no longer force a flat white export if that would erase the editor canvas feel. Prefer preserving the canvas background and grid on the cloned export root. If a fallback color is needed, use the computed canvas background color rather than a hard-coded white.

## Clone Preparation

Clone preparation is allowed to adjust only generic editor shell concerns.

Required cleanup:

- Clear the cloned export root transform.
- Add export sizing/background styles to the cloned root so the requested bounds include the canvas background and grid.
- Hide any element marked with `data-html2canvas-ignore="true"`.
- Hide or remove generic resize handles.
- Remove the selected-node class from cloned nodes so selected borders and shadows are not exported.

Clone preparation must not:

- Replace node content markup.
- Traverse node types to apply type-specific export rules.
- Trigger events on the live document.
- Commit or cancel in-progress edits.

## Image Behavior

Image nodes are best-effort. Export should attempt to include images through browser loading and `useCORS`.

If a remote image cannot be loaded or cannot be read safely by `html2canvas`, export should not introduce custom node-level replacement markup in this phase. The image node remains whatever the browser-rendered DOM can provide, such as a broken image indicator or alt behavior.

Only failures from the overall `html2canvas` or download pipeline should surface through the existing export error path.

## Data Flow

```text
EditorToolbar
  -> MindEditor.exportPng()
  -> ViewportPane.getExportRoot()
  -> EditorView.handleExportPng()
  -> exportDocumentAsPng({ document, root })
  -> calculateDocumentBounds(document)
  -> html2canvas(root, options with onclone)
  -> downloadCanvas(canvas, filename)
```

The document is read-only during this flow.

## Error Handling

Empty documents keep the current behavior and return `false`, allowing the UI to show "Nothing to export".

Unexpected `html2canvas`, canvas, blob, object URL, or download failures should continue through the existing rejected promise path so `EditorView` can display the existing API-style error message.

Image load issues should be bounded by `imageTimeout` and should not become a new user-facing validation step.

## Testing

Unit tests should cover:

- Bounds calculation with mixed node sizes and negative positions.
- Filename sanitization.
- Empty document returns `false` without rendering.
- `html2canvas` receives whole-map crop options and export-safe image options.
- `onclone` clears the export root transform.
- `onclone` removes selected-node visual classes from cloned nodes.
- Generic export-ignore markers hide selection and resize affordances.
- Export does not call `blur()` or otherwise interact with `document.activeElement`.

Component/source tests may assert that shell-level controls are marked for export ignore. Avoid snapshot tests that lock every `*NodeContent` implementation to export behavior, because node content should remain owned by normal canvas rendering.

## Acceptance Criteria

- Exported PNG contains the whole mind map, not only the current viewport.
- Exported PNG preserves the canvas background and grid.
- Exported PNG preserves current node content rendering for topic, image, link, attachment, code, and task nodes.
- Exported PNG excludes selection layer, resize handles, and selected-node visual state.
- Exporting while topic or task content is being edited does not submit, cancel, blur, or mutate editor history.
- No `*NodeContent` component contains export-specific conditional rendering.
- External image failures do not add backend proxying or node-type-specific replacement logic.
- Relevant web tests pass.
