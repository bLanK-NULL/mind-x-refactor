# Web Feature Directory Structure Design

Date: 2026-04-29

Status: Approved for spec review

## Goal

Optimize the project directory structure by making the Web app's feature boundaries clearer while preserving current product behavior.

The current monorepo boundary is already sound:

- `apps/api` owns HTTP, auth, persistence, validation, and database access.
- `apps/web` owns the browser application.
- `packages/mind-engine` owns pure mind-map editing rules and session behavior.
- `packages/shared` owns shared contracts, schemas, constants, and DTOs.

The next useful improvement is inside `apps/web/src`, where editor-related files are currently spread across `views`, `components/editor`, `stores`, and `services`. This makes the editor feature harder to scan as it grows. The design moves the Web app toward feature-first organization with a small shared layer and app assembly layer.

## Chosen Approach

Use a focused Web feature directory migration.

Keep the existing monorepo layout and package public APIs unchanged. Reorganize `apps/web/src` into:

- `app`: application assembly, root component, routing, and entry point.
- `shared`: infrastructure and reusable UI or composables used by multiple features.
- `features`: user-facing feature areas, starting with `auth`, `projects`, and `editor`.

This is a pure structure migration. It should not change editor behavior, API behavior, store action semantics, component props, persisted document shape, engine exports, or shared schema exports.

## Alternatives Considered

### Lightweight Test-Only Cleanup

Move only test files into `__tests__` directories and leave production files in the current technical folders.

This has the lowest risk, but it does not solve the main source of navigation friction: the editor feature is split across several top-level technical directories.

### Full Repository Domain Restructure

Restructure Web, API, shared, and mind-engine around matching feature or domain names.

This may be attractive later, but it is too broad now. `packages/mind-engine` was recently split into clearer modules, and `apps/api` already has a readable module/service/repository structure. Reworking every package would create churn without enough immediate value.

### Recommended: Web Feature-First Structure

Move the Web app to feature-first folders, keep API and packages stable, and standardize nearby test placement where files are moved.

This gives the best current payoff because the editor is the fastest-growing Web feature and already has many related components, services, utilities, and tests.

## Target Web Structure

```text
apps/web/src/
  app/
    App.vue
    main.ts
    router/
      index.ts
      redirect.ts
      __tests__/
        redirect.test.ts
  shared/
    api/
      client.ts
      __tests__/
        client.test.ts
    components/
      ThemeToggle.vue
    composables/
      theme/
        useTheme.ts
        __tests__/
          useTheme.test.ts
    styles/
      global.css
  features/
    auth/
      views/
        LoginView.vue
      stores/
        auth.ts
      __tests__/
    projects/
      views/
        ProjectsView.vue
      stores/
        projects.ts
      services/
        crossTab.ts
      __tests__/
        projects.store.test.ts
        crossTab.test.ts
    editor/
      views/
        EditorView.vue
      stores/
        editor.ts
      services/
        exportPng.ts
        saveFailureDraft.ts
        syncService.ts
      components/
        MindEditor.vue
        canvas/
          EdgeRenderer.vue
          NodeRenderer.vue
          SelectionLayer.vue
          TopicNode.vue
          ViewportPane.vue
        context-menu/
          EditorContextMenu.vue
        inspectors/
          ColorTokenPicker.vue
          EdgeInspector.vue
          InspectorPanel.vue
          NodeInspector.vue
          StyleField.vue
        toolbar/
          EditorToolbar.vue
      utils/
        inspectorPosition.ts
        keyboardTargets.ts
        objectStyles.ts
        viewportGestureFilter.ts
      __tests__/
        edgeRenderer.test.ts
        editor.store.test.ts
        exportPng.test.ts
        inspectorPosition.test.ts
        keyboardTargets.test.ts
        objectStyles.test.ts
        saveFailureDraft.test.ts
        syncService.test.ts
        viewportGestureFilter.test.ts
```

## Boundary Rules

`app` is the composition layer. It can import from `features` and `shared`, but feature code should not import from `app` except through Vue Router runtime behavior if needed.

`shared` contains code that is genuinely reused across features or is global infrastructure:

- API client and token storage helpers.
- Theme composable and theme toggle component.
- Global styles.

`features/auth` owns login flow and authentication store.

`features/projects` owns project list UI, project store, and cross-tab project events.

`features/editor` owns the editor page, editor store adapter, browser-side sync, local draft fallback, PNG export, editor components, and editor-only utility helpers.

`packages/mind-engine` remains the owner of pure editor-domain behavior. Web feature files continue to call the engine through its public package exports. Do not move engine logic into Web.

`packages/shared` remains the owner of shared contracts, schemas, DTOs, and style constants. Do not duplicate shared document types or validation in Web features.

## Import Strategy

Use `@/features/...`, `@/shared/...`, and `@/app/...` for cross-boundary imports in Web code. Use relative imports inside a small local folder when the relationship is obvious and unlikely to move independently, such as a component importing a sibling component.

The existing Vite and TypeScript alias `@ -> src` can support this structure without config changes.

Avoid adding barrel files by default. Add a local `index.ts` only when it reduces repeated long imports for a cohesive folder without hiding unclear dependencies.

## Test Layout

Use nearby `__tests__` folders for moved Web files:

- Feature tests live under that feature's `__tests__`.
- App assembly tests live under the relevant app subfolder's `__tests__`.
- Shared infrastructure tests live under the relevant shared subfolder's `__tests__`.

Rename tests when useful so the tested subject is clear after moving:

- `stores/editor.test.ts` becomes `features/editor/__tests__/editor.store.test.ts`.
- `stores/projects.test.ts` becomes `features/projects/__tests__/projects.store.test.ts`.
- `components/editor/EdgeRenderer.test.ts` becomes `features/editor/__tests__/edgeRenderer.test.ts`.

Do not move `packages/mind-engine/src/__tests__`; that package was already organized in a previous directory split.

Do not force an API test migration in this change. `apps/api/src/modules/*` is already organized by module, and moving API tests can be handled later if the API test layout becomes a real pain point.

## Migration Plan Shape

The later implementation plan should use `git mv` wherever possible to preserve history.

Move files in small groups:

1. App assembly files: `App.vue`, `main.ts`, and router files.
2. Shared files: API client, theme composable, theme toggle, and global styles.
3. Auth feature files.
4. Projects feature files and tests.
5. Editor feature files and tests.
6. Import path cleanup and verification.

Each group should keep behavior unchanged and update imports immediately after moving.

## Non-Goals

- Do not change visible UI behavior.
- Do not change editor commands, selection behavior, history behavior, save behavior, draft behavior, PNG export behavior, or cross-tab behavior.
- Do not change API routes, request/response contracts, or database behavior.
- Do not change public exports from `@mind-x/mind-engine` or `@mind-x/shared`.
- Do not introduce a new state management pattern.
- Do not introduce a new test runner or build tool.
- Do not split large Vue components as part of this directory migration.

## Error Handling

No runtime error-handling behavior should change.

The main risk is broken import paths after file moves. Treat any resulting failures as migration defects and fix the paths or test setup without changing business logic.

## Testing

After implementation, run:

```bash
npm run typecheck
npm test
npm run build
```

If a failure appears, first check for import path mistakes, test filename assumptions, or moved-file relative paths. Fix only migration-related issues in this change.

## Acceptance Criteria

- `apps/web/src` uses the `app`, `shared`, and `features` structure.
- Editor-related Web files are grouped under `apps/web/src/features/editor`.
- Auth-related Web files are grouped under `apps/web/src/features/auth`.
- Project-list and cross-tab project files are grouped under `apps/web/src/features/projects`.
- Shared Web infrastructure is grouped under `apps/web/src/shared`.
- Router and root app assembly are grouped under `apps/web/src/app`.
- Moved Web tests live in nearby `__tests__` folders with clear names.
- `packages/mind-engine` and `packages/shared` public APIs are unchanged.
- `apps/api` directory structure is unchanged.
- Build, typecheck, and test commands pass after migration.
