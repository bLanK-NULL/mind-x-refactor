# Color Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `colorful` and `vivid` themes to the existing web theme system and expose all four themes through a direct theme picker.

**Architecture:** Extend the shared `MindDocument.meta.theme` schema so documents can persist four theme values. Update the web theme controller to validate, initialize, persist, and theme Ant Design Vue for all four themes. Replace the binary header button with an Ant Design Vue dropdown menu, while keeping editor document theme writes through the existing `editor.setDocumentTheme(themeName)` flow.

**Tech Stack:** TypeScript, Zod, Vue 3, Pinia, Ant Design Vue 4 `Dropdown`/`Menu`/`ConfigProvider`, CSS custom properties, Vitest.

---

## Scope Check

This is a focused extension of the existing theme system. It touches shared document validation, the web theme controller, the theme picker UI, and CSS variable palettes. It does not require backend endpoint changes because project documents already persist `meta.theme` as part of the existing document payload.

## File Structure

- Modify `packages/shared/src/document.ts`: expand the `theme` enum.
- Modify `packages/shared/src/document.test.ts`: cover `colorful`, `vivid`, and invalid values.
- Modify `apps/web/src/composables/useTheme.ts`: add supported theme metadata, Ant Design primary colors, and direct theme selection helpers.
- Modify `apps/web/src/composables/useTheme.test.ts`: prove the two new themes initialize, validate, persist, and apply correctly.
- Modify `apps/web/src/stores/editor.test.ts`: prove the editor can write a non-binary theme to `MindDocument.meta.theme` after the shared contract expands.
- Modify `apps/web/src/components/ThemeToggle.vue`: turn the current binary toggle into a dropdown menu theme picker.
- Modify `apps/web/src/styles/global.css`: add `:root[theme="colorful"]` and `:root[theme="vivid"]` variable blocks.

## Task 1: Extend Shared Theme Contract

**Files:**
- Modify: `packages/shared/src/document.ts`
- Modify: `packages/shared/src/document.test.ts`
- Modify: `apps/web/src/stores/editor.test.ts`

- [ ] **Step 1: Write failing shared schema tests**

Add these tests inside the existing `describe('mindDocumentSchema', ...)` block in `packages/shared/src/document.test.ts`:

```ts
  it('accepts colorful and vivid document themes', () => {
    for (const theme of ['colorful', 'vivid']) {
      const result = mindDocumentSchema.safeParse({
        version: 1,
        meta: {
          projectId: 'project-1',
          title: 'Planning',
          theme,
          updatedAt: '2026-04-26T00:00:00.000Z'
        },
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [],
        edges: []
      })

      expect(result.success).toBe(true)
    }
  })

  it('rejects unsupported document themes', () => {
    const result = mindDocumentSchema.safeParse({
      version: 1,
      meta: {
        projectId: 'project-1',
        title: 'Planning',
        theme: 'rainbow',
        updatedAt: '2026-04-26T00:00:00.000Z'
      },
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [],
      edges: []
    })

    expect(result.success).toBe(false)
  })
```

- [ ] **Step 2: Write a failing editor-store contract test**

Add this test after the existing editor-store theme persistence test in `apps/web/src/stores/editor.test.ts`:

```ts
  it('updates document theme to a color theme for persistence', () => {
    const store = loadedStore()

    store.setDocumentTheme('vivid')

    expect(store.document?.meta.theme).toBe('vivid')
    expect(store.dirty).toBe(true)
  })
```

- [ ] **Step 3: Run contract tests and verify red**

Run:

```bash
npm run test -w packages/shared -- src/document.test.ts
npm run test -w apps/web -- src/stores/editor.test.ts
```

Expected: the shared schema test rejects `colorful` and `vivid`. The editor-store command also fails before the contract update because `ThemeName` does not include `vivid`.

- [ ] **Step 4: Expand the theme enum**

Change the `theme` field in `packages/shared/src/document.ts`:

```ts
theme: z.enum(['light', 'dark', 'colorful', 'vivid']),
```

- [ ] **Step 5: Run contract tests and verify green**

Run:

```bash
npm run test -w packages/shared -- src/document.test.ts
npm run test -w apps/web -- src/stores/editor.test.ts
```

Expected: both test commands pass. The existing `editor.setDocumentTheme(theme: ThemeName)` implementation should not need logic changes because it already writes any valid shared `ThemeName` without adding undo history.

- [ ] **Step 6: Commit shared contract change**

Run:

```bash
git add packages/shared/src/document.ts packages/shared/src/document.test.ts apps/web/src/stores/editor.test.ts
git commit -m "feat(shared): support color theme names"
```

## Task 2: Extend Theme Controller

**Files:**
- Modify: `apps/web/src/composables/useTheme.ts`
- Modify: `apps/web/src/composables/useTheme.test.ts`

- [ ] **Step 1: Write failing theme-controller tests**

Update the `accepts only supported theme names` test in `apps/web/src/composables/useTheme.test.ts`:

```ts
  it('accepts only supported theme names', () => {
    expect(isThemeName('light')).toBe(true)
    expect(isThemeName('dark')).toBe(true)
    expect(isThemeName('colorful')).toBe(true)
    expect(isThemeName('vivid')).toBe(true)
    expect(isThemeName('night')).toBe(false)
    expect(isThemeName(null)).toBe(false)
  })
```

Add this test to the same file:

```ts
  it('sets colorful and vivid themes directly with matching Ant Design primary colors', () => {
    const root = new FakeThemeRoot()
    const storage = new FakeThemeStorage()
    const controller = createThemeController({ root, storage })

    controller.setTheme('colorful')

    expect(controller.currentTheme.value).toBe('colorful')
    expect(root.attributes.get('theme')).toBe('colorful')
    expect(storage.items.get('mind-x-theme')).toBe('colorful')
    expect(controller.antDesignTheme.value.token?.colorPrimary).toBe('#2563eb')

    controller.setTheme('vivid')

    expect(controller.currentTheme.value).toBe('vivid')
    expect(root.attributes.get('theme')).toBe('vivid')
    expect(storage.items.get('mind-x-theme')).toBe('vivid')
    expect(controller.antDesignTheme.value.token?.colorPrimary).toBe('#c026d3')
  })
```

- [ ] **Step 2: Run theme-controller tests and verify red**

Run:

```bash
npm run test -w apps/web -- src/composables/useTheme.test.ts
```

Expected: tests fail because `colorful` and `vivid` are not accepted theme names yet.

- [ ] **Step 3: Add supported theme metadata**

In `apps/web/src/composables/useTheme.ts`, replace the current `COLOR_PRIMARY_BY_THEME` block and `isThemeName` implementation with:

```ts
export const THEME_NAMES = ['light', 'dark', 'colorful', 'vivid'] as const satisfies readonly ThemeName[]

export const THEME_LABELS: Record<ThemeName, string> = {
  colorful: 'Colorful',
  dark: 'Dark',
  light: 'Light',
  vivid: 'Vivid'
}

const COLOR_PRIMARY_BY_THEME: Record<ThemeName, string> = {
  colorful: '#2563eb',
  dark: '#6aa7ff',
  light: '#1677ff',
  vivid: '#c026d3'
}
```

Then update `isThemeName`:

```ts
export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === 'string' && (THEME_NAMES as readonly string[]).includes(value)
}
```

- [ ] **Step 4: Run theme-controller tests and verify green**

Run:

```bash
npm run test -w apps/web -- src/composables/useTheme.test.ts
```

Expected: `useTheme.test.ts` passes.

- [ ] **Step 5: Commit theme controller change**

Run:

```bash
git add apps/web/src/composables/useTheme.ts apps/web/src/composables/useTheme.test.ts
git commit -m "feat(web): extend theme controller options"
```

## Task 3: Convert Header Control Into Theme Picker

**Files:**
- Modify: `apps/web/src/components/ThemeToggle.vue`

- [ ] **Step 1: Replace binary toggle logic with direct selection**

Update `apps/web/src/components/ThemeToggle.vue` to use the exported theme metadata and direct `setTheme(themeName)`:

```vue
<script setup lang="ts">
import type { ThemeName } from '@mind-x/shared'
import { BulbOutlined } from '@ant-design/icons-vue'
import { computed } from 'vue'
import { THEME_LABELS, THEME_NAMES, isThemeName, useTheme } from '@/composables/useTheme'

type MenuClickEvent = {
  key: string | number
}

const emit = defineEmits<{
  change: [theme: ThemeName]
}>()

const { currentTheme, setTheme } = useTheme()
const selectedKeys = computed(() => [currentTheme.value])
const currentThemeLabel = computed(() => THEME_LABELS[currentTheme.value])

function onThemeMenuClick(event: MenuClickEvent): void {
  if (!isThemeName(event.key)) {
    return
  }

  emit('change', setTheme(event.key))
}
</script>

<template>
  <a-dropdown trigger="click">
    <a-tooltip :title="`Theme: ${currentThemeLabel}`">
      <a-button :aria-label="`Theme: ${currentThemeLabel}`" shape="circle" type="text">
        <template #icon>
          <BulbOutlined />
        </template>
      </a-button>
    </a-tooltip>

    <template #overlay>
      <a-menu :selected-keys="selectedKeys" @click="onThemeMenuClick">
        <a-menu-item v-for="themeName in THEME_NAMES" :key="themeName">
          {{ THEME_LABELS[themeName] }}
        </a-menu-item>
      </a-menu>
    </template>
  </a-dropdown>
</template>
```

- [ ] **Step 2: Typecheck the component**

Run:

```bash
npm run typecheck -w apps/web
```

Expected: typecheck exits with code 0. If Ant Design Vue expects an array trigger, change `trigger="click"` to `:trigger="['click']"` and rerun typecheck.

- [ ] **Step 3: Commit picker UI change**

Run:

```bash
git add apps/web/src/components/ThemeToggle.vue
git commit -m "feat(web): add theme picker menu"
```

## Task 4: Add Colorful and Vivid CSS Palettes

**Files:**
- Modify: `apps/web/src/styles/global.css`

- [ ] **Step 1: Add the `colorful` variable block**

Add this block after the existing `:root[theme="dark"]` block in `apps/web/src/styles/global.css`:

```css
:root[theme="colorful"] {
  --color-primary: #2563eb;
  --color-primary-hover: #7c3aed;
  --color-danger: #dc2626;
  --color-text: #223047;
  --color-text-strong: #102033;
  --color-text-muted: #516174;
  --color-text-subtle: #64748b;
  --color-bg: #edf7ff;
  --color-bg-soft: #e0f2fe;
  --color-surface: #ffffff;
  --color-surface-muted: #eaf4ff;
  --color-border: #b9d9f6;
  --color-border-soft: #d1e8fb;
  --color-border-card: #a7d5c4;
  --color-border-node: #9cc4f2;
  --color-canvas: #f3fbff;
  --color-grid: #cde7f7;
  --color-edge: #4f6f9f;
  --shadow-panel: 0 16px 38px rgb(37 99 235 / 10%);
  --shadow-card-hover: 0 8px 22px rgb(34 197 94 / 14%);
  --shadow-node: 0 6px 18px rgb(37 99 235 / 12%);
  --shadow-node-selected: 0 0 0 3px rgb(124 58 237 / 18%), 0 6px 18px rgb(37 99 235 / 14%);
  --shadow-toolbar: 0 10px 24px rgb(37 99 235 / 14%);
  --shadow-menu: 0 12px 28px rgb(37 99 235 / 16%);
  color-scheme: light;
}
```

- [ ] **Step 2: Add the `vivid` variable block**

Add this block immediately after the `colorful` block:

```css
:root[theme="vivid"] {
  --color-primary: #c026d3;
  --color-primary-hover: #f97316;
  --color-danger: #e11d48;
  --color-text: #2d1638;
  --color-text-strong: #1c0b2e;
  --color-text-muted: #684476;
  --color-text-subtle: #8b5a95;
  --color-bg: #fff1f7;
  --color-bg-soft: #ffe4ef;
  --color-surface: #fff7fb;
  --color-surface-muted: #fde7ff;
  --color-border: #f0abfc;
  --color-border-soft: #fbcfe8;
  --color-border-card: #fdba74;
  --color-border-node: #d946ef;
  --color-canvas: #fff7ed;
  --color-grid: #fed7aa;
  --color-edge: #a21caf;
  --shadow-panel: 0 16px 38px rgb(192 38 211 / 16%);
  --shadow-card-hover: 0 8px 22px rgb(249 115 22 / 20%);
  --shadow-node: 0 6px 18px rgb(192 38 211 / 18%);
  --shadow-node-selected: 0 0 0 3px rgb(249 115 22 / 24%), 0 6px 18px rgb(192 38 211 / 20%);
  --shadow-toolbar: 0 10px 24px rgb(192 38 211 / 18%);
  --shadow-menu: 0 12px 28px rgb(192 38 211 / 20%);
  color-scheme: light;
}
```

- [ ] **Step 3: Scan for accidental component-level hard-coded UI colors**

Run:

```bash
rg -n "#[0-9a-fA-F]{3,8}|rgb\\(|rgba\\(" apps/web/src --glob '!**/services/exportPng*' --glob '!**/styles/global.css' --glob '!**/composables/useTheme.ts'
```

Expected: no matches. CSS variable definitions and Ant Design primary token definitions are allowed to contain color literals.

- [ ] **Step 4: Commit CSS palette change**

Run:

```bash
git add apps/web/src/styles/global.css
git commit -m "feat(web): add colorful theme palettes"
```

## Task 5: Final Verification

**Files:**
- `packages/shared/src/document.ts`
- `packages/shared/src/document.test.ts`
- `apps/web/src/composables/useTheme.ts`
- `apps/web/src/composables/useTheme.test.ts`
- `apps/web/src/stores/editor.test.ts`
- `apps/web/src/components/ThemeToggle.vue`
- `apps/web/src/styles/global.css`

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm run test -w packages/shared -- src/document.test.ts
npm run test -w apps/web -- src/composables/useTheme.test.ts src/stores/editor.test.ts
```

Expected: both commands exit with code 0.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: all workspace tests pass.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: typecheck exits with code 0.

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: build exits with code 0. Vite may still warn about large chunks; that warning is acceptable because it predates this theme work.

- [ ] **Step 5: Manual browser check**

If the dev server is not already running, run:

```bash
npm run dev:web
```

Open `http://localhost:5173/projects`, use the theme picker, and verify all four theme choices visibly apply. In an editor document, choose `Colorful` or `Vivid`, save, reload, and verify the theme restores from the document.
