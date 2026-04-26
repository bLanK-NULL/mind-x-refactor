# Theme Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add light/dark theme switching to the Vue web app, backed by `html[theme]`, CSS variables, Ant Design Vue theming, local persistence, and editor document `meta.theme`.

**Architecture:** A small theme composable owns the active `ThemeName`, applies it to the `html` element, persists it to `localStorage`, and exposes the Ant Design Vue `ConfigProvider` theme config. A reusable `ThemeToggle` controls the composable. The editor store gets a focused action for writing the selected theme into `MindDocument.meta.theme` so editor theme changes save with the document.

**Tech Stack:** Vue 3, Pinia, TypeScript, Vitest, Ant Design Vue 4 `ConfigProvider`, CSS custom properties.

---

## File Structure

- Create `apps/web/src/composables/useTheme.ts`: theme controller, browser initialization, Ant Design theme config, and singleton `useTheme`.
- Create `apps/web/src/composables/useTheme.test.ts`: unit tests for storage, invalid values, html attribute application, and toggling.
- Create `apps/web/src/components/ThemeToggle.vue`: compact icon button for switching themes.
- Modify `apps/web/src/main.ts`: initialize theme before mounting Vue.
- Modify `apps/web/src/App.vue`: wrap the router in `a-config-provider`.
- Modify `apps/web/src/stores/editor.ts`: add `setDocumentTheme(themeName: ThemeName)`.
- Modify `apps/web/src/stores/editor.test.ts`: test theme mutation and dirty tracking.
- Modify `apps/web/src/views/ProjectsView.vue`: add the toggle to the header.
- Modify `apps/web/src/views/EditorView.vue`: add the toggle and synchronize loaded/toggled document theme.
- Modify CSS in `apps/web/src/styles/global.css`, `LoginView.vue`, `ProjectsView.vue`, and editor components to use theme variables.

## Task 1: Theme Controller

**Files:**
- Create: `apps/web/src/composables/useTheme.test.ts`
- Create: `apps/web/src/composables/useTheme.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/src/composables/useTheme.test.ts` with tests for stored dark theme initialization, invalid storage fallback, toggle persistence, and guarded storage failures.

- [ ] **Step 2: Verify the tests fail**

Run:

```bash
npm run test -w apps/web -- src/composables/useTheme.test.ts
```

Expected: fail because `./useTheme` does not exist.

- [ ] **Step 3: Implement the theme controller**

Create `apps/web/src/composables/useTheme.ts` with:

```ts
import type { ThemeName } from '@mind-x/shared'
import type { ThemeConfig } from 'ant-design-vue/es/config-provider/context'
import { theme as antTheme } from 'ant-design-vue'
import { computed, readonly, ref } from 'vue'

const THEME_STORAGE_KEY = 'mind-x-theme'

type ThemeRoot = Pick<HTMLElement, 'setAttribute'>
type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>

export type ThemeControllerOptions = {
  root?: ThemeRoot | null
  storage?: ThemeStorage | null
}

export function isThemeName(value: unknown): value is ThemeName {
  return value === 'light' || value === 'dark'
}
```

The controller must expose `currentTheme`, `antDesignTheme`, `initializeTheme`, `setTheme`, and `toggleTheme`.

- [ ] **Step 4: Verify the tests pass**

Run:

```bash
npm run test -w apps/web -- src/composables/useTheme.test.ts
```

Expected: all tests in `useTheme.test.ts` pass.

## Task 2: Editor Document Theme State

**Files:**
- Modify: `apps/web/src/stores/editor.ts`
- Modify: `apps/web/src/stores/editor.test.ts`

- [ ] **Step 1: Write failing editor-store tests**

Add tests that load a document, call `setDocumentTheme('dark')`, and assert that `document.meta.theme` changes, the store becomes dirty, and undo/redo can cross the theme change.

- [ ] **Step 2: Verify the tests fail**

Run:

```bash
npm run test -w apps/web -- src/stores/editor.test.ts
```

Expected: fail because `setDocumentTheme` does not exist.

- [ ] **Step 3: Implement the editor-store action**

Import `ThemeName` from `@mind-x/shared`, clone the current document, update `next.meta.theme`, validate with `mindDocumentSchema.parse(next)`, and commit the updated document.

- [ ] **Step 4: Verify the tests pass**

Run:

```bash
npm run test -w apps/web -- src/stores/editor.test.ts
```

Expected: all editor store tests pass.

## Task 3: App Integration and Toggle UI

**Files:**
- Create: `apps/web/src/components/ThemeToggle.vue`
- Modify: `apps/web/src/main.ts`
- Modify: `apps/web/src/App.vue`
- Modify: `apps/web/src/views/ProjectsView.vue`
- Modify: `apps/web/src/views/EditorView.vue`

- [ ] **Step 1: Add the toggle component**

Create a compact `ThemeToggle.vue` using `MoonOutlined` and `SunOutlined`. It calls `toggleTheme()` and emits `change` with the new `ThemeName`.

- [ ] **Step 2: Initialize and provide theme**

Call `initializeTheme()` in `main.ts`, then wrap `RouterView` in `App.vue` with:

```vue
<a-config-provider :theme="antDesignTheme">
  <RouterView />
</a-config-provider>
```

- [ ] **Step 3: Add page controls**

Add `<ThemeToggle />` to `ProjectsView.vue` header actions. Add `<ThemeToggle @change="handleThemeChange" />` to `EditorView.vue`, and implement `handleThemeChange(themeName)` with `editor.setDocumentTheme(themeName)`.

- [ ] **Step 4: Sync loaded editor documents**

When `EditorView` chooses the active server or draft document, call `setTheme(activeDocument.meta.theme)` before mounting `MindEditor`.

- [ ] **Step 5: Typecheck the integration**

Run:

```bash
npm run typecheck -w apps/web
```

Expected: typecheck exits with code 0.

## Task 4: Theme Variables and Styles

**Files:**
- Modify: `apps/web/src/styles/global.css`
- Modify: `apps/web/src/views/LoginView.vue`
- Modify: `apps/web/src/views/ProjectsView.vue`
- Modify: `apps/web/src/components/editor/MindEditor.vue`
- Modify: `apps/web/src/components/editor/ViewportPane.vue`
- Modify: `apps/web/src/components/editor/TopicNode.vue`
- Modify: `apps/web/src/components/editor/EdgeRenderer.vue`
- Modify: `apps/web/src/components/editor/SelectionLayer.vue`
- Modify: `apps/web/src/components/editor/EditorToolbar.vue`
- Modify: `apps/web/src/components/editor/EditorContextMenu.vue`

- [ ] **Step 1: Define CSS variables**

Add light variables to `:root` and dark variables to `:root[theme="dark"]` for app background, panels, elevated surfaces, borders, text, muted text, grid lines, editor canvas, nodes, edges, selection, danger text, and shadows.

- [ ] **Step 2: Replace hard-coded app colors**

Replace existing hex/rgb colors in the listed files with `var(--...)` tokens. Keep dimensions, layout, and interaction behavior unchanged.

- [ ] **Step 3: Scan for remaining UI hard-coded colors**

Run:

```bash
rg -n "#[0-9a-fA-F]{3,8}|rgb\\(|rgba\\(" apps/web/src --glob '!services/exportPng*'
```

Expected: no remaining themeable UI colors except intentional export PNG colors.

## Task 5: Final Verification

**Files:**
- `apps/web/src/composables/useTheme.ts`
- `apps/web/src/composables/useTheme.test.ts`
- `apps/web/src/components/ThemeToggle.vue`
- `apps/web/src/main.ts`
- `apps/web/src/App.vue`
- `apps/web/src/stores/editor.ts`
- `apps/web/src/stores/editor.test.ts`
- `apps/web/src/views/ProjectsView.vue`
- `apps/web/src/views/EditorView.vue`
- `apps/web/src/styles/global.css`
- `apps/web/src/views/LoginView.vue`
- `apps/web/src/components/editor/MindEditor.vue`
- `apps/web/src/components/editor/ViewportPane.vue`
- `apps/web/src/components/editor/TopicNode.vue`
- `apps/web/src/components/editor/EdgeRenderer.vue`
- `apps/web/src/components/editor/SelectionLayer.vue`
- `apps/web/src/components/editor/EditorToolbar.vue`
- `apps/web/src/components/editor/EditorContextMenu.vue`

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm run test -w apps/web -- src/composables/useTheme.test.ts src/stores/editor.test.ts
```

Expected: focused tests pass.

- [ ] **Step 2: Run web tests**

Run:

```bash
npm run test -w apps/web
```

Expected: all web tests pass.

- [ ] **Step 3: Run typecheck and build**

Run:

```bash
npm run typecheck -w apps/web
npm run build -w apps/web
```

Expected: both commands exit with code 0.
