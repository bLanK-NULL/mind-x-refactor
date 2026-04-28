# Theme Switch Design

## Goal

Add a theme switcher to the web app with at least one dark theme. The implementation must follow the requested pattern of changing the `theme` attribute on the `html` element and pairing that attribute with CSS custom properties.

This work also completes the original refactor acceptance criterion that the editor supports a theme switch. The existing document contract already includes `MindDocument.meta.theme: 'light' | 'dark'`, so the editor theme must stay aligned with that field instead of living only as an application preference.

## Chosen Approach

Use `html[theme]` plus CSS variables for custom application styles, and wrap the Vue app with Ant Design Vue `ConfigProvider` so Ant Design components switch with the same mode.

This gives the app one source of truth for the selected theme while keeping existing Vue components and Ant Design widgets visually aligned.

## Architecture

- Add a small theme module in `apps/web/src/composables/useTheme.ts`.
- Reuse the existing shared `ThemeName` type from `@mind-x/shared`.
- Store the current application mode as `light` or `dark`.
- Apply the mode with `document.documentElement.setAttribute('theme', mode)`.
- Persist the latest application choice in `localStorage` for non-editor pages and app startup.
- Expose a computed Ant Design Vue theme config that uses `theme.defaultAlgorithm` for light mode and `theme.darkAlgorithm` for dark mode.
- Update `App.vue` to wrap `RouterView` in `a-config-provider`.
- Add a reusable `ThemeToggle.vue` button and place it in authenticated page headers.
- Add an editor-store action for updating `document.meta.theme`.
- Keep theme updates out of `@mind-x/mind-engine` command history. Theme is persisted document metadata, but it is not an undoable editor command.

## Data Flow

- App startup reads the stored theme preference and applies it to `html[theme]`.
- Projects and other non-document pages switch the application preference only.
- When an editor document loads, `document.meta.theme` becomes the active application theme for that editor session.
- When the theme is toggled while an editor document is open, the app updates `document.meta.theme`, marks the document dirty through the existing editor dirty-state flow, and applies the same mode to `html[theme]`.
- Undo and redo preserve the current theme instead of restoring historical theme snapshots.
- Saving the editor document persists the selected theme through the existing document save endpoint.

## Styling

- Define default variables in `:root`.
- Define dark variables in `:root[theme="dark"]`.
- Replace hard-coded app colors in global styles, project list styles, login styles, and editor styles with those variables.
- Include variables for surfaces, elevated surfaces, borders, muted text, body text, canvas grid, node surfaces, selection, danger text, and shadows.

## UI Behavior

- The Projects and Editor headers include a compact icon button for switching between light and dark modes.
- The Login page applies the persisted theme, but does not need its own switcher.
- The selected theme survives reloads and new tabs through `localStorage`.
- If stored data is invalid or unavailable, the app falls back to light mode.

## Error Handling

- `localStorage` access is guarded so private browsing or storage failures do not break app startup.
- DOM theme application is idempotent and can run safely during app initialization.

## Testing

- Unit tests cover theme initialization, persistence, invalid stored values, and toggle behavior.
- Editor-store tests cover dirty tracking and prove theme changes are not added to undo or redo history.
- Existing web tests should continue to pass.
- Typecheck and web build verify the Vue and Ant Design integration.

## Out Of Scope

- System theme auto-detection.
- More than two themes.
- User account-level theme sync.
- Changing exported PNG colors beyond the existing export service behavior.
