# Color Themes Design

## Goal

Add two additional themes to the existing web theme system:

- `colorful`: a fresh, low-friction colorful theme with a light base and calm blue, green, and violet accents.
- `vivid`: a higher-saturation colorful theme with stronger surfaces, buttons, selection states, and canvas contrast while preserving readability.

The app must continue using `html[theme]`, CSS variables, Ant Design Vue `ConfigProvider`, local persistence, and editor document `meta.theme`.

## Chosen Approach

Extend the current single theme field from two values to four values:

```ts
type ThemeName = 'light' | 'dark' | 'colorful' | 'vivid'
```

The current compact toggle should become a theme picker menu. A menu is more discoverable than cycling through four states and gives users direct access to any theme.

## Architecture

- Update `packages/shared/src/document.ts` so `MindDocument.meta.theme` accepts `light`, `dark`, `colorful`, and `vivid`.
- Update shared document tests to prove both new themes are valid and invalid values are still rejected.
- Update `apps/web/src/composables/useTheme.ts` so theme validation, persistence, Ant Design token selection, and theme selection support four themes.
- Replace the binary toggle behavior in `ThemeToggle.vue` with a menu-based theme picker. The component may keep its file name to minimize churn, but the UI behavior becomes selection rather than cycling.
- Keep `EditorView.vue` behavior: selecting a theme in the editor writes the selected `ThemeName` into `MindDocument.meta.theme`.

## Theme Palette

`colorful` uses a bright work surface:

- Soft blue page background.
- White and lightly tinted panels.
- Blue primary actions.
- Green/violet supporting accents through border, selection, node, and canvas variables.
- Moderate shadows so the interface remains calm.

`vivid` uses a more expressive light theme:

- Warm, saturated page background.
- Tinted surfaces rather than pure white.
- Purple or magenta primary actions.
- Stronger card hover, selection, and node styling.
- Enough contrast for text and editor content to remain readable.

## Data Flow

- App startup still reads `mind-x-theme` from `localStorage`.
- Invalid stored values still fall back to `light`.
- Non-editor pages persist the selected theme as the app preference.
- Editor pages apply the opened document's `meta.theme`.
- Changing the theme while editing a document persists the app preference and marks the document dirty through `editor.setDocumentTheme(themeName)`.
- Theme changes are intentionally not undoable; undo and redo preserve the current selected theme while continuing to undo content edits.
- Saving the document persists the selected color theme through the existing save endpoint.

## UI Behavior

- The header theme control opens a compact menu with four choices.
- Each choice displays a short label: `Light`, `Dark`, `Colorful`, `Vivid`.
- The currently active theme is visually indicated in the menu.
- The picker remains keyboard accessible through Ant Design Vue menu/dropdown behavior.

## Error Handling

- Unknown theme names from storage are ignored and replaced with `light`.
- Existing persisted documents can still load because `light` and `dark` remain valid.
- Documents with unsupported theme values remain rejected by the shared schema.

## Testing

- Shared document tests cover `colorful`, `vivid`, and invalid values.
- Theme controller tests cover initialization and direct selection of the new themes.
- Editor store tests cover writing at least one non-binary theme to `document.meta.theme` and keeping theme changes out of undo/redo history.
- Web typecheck and build verify Ant Design Vue integration.

## Out Of Scope

- User-defined custom palettes.
- Separate light/dark and color-accent dimensions.
- Per-node or per-project palette customization beyond `MindDocument.meta.theme`.
- Browser/system theme auto-detection.
