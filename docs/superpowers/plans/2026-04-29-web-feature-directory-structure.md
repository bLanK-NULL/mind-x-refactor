# Web Feature Directory Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize `apps/web/src` into `app`, `shared`, and `features` directories without changing runtime behavior.

**Architecture:** Keep the monorepo package boundaries stable and only move Web application files. Move shared Web infrastructure first so existing features can import it, then move `auth` and `projects`, then move the editor feature and its tests. Each task updates imports immediately and verifies the repo still builds at that stage.

**Tech Stack:** Vue 3, Vite, TypeScript, Pinia, Vitest, npm workspaces.

---

## Scope Check

This plan implements the approved spec in `docs/superpowers/specs/2026-04-29-web-feature-directory-structure-design.md`.

The work is one focused directory migration inside `apps/web/src`. It does not change behavior, component props, store actions, service signatures, API contracts, package exports, or backend structure.

## Target File Structure

After the plan is complete, the Web source tree should be organized like this:

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
      stores/
        auth.ts
      views/
        LoginView.vue
    projects/
      services/
        crossTab.ts
      stores/
        projects.ts
      views/
        ProjectsView.vue
      __tests__/
        crossTab.test.ts
        projects.store.test.ts
    editor/
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
      services/
        exportPng.ts
        saveFailureDraft.ts
        syncService.ts
      stores/
        editor.ts
      utils/
        inspectorPosition.ts
        keyboardTargets.ts
        objectStyles.ts
        viewportGestureFilter.ts
      views/
        EditorView.vue
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

## Task 1: Move App Assembly and Shared Web Infrastructure

**Files:**
- Move: `apps/web/src/App.vue` to `apps/web/src/app/App.vue`
- Move: `apps/web/src/main.ts` to `apps/web/src/app/main.ts`
- Move: `apps/web/src/router/index.ts` to `apps/web/src/app/router/index.ts`
- Move: `apps/web/src/router/redirect.ts` to `apps/web/src/app/router/redirect.ts`
- Move: `apps/web/src/router/redirect.test.ts` to `apps/web/src/app/router/__tests__/redirect.test.ts`
- Move: `apps/web/src/api/client.ts` to `apps/web/src/shared/api/client.ts`
- Move: `apps/web/src/api/client.test.ts` to `apps/web/src/shared/api/__tests__/client.test.ts`
- Move: `apps/web/src/composables/useTheme.ts` to `apps/web/src/shared/composables/theme/useTheme.ts`
- Move: `apps/web/src/composables/useTheme.test.ts` to `apps/web/src/shared/composables/theme/__tests__/useTheme.test.ts`
- Move: `apps/web/src/components/ThemeToggle.vue` to `apps/web/src/shared/components/ThemeToggle.vue`
- Move: `apps/web/src/styles/global.css` to `apps/web/src/shared/styles/global.css`
- Modify: `apps/web/index.html`
- Modify imports in moved and still-unmoved Web files that consume shared infrastructure.

- [ ] **Step 1: Run a baseline Web typecheck**

Run:

```bash
npm run typecheck -w apps/web
```

Expected: command exits with code 0 before files are moved.

- [ ] **Step 2: Create destination directories**

Run:

```bash
mkdir -p apps/web/src/app/router/__tests__
mkdir -p apps/web/src/shared/api/__tests__
mkdir -p apps/web/src/shared/components
mkdir -p apps/web/src/shared/composables/theme/__tests__
mkdir -p apps/web/src/shared/styles
```

Expected: the five destination directory groups exist.

- [ ] **Step 3: Move app assembly and shared files with git history**

Run:

```bash
git mv apps/web/src/App.vue apps/web/src/app/App.vue
git mv apps/web/src/main.ts apps/web/src/app/main.ts
git mv apps/web/src/router/index.ts apps/web/src/app/router/index.ts
git mv apps/web/src/router/redirect.ts apps/web/src/app/router/redirect.ts
git mv apps/web/src/router/redirect.test.ts apps/web/src/app/router/__tests__/redirect.test.ts
git mv apps/web/src/api/client.ts apps/web/src/shared/api/client.ts
git mv apps/web/src/api/client.test.ts apps/web/src/shared/api/__tests__/client.test.ts
git mv apps/web/src/composables/useTheme.ts apps/web/src/shared/composables/theme/useTheme.ts
git mv apps/web/src/composables/useTheme.test.ts apps/web/src/shared/composables/theme/__tests__/useTheme.test.ts
git mv apps/web/src/components/ThemeToggle.vue apps/web/src/shared/components/ThemeToggle.vue
git mv apps/web/src/styles/global.css apps/web/src/shared/styles/global.css
```

Expected: the moved files are listed as renames by `git status --short`.

- [ ] **Step 4: Update the Vite entry script path**

Run:

```bash
perl -0pi -e "s|/src/main.ts|/src/app/main.ts|" apps/web/index.html
```

Expected `apps/web/index.html` contains:

```html
<script type="module" src="/src/app/main.ts"></script>
```

- [ ] **Step 5: Update imports in app and shared files**

Run:

```bash
perl -0pi -e "s|from './api/client'|from '@/shared/api/client'|; s|from './composables/useTheme'|from '@/shared/composables/theme/useTheme'|; s|from './stores/auth'|from '@/stores/auth'|; s|import './styles/global.css'|import '@/shared/styles/global.css'|" apps/web/src/app/main.ts
perl -0pi -e "s|from './composables/useTheme'|from '@/shared/composables/theme/useTheme'|" apps/web/src/app/App.vue
perl -0pi -e "s|from './client'|from '../client'|" apps/web/src/shared/api/__tests__/client.test.ts
perl -0pi -e "s|from './useTheme'|from '../useTheme'|" apps/web/src/shared/composables/theme/__tests__/useTheme.test.ts
perl -0pi -e "s|from './redirect'|from '../redirect'|" apps/web/src/app/router/__tests__/redirect.test.ts
perl -0pi -e "s|@/composables/useTheme|@/shared/composables/theme/useTheme|" apps/web/src/shared/components/ThemeToggle.vue
```

Expected key imports:

```ts
// apps/web/src/app/main.ts
import { setUnauthorizedHandler } from '@/shared/api/client'
import { initializeTheme } from '@/shared/composables/theme/useTheme'
import { useAuthStore } from '@/stores/auth'
import '@/shared/styles/global.css'

// apps/web/src/app/App.vue
import { useTheme } from '@/shared/composables/theme/useTheme'
```

- [ ] **Step 6: Update shared infrastructure imports in existing feature files**

Run:

```bash
perl -0pi -e "s|@/api/client|@/shared/api/client|g" apps/web/src/stores/auth.ts apps/web/src/stores/projects.ts apps/web/src/stores/projects.test.ts apps/web/src/services/syncService.ts apps/web/src/services/syncService.test.ts apps/web/src/views/EditorView.vue
perl -0pi -e "s|@/components/ThemeToggle.vue|@/shared/components/ThemeToggle.vue|g" apps/web/src/views/EditorView.vue apps/web/src/views/ProjectsView.vue
```

Expected no old shared imports remain:

```bash
rg -n "@/api|@/components/ThemeToggle.vue|@/composables/useTheme|from './api|from './composables|from './styles" apps/web/src apps/web/index.html
```

Expected: no output.

- [ ] **Step 7: Run focused verification**

Run:

```bash
npm run typecheck -w apps/web
npm run test -w apps/web
```

Expected: both commands exit with code 0.

- [ ] **Step 8: Commit the app and shared move**

Run:

```bash
git add apps/web/index.html apps/web/src
git commit -m "refactor(web): move app and shared structure"
```

Expected: one commit containing only app/shared moves and the import updates needed for those moves.

## Task 2: Move Auth and Projects Features

**Files:**
- Move: `apps/web/src/views/LoginView.vue` to `apps/web/src/features/auth/views/LoginView.vue`
- Move: `apps/web/src/stores/auth.ts` to `apps/web/src/features/auth/stores/auth.ts`
- Move: `apps/web/src/views/ProjectsView.vue` to `apps/web/src/features/projects/views/ProjectsView.vue`
- Move: `apps/web/src/stores/projects.ts` to `apps/web/src/features/projects/stores/projects.ts`
- Move: `apps/web/src/stores/projects.test.ts` to `apps/web/src/features/projects/__tests__/projects.store.test.ts`
- Move: `apps/web/src/services/crossTab.ts` to `apps/web/src/features/projects/services/crossTab.ts`
- Move: `apps/web/src/services/crossTab.test.ts` to `apps/web/src/features/projects/__tests__/crossTab.test.ts`
- Modify: `apps/web/src/app/main.ts`
- Modify: `apps/web/src/app/router/index.ts`
- Modify: `apps/web/src/views/EditorView.vue`

- [ ] **Step 1: Create feature directories**

Run:

```bash
mkdir -p apps/web/src/features/auth/stores
mkdir -p apps/web/src/features/auth/views
mkdir -p apps/web/src/features/projects/services
mkdir -p apps/web/src/features/projects/stores
mkdir -p apps/web/src/features/projects/views
mkdir -p apps/web/src/features/projects/__tests__
```

Expected: auth and projects destination folders exist.

- [ ] **Step 2: Move auth and projects files with git history**

Run:

```bash
git mv apps/web/src/views/LoginView.vue apps/web/src/features/auth/views/LoginView.vue
git mv apps/web/src/stores/auth.ts apps/web/src/features/auth/stores/auth.ts
git mv apps/web/src/views/ProjectsView.vue apps/web/src/features/projects/views/ProjectsView.vue
git mv apps/web/src/stores/projects.ts apps/web/src/features/projects/stores/projects.ts
git mv apps/web/src/stores/projects.test.ts apps/web/src/features/projects/__tests__/projects.store.test.ts
git mv apps/web/src/services/crossTab.ts apps/web/src/features/projects/services/crossTab.ts
git mv apps/web/src/services/crossTab.test.ts apps/web/src/features/projects/__tests__/crossTab.test.ts
```

Expected: the moved files are listed as renames by `git status --short`.

- [ ] **Step 3: Update auth and projects imports**

Run:

```bash
perl -0pi -e "s|@/stores/auth|@/features/auth/stores/auth|g; s|@/views/LoginView.vue|@/features/auth/views/LoginView.vue|g; s|@/views/ProjectsView.vue|@/features/projects/views/ProjectsView.vue|g" apps/web/src/app/main.ts apps/web/src/app/router/index.ts apps/web/src/features/auth/views/LoginView.vue apps/web/src/features/projects/views/ProjectsView.vue
perl -0pi -e "s|@/router/redirect|@/app/router/redirect|g" apps/web/src/features/auth/views/LoginView.vue
perl -0pi -e "s|@/stores/projects|@/features/projects/stores/projects|g; s|@/services/crossTab|@/features/projects/services/crossTab|g" apps/web/src/features/projects/views/ProjectsView.vue apps/web/src/views/EditorView.vue
perl -0pi -e "s|@/stores/auth|@/features/auth/stores/auth|g" apps/web/src/views/EditorView.vue
perl -0pi -e "s|from './projects'|from '@/features/projects/stores/projects'|g" apps/web/src/features/projects/__tests__/projects.store.test.ts
perl -0pi -e "s|from './crossTab'|from '../services/crossTab'|g" apps/web/src/features/projects/__tests__/crossTab.test.ts
```

Expected key imports:

```ts
// apps/web/src/app/router/index.ts
import { useAuthStore } from '@/features/auth/stores/auth'
import LoginView from '@/features/auth/views/LoginView.vue'
import ProjectsView from '@/features/projects/views/ProjectsView.vue'

// apps/web/src/features/projects/views/ProjectsView.vue
import { publishCrossTabEvent, subscribeCrossTabEvents, type CrossTabEvent } from '@/features/projects/services/crossTab'
import { useAuthStore } from '@/features/auth/stores/auth'
import { useProjectsStore } from '@/features/projects/stores/projects'

// apps/web/src/views/EditorView.vue
import { subscribeCrossTabEvents, type CrossTabEvent } from '@/features/projects/services/crossTab'
import { useAuthStore } from '@/features/auth/stores/auth'
```

- [ ] **Step 4: Confirm old auth/projects imports are gone**

Run:

```bash
rg -n "@/stores/auth|@/stores/projects|@/views/LoginView.vue|@/views/ProjectsView.vue|@/services/crossTab|@/router/redirect|from './projects'|from './crossTab'" apps/web/src
```

Expected: no output.

- [ ] **Step 5: Run focused verification**

Run:

```bash
npm run typecheck -w apps/web
npm run test -w apps/web
```

Expected: both commands exit with code 0.

- [ ] **Step 6: Commit the auth and projects move**

Run:

```bash
git add apps/web/src
git commit -m "refactor(web): move auth and projects features"
```

Expected: one commit containing auth/projects moves and their import updates.

## Task 3: Move Editor Feature Production Files

**Files:**
- Move: `apps/web/src/views/EditorView.vue` to `apps/web/src/features/editor/views/EditorView.vue`
- Move: `apps/web/src/stores/editor.ts` to `apps/web/src/features/editor/stores/editor.ts`
- Move: `apps/web/src/services/exportPng.ts` to `apps/web/src/features/editor/services/exportPng.ts`
- Move: `apps/web/src/services/saveFailureDraft.ts` to `apps/web/src/features/editor/services/saveFailureDraft.ts`
- Move: `apps/web/src/services/syncService.ts` to `apps/web/src/features/editor/services/syncService.ts`
- Move editor Vue components into `apps/web/src/features/editor/components`
- Move editor utility files into `apps/web/src/features/editor/utils`
- Modify imports in moved editor files and app router.

- [ ] **Step 1: Create editor destination directories**

Run:

```bash
mkdir -p apps/web/src/features/editor/components/canvas
mkdir -p apps/web/src/features/editor/components/context-menu
mkdir -p apps/web/src/features/editor/components/inspectors
mkdir -p apps/web/src/features/editor/components/toolbar
mkdir -p apps/web/src/features/editor/services
mkdir -p apps/web/src/features/editor/stores
mkdir -p apps/web/src/features/editor/utils
mkdir -p apps/web/src/features/editor/views
```

Expected: editor destination folders exist.

- [ ] **Step 2: Move editor page, store, and services**

Run:

```bash
git mv apps/web/src/views/EditorView.vue apps/web/src/features/editor/views/EditorView.vue
git mv apps/web/src/stores/editor.ts apps/web/src/features/editor/stores/editor.ts
git mv apps/web/src/services/exportPng.ts apps/web/src/features/editor/services/exportPng.ts
git mv apps/web/src/services/saveFailureDraft.ts apps/web/src/features/editor/services/saveFailureDraft.ts
git mv apps/web/src/services/syncService.ts apps/web/src/features/editor/services/syncService.ts
```

Expected: editor page, store, and service files are listed as renames.

- [ ] **Step 3: Move editor root, canvas, context menu, inspector, and toolbar components**

Run:

```bash
git mv apps/web/src/components/editor/MindEditor.vue apps/web/src/features/editor/components/MindEditor.vue
git mv apps/web/src/components/editor/EdgeRenderer.vue apps/web/src/features/editor/components/canvas/EdgeRenderer.vue
git mv apps/web/src/components/editor/NodeRenderer.vue apps/web/src/features/editor/components/canvas/NodeRenderer.vue
git mv apps/web/src/components/editor/SelectionLayer.vue apps/web/src/features/editor/components/canvas/SelectionLayer.vue
git mv apps/web/src/components/editor/TopicNode.vue apps/web/src/features/editor/components/canvas/TopicNode.vue
git mv apps/web/src/components/editor/ViewportPane.vue apps/web/src/features/editor/components/canvas/ViewportPane.vue
git mv apps/web/src/components/editor/EditorContextMenu.vue apps/web/src/features/editor/components/context-menu/EditorContextMenu.vue
git mv apps/web/src/components/editor/ColorTokenPicker.vue apps/web/src/features/editor/components/inspectors/ColorTokenPicker.vue
git mv apps/web/src/components/editor/EdgeInspector.vue apps/web/src/features/editor/components/inspectors/EdgeInspector.vue
git mv apps/web/src/components/editor/InspectorPanel.vue apps/web/src/features/editor/components/inspectors/InspectorPanel.vue
git mv apps/web/src/components/editor/NodeInspector.vue apps/web/src/features/editor/components/inspectors/NodeInspector.vue
git mv apps/web/src/components/editor/StyleField.vue apps/web/src/features/editor/components/inspectors/StyleField.vue
git mv apps/web/src/components/editor/EditorToolbar.vue apps/web/src/features/editor/components/toolbar/EditorToolbar.vue
```

Expected: editor component files are listed as renames.

- [ ] **Step 4: Move editor utility files**

Run:

```bash
git mv apps/web/src/components/editor/inspectorPosition.ts apps/web/src/features/editor/utils/inspectorPosition.ts
git mv apps/web/src/components/editor/keyboardTargets.ts apps/web/src/features/editor/utils/keyboardTargets.ts
git mv apps/web/src/components/editor/objectStyles.ts apps/web/src/features/editor/utils/objectStyles.ts
git mv apps/web/src/components/editor/viewportGestureFilter.ts apps/web/src/features/editor/utils/viewportGestureFilter.ts
```

Expected: editor utility files are listed as renames.

- [ ] **Step 5: Update imports for the moved editor page and app router**

Run:

```bash
perl -0pi -e "s|@/views/EditorView.vue|@/features/editor/views/EditorView.vue|g" apps/web/src/app/router/index.ts
perl -0pi -e "s|@/components/editor/MindEditor.vue|@/features/editor/components/MindEditor.vue|g; s|@/services/exportPng|@/features/editor/services/exportPng|g; s|@/services/saveFailureDraft|@/features/editor/services/saveFailureDraft|g; s|@/services/syncService|@/features/editor/services/syncService|g; s|@/stores/editor|@/features/editor/stores/editor|g" apps/web/src/features/editor/views/EditorView.vue
```

Expected key imports:

```ts
// apps/web/src/app/router/index.ts
import EditorView from '@/features/editor/views/EditorView.vue'

// apps/web/src/features/editor/views/EditorView.vue
import MindEditor from '@/features/editor/components/MindEditor.vue'
import { exportDocumentAsPng } from '@/features/editor/services/exportPng'
import { selectFailedSaveDraftDocument } from '@/features/editor/services/saveFailureDraft'
import { getLocalDraft, loadServerDocument, saveLocalDraft, saveServerDocument } from '@/features/editor/services/syncService'
import { serializeMindDocument, useEditorStore } from '@/features/editor/stores/editor'
```

- [ ] **Step 6: Update imports in editor production files**

Run:

```bash
perl -0pi -e "s|@/stores/editor|@/features/editor/stores/editor|g; s|from './EdgeInspector.vue'|from './inspectors/EdgeInspector.vue'|g; s|from './EdgeRenderer.vue'|from './canvas/EdgeRenderer.vue'|g; s|from './EditorContextMenu.vue'|from './context-menu/EditorContextMenu.vue'|g; s|from './EditorToolbar.vue'|from './toolbar/EditorToolbar.vue'|g; s|from './InspectorPanel.vue'|from './inspectors/InspectorPanel.vue'|g; s|from './inspectorPosition'|from '../utils/inspectorPosition'|g; s|from './keyboardTargets'|from '../utils/keyboardTargets'|g; s|from './NodeInspector.vue'|from './inspectors/NodeInspector.vue'|g; s|from './NodeRenderer.vue'|from './canvas/NodeRenderer.vue'|g; s|from './SelectionLayer.vue'|from './canvas/SelectionLayer.vue'|g; s|from './ViewportPane.vue'|from './canvas/ViewportPane.vue'|g" apps/web/src/features/editor/components/MindEditor.vue
perl -0pi -e "s|from './objectStyles'|from '../../utils/objectStyles'|g" apps/web/src/features/editor/components/canvas/EdgeRenderer.vue apps/web/src/features/editor/components/canvas/TopicNode.vue
perl -0pi -e "s|from './viewportGestureFilter'|from '../../utils/viewportGestureFilter'|g" apps/web/src/features/editor/components/canvas/ViewportPane.vue
perl -0pi -e "s|from './inspectorPosition'|from '../../utils/inspectorPosition'|g" apps/web/src/features/editor/components/inspectors/InspectorPanel.vue
```

Expected key imports:

```ts
// apps/web/src/features/editor/components/MindEditor.vue
import { useEditorStore } from '@/features/editor/stores/editor'
import EdgeInspector from './inspectors/EdgeInspector.vue'
import EdgeRenderer from './canvas/EdgeRenderer.vue'
import EditorContextMenu from './context-menu/EditorContextMenu.vue'
import EditorToolbar from './toolbar/EditorToolbar.vue'
import InspectorPanel from './inspectors/InspectorPanel.vue'
import { readStoredInspectorPosition, writeStoredInspectorPosition } from '../utils/inspectorPosition'
import { isTextEditingTarget } from '../utils/keyboardTargets'
import NodeInspector from './inspectors/NodeInspector.vue'
import NodeRenderer from './canvas/NodeRenderer.vue'
import SelectionLayer from './canvas/SelectionLayer.vue'
import ViewportPane from './canvas/ViewportPane.vue'

// apps/web/src/features/editor/components/canvas/EdgeRenderer.vue
import { createEdgePath, getEdgeMarkerEnd, resolveEdgeStyle } from '../../utils/objectStyles'
```

- [ ] **Step 7: Confirm old editor production imports are gone**

Run:

```bash
rg -n "@/views/EditorView.vue|@/components/editor|@/services/exportPng|@/services/saveFailureDraft|@/services/syncService|@/stores/editor|from './EdgeInspector.vue'|from './EdgeRenderer.vue'|from './EditorToolbar.vue'|from './inspectorPosition'|from './keyboardTargets'|from './objectStyles'|from './viewportGestureFilter'" apps/web/src --glob '!**/*.test.ts'
```

Expected: no output from production files. Editor tests are moved and updated in Task 4.

- [ ] **Step 8: Run focused verification**

Run:

```bash
npm run typecheck -w apps/web
```

Expected: command exits with code 0.

## Task 4: Move Editor Tests and Finish Verification

**Files:**
- Move: `apps/web/src/stores/editor.test.ts` to `apps/web/src/features/editor/__tests__/editor.store.test.ts`
- Move: `apps/web/src/services/exportPng.test.ts` to `apps/web/src/features/editor/__tests__/exportPng.test.ts`
- Move: `apps/web/src/services/saveFailureDraft.test.ts` to `apps/web/src/features/editor/__tests__/saveFailureDraft.test.ts`
- Move: `apps/web/src/services/syncService.test.ts` to `apps/web/src/features/editor/__tests__/syncService.test.ts`
- Move: editor component utility tests into `apps/web/src/features/editor/__tests__`
- Modify imports and dynamic imports in moved tests.

- [ ] **Step 1: Create the editor test directory**

Run:

```bash
mkdir -p apps/web/src/features/editor/__tests__
```

Expected: editor test destination exists.

- [ ] **Step 2: Move editor tests with git history and clearer names**

Run:

```bash
git mv apps/web/src/stores/editor.test.ts apps/web/src/features/editor/__tests__/editor.store.test.ts
git mv apps/web/src/services/exportPng.test.ts apps/web/src/features/editor/__tests__/exportPng.test.ts
git mv apps/web/src/services/saveFailureDraft.test.ts apps/web/src/features/editor/__tests__/saveFailureDraft.test.ts
git mv apps/web/src/services/syncService.test.ts apps/web/src/features/editor/__tests__/syncService.test.ts
git mv apps/web/src/components/editor/EdgeRenderer.test.ts apps/web/src/features/editor/__tests__/edgeRenderer.test.ts
git mv apps/web/src/components/editor/inspectorPosition.test.ts apps/web/src/features/editor/__tests__/inspectorPosition.test.ts
git mv apps/web/src/components/editor/keyboardTargets.test.ts apps/web/src/features/editor/__tests__/keyboardTargets.test.ts
git mv apps/web/src/components/editor/objectStyles.test.ts apps/web/src/features/editor/__tests__/objectStyles.test.ts
git mv apps/web/src/components/editor/viewportGestureFilter.test.ts apps/web/src/features/editor/__tests__/viewportGestureFilter.test.ts
```

Expected: editor tests are listed as renames with the target names above.

- [ ] **Step 3: Update imports in moved editor tests**

Run:

```bash
perl -0pi -e "s|from './editor'|from '@/features/editor/stores/editor'|g" apps/web/src/features/editor/__tests__/editor.store.test.ts
perl -0pi -e "s|from './saveFailureDraft'|from '@/features/editor/services/saveFailureDraft'|g" apps/web/src/features/editor/__tests__/saveFailureDraft.test.ts
perl -0pi -e "s|@/api/client|@/shared/api/client|g; s|vi.mock\\('@/api/client'|vi.mock('@/shared/api/client'|g; s|import\\('./syncService'\\)|import('@/features/editor/services/syncService')|g" apps/web/src/features/editor/__tests__/syncService.test.ts
perl -0pi -e "s|import\\('./exportPng'\\)|import('@/features/editor/services/exportPng')|g" apps/web/src/features/editor/__tests__/exportPng.test.ts
perl -0pi -e "s|from './inspectorPosition'|from '@/features/editor/utils/inspectorPosition'|g" apps/web/src/features/editor/__tests__/inspectorPosition.test.ts
perl -0pi -e "s|from './keyboardTargets'|from '@/features/editor/utils/keyboardTargets'|g" apps/web/src/features/editor/__tests__/keyboardTargets.test.ts
perl -0pi -e "s|from './objectStyles'|from '@/features/editor/utils/objectStyles'|g" apps/web/src/features/editor/__tests__/objectStyles.test.ts
perl -0pi -e "s|from './viewportGestureFilter'|from '@/features/editor/utils/viewportGestureFilter'|g" apps/web/src/features/editor/__tests__/viewportGestureFilter.test.ts
perl -0pi -e "s|new URL\\('./EdgeRenderer.vue', import.meta.url\\)|new URL('../components/canvas/EdgeRenderer.vue', import.meta.url)|g" apps/web/src/features/editor/__tests__/edgeRenderer.test.ts
```

Expected key test imports:

```ts
// apps/web/src/features/editor/__tests__/editor.store.test.ts
import { serializeMindDocument, useEditorStore } from '@/features/editor/stores/editor'

// apps/web/src/features/editor/__tests__/syncService.test.ts
import { apiClient } from '@/shared/api/client'
vi.mock('@/shared/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn()
  }
}))

// apps/web/src/features/editor/__tests__/edgeRenderer.test.ts
const source = readFileSync(new URL('../components/canvas/EdgeRenderer.vue', import.meta.url), 'utf8')
```

- [ ] **Step 4: Remove now-empty legacy top-level Web directories**

Run:

```bash
rmdir apps/web/src/api
rmdir apps/web/src/composables
rmdir apps/web/src/components/editor
rmdir apps/web/src/components
rmdir apps/web/src/router
rmdir apps/web/src/services
rmdir apps/web/src/stores
rmdir apps/web/src/styles
rmdir apps/web/src/views
```

Expected: each `rmdir` exits with code 0.

If a directory is not empty, run:

```bash
find apps/web/src/api apps/web/src/composables apps/web/src/components apps/web/src/router apps/web/src/services apps/web/src/stores apps/web/src/styles apps/web/src/views -maxdepth 2 -type f -print
```

Expected: no output. Any listed file means one of the explicit `git mv` commands above was skipped and should be run before retrying the `rmdir` commands.

- [ ] **Step 5: Confirm the top-level Web source folders match the design**

Run:

```bash
find apps/web/src -maxdepth 1 -type d -print | sort
```

Expected output:

```text
apps/web/src
apps/web/src/app
apps/web/src/features
apps/web/src/shared
```

- [ ] **Step 6: Confirm old Web aliases and relative paths are gone**

Run:

```bash
rg -n "@/api|@/components|@/composables|@/router|@/services|@/stores|@/views|from './api|from './composables|from './services|from './stores|from './views" apps/web/src apps/web/index.html
```

Expected: no output.

- [ ] **Step 7: Run full project verification**

Run:

```bash
npm run typecheck
npm test
npm run build
```

Expected: all three commands exit with code 0.

- [ ] **Step 8: Commit the editor move**

Run:

```bash
git add apps/web/index.html apps/web/src
git commit -m "refactor(web): move editor feature structure"
```

Expected: one commit containing editor moves, test moves, import updates, and removal of empty legacy Web directories.

## Final Review

- [ ] **Step 1: Inspect the final diff summary**

Run:

```bash
git status --short
git log --oneline -n 4
```

Expected:

```text
git status --short
# no output

git log --oneline -n 4
# includes:
# refactor(web): move editor feature structure
# refactor(web): move auth and projects features
# refactor(web): move app and shared structure
# docs: plan web feature directory structure
```

- [ ] **Step 2: Confirm package boundaries were not changed**

Run:

```bash
git diff HEAD~3..HEAD -- apps/api packages package.json tsconfig.base.json
```

Expected: no output. The implementation should only affect `apps/web` and the plan/spec docs already committed before implementation.

- [ ] **Step 3: Confirm final acceptance criteria**

Run:

```bash
test -f apps/web/src/app/main.ts
test -f apps/web/src/shared/api/client.ts
test -f apps/web/src/features/auth/stores/auth.ts
test -f apps/web/src/features/projects/stores/projects.ts
test -f apps/web/src/features/editor/stores/editor.ts
test -f apps/web/src/features/editor/components/MindEditor.vue
test -f apps/web/src/features/editor/__tests__/syncService.test.ts
```

Expected: all `test -f` commands exit with code 0.
