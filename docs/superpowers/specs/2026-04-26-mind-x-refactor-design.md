# mind-x Refactor Design

Date: 2026-04-26

Status: Approved for planning

## Context

The current workspace contains two reference projects:

- `mind-x-docker`: the existing personal mind map product.
- `vue-flow`: an open source draggable graph editor used only as architectural reference.

The refactor will create a new project folder at `/Users/blank/code/mind-x-sp/mind-x-refactor`. The existing `mind-x-docker` and `vue-flow` projects must not be modified as part of the implementation, except for planning documents created during this design process.

The product goal is `mind-x 2.0`: preserve the core user flow of logging in, managing projects, editing a mind map, saving, reopening, and exporting, while rebuilding the architecture so it is safer, clearer, and easier to extend.

## Confirmed Decisions

- Scope: full-stack core refactor.
- New project folder: `mind-x-refactor`.
- Frontend stack: Vue 3, Vite, TypeScript, Pinia, Vue Router, `ant-design-vue`.
- Backend stack: Koa with TypeScript, kept as Koa but reorganized into middleware, routes, services, repositories, and database modules.
- Database: create a new clean MySQL container from the locally available MySQL image.
- Old mind map JSON migration: not required.
- Development accounts: seed accounts such as `blank/123456` and `admin/admin`, stored with password hashes.
- Editor document model: persist `nodes + edges + viewport + meta`; business rules constrain this graph into a mind map tree.
- Layout: manual-first. New nodes receive reasonable default positions, but structure changes do not trigger whole-tree auto layout.
- UI library: keep `ant-design-vue`.
- Interaction libraries: do not introduce `vue-flow`; allow `d3-zoom` only for viewport pan and zoom.
- Testing: cover key logic and API integration tests; browser E2E is out of the first implementation plan.

## Non-Goals

- Import or depend on `vue-flow`.
- Migrate old recursive mind map JSON into the new document format.
- Build registration, password reset, community features, sharing links, comments, likes, favorites, or realtime collaboration.
- Build a complete mobile editing experience.
- Implement complex automatic graph layout.
- Rebuild the production Docker and deployment system beyond a runnable development setup.

## Architecture

The refactor should be a small monorepo:

```text
mind-x-refactor/
  apps/
    web/
    api/
  packages/
    mind-engine/
    shared/
  docker/
    docker-compose.yml
    init.sql
  docs/
```

`apps/web` owns the browser application: login, project center, editor shell, PNG export, local fallback drafts, and cross-tab notifications.

`apps/api` owns HTTP, authentication, project persistence, validation, structured errors, logging, and database access.

`packages/mind-engine` owns editor-domain logic that can be tested without Vue or DOM APIs: document types, graph rules, commands, history, selection helpers, and default node placement.

`packages/shared` owns API contracts, common response types, schemas, and shared domain constants.

This shape borrows the useful boundary from `vue-flow`: a thin top-level editor container, a store/actions layer, a viewport layer, separate renderers, and composable interaction controllers. The implementation remains a mind-map-specific engine.

## Editor Engine

The editor is split into three layers:

- Pure engine layer in `packages/mind-engine`.
- Web interaction adapter layer in `apps/web`.
- Vue rendering layer in `apps/web`.

The pure engine must not depend on DOM, Vue components, browser storage, or backend APIs. UI events are translated into commands before mutating the editor document.

The persisted document format is:

```ts
type MindDocument = {
  version: 1
  meta: {
    projectId: string
    title: string
    theme: 'light' | 'dark'
    updatedAt: string
  }
  viewport: {
    x: number
    y: number
    zoom: number
  }
  nodes: MindNode[]
  edges: MindEdge[]
}

type MindNode = {
  id: string
  type: 'topic'
  position: { x: number; y: number }
  size?: { width: number; height: number }
  data: { title: string }
}

type MindEdge = {
  id: string
  source: string
  target: string
  type: 'mind-parent'
}
```

Mind map rules:

- A node may have at most one parent edge.
- `Tab` on a selected node creates a child node.
- Deleting a non-root node promotes its children to the deleted node's parent, matching the old product behavior and avoiding accidental large subtree deletion.
- Deleting a root node removes that root and promotes its children to root nodes while preserving their absolute positions.
- Node titles are plain text, not HTML.
- The first version supports one node type: `topic`.

Editor modules:

- `ViewportPane`: uses `d3-zoom` to manage `{ x, y, zoom }`.
- `NodeRenderer`: renders a flat node array with absolute or transformed positions.
- `EdgeRenderer`: renders parent-child Bezier paths from node positions and measured sizes.
- `SelectionLayer`: handles box selection, selected IDs, and multi-node movement.
- `KeyboardController`: centralizes `Tab`, `Delete`, `Ctrl/Cmd+S`, `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, and `Ctrl/Cmd+Y`.
- `CommandHistory`: stores reversible commands for add, delete, edit, move, batch move, and viewport changes if needed.
- `ContextMenuController`: supports editor and node context menus without mixing menu logic into node components.

Layout is manual-first. Creating a child places it to the right of the parent with a small vertical offset based on existing sibling count. The engine does not recalculate the whole tree after edits.

## Frontend Data Flow

The frontend should separate product state from editor state:

- `authStore`: token, user, login, logout, session restoration.
- `projectStore`: project list, create, rename, delete, open metadata.
- `editorStore`: current `MindDocument`, selection, dirty state, saving state, load state, and editor errors.
- `syncService`: server save/load, localForage fallback drafts, pending local draft checks, and cross-tab notifications.

Save flow:

```text
user action
  -> command mutates editor document
  -> editorStore.dirty = true
  -> Ctrl/Cmd+S or save action
  -> PUT /api/projects/:id/document
  -> success: dirty=false, updatedAt refreshed
  -> failure: write pending draft to localForage and show a local-save warning
```

Load flow:

```text
open project
  -> GET /api/projects/:id/document
  -> check localForage for a pending draft
  -> if local draft is newer, ask user to use local draft or server version
  -> hydrate editorStore
```

Cross-tab sync uses `BroadcastChannel` for:

- project renamed
- project deleted
- project list refresh requested
- current open project deleted, causing a warning and navigation away from the editor

The first version does not merge simultaneous edits to the same project across tabs.

## API Design

The API uses standard HTTP status codes and structured JSON errors. It must not use the old pattern of `HTTP 200` with `{ code: 401 }`.

Endpoints:

```text
POST   /api/auth/login
GET    /api/auth/me
GET    /api/projects
POST   /api/projects
PATCH  /api/projects/:id
DELETE /api/projects/:id
GET    /api/projects/:id/document
PUT    /api/projects/:id/document
```

Status semantics:

- `401`: missing, invalid, or expired token.
- `403`: authenticated but not allowed.
- `404`: project not found.
- `409`: duplicate project name for the same user.
- `422`: request validation failed.
- `500`: unexpected server error.

All project operations derive `userId` from the authenticated token. The frontend must not send a user ID to decide project ownership.

## Backend Design

The Koa backend should be organized as:

```text
apps/api/src/
  app.ts
  server.ts
  config/
    env.ts
  middleware/
    auth.ts
    error-handler.ts
    request-logger.ts
    validate.ts
  modules/
    auth/
      auth.routes.ts
      auth.service.ts
      password.ts
    projects/
      projects.routes.ts
      projects.service.ts
      projects.repository.ts
  db/
    pool.ts
    migrations/
    seeds/
```

Security requirements:

- Passwords are stored as hashes, using `bcrypt` or `argon2`.
- JWT secret and database settings come from environment variables.
- SQL uses parameterized queries for all user-controlled values.
- `multipleStatements` is disabled unless a migration tool explicitly requires it.
- Input validation runs before service logic.
- Unknown backend errors are logged but not exposed directly to users.
- Node titles are persisted and rendered as plain text.

## Database and Docker

The new system uses a clean MySQL schema:

```sql
users(
  id,
  username unique,
  password_hash,
  created_at,
  updated_at
)

projects(
  id,
  user_id,
  name,
  document_json,
  created_at,
  updated_at,
  unique(user_id, name)
)
```

The `docker` folder should provide a compose file that creates a new MySQL container, for example `mind-x-refactor-db`, using the locally available MySQL image. It should initialize the schema and seed development accounts with hashed passwords.

The first implementation only needs a development and verification setup. A full production deployment design is outside this spec.

## PNG Export

PNG export remains a frontend feature. It should calculate the document bounding box from node positions and measured sizes, add padding, render the visible graph into an image, and name the file from the project name.

The export should avoid capturing a fixed 20000 by 20000 canvas. It should capture the actual mind map bounds.

## Testing Strategy

`packages/mind-engine` tests:

- create child node
- edit title
- delete node and promote children
- move node
- batch move selected nodes
- undo and redo for add, delete, edit, move, and batch move
- enforce one parent edge per node
- export and import a valid `MindDocument`

`apps/api` tests:

- login success
- login failure
- token-protected route access
- list projects
- create project
- duplicate project name returns `409`
- rename project
- delete project
- save document
- load document
- project ownership isolation

Frontend UI tests and browser E2E tests are not required for the first implementation plan, but the architecture should keep editor logic and sync logic testable without browser automation.

## Acceptance Criteria

- `mind-x-refactor` can be installed and run independently.
- A new MySQL container can be created from the existing local MySQL image.
- Seed accounts can log in.
- Logged-out users cannot access project or document APIs.
- A user can create, open, rename, delete, save, reload, and export a project.
- The editor supports topic node add, edit, delete, drag, multi-select, batch move, pan, zoom, undo, redo, theme switch, manual save, and PNG export.
- Server save failure stores a local pending draft and gives visible feedback.
- Reopening a project can recover from the server document or a newer pending local draft.
- Passwords are not stored in plaintext.
- JWT secret and database settings are not hardcoded.
- SQL queries are parameterized.
- API auth failures use real HTTP `401`.
- Key engine and API integration tests pass.

## Implementation Boundary

The next step is an implementation plan, not coding. The plan should sequence work roughly as:

1. Scaffold `mind-x-refactor` monorepo and shared tooling.
2. Build backend config, database, auth, and project APIs.
3. Build frontend shell, auth flow, and project center.
4. Build `mind-engine` data model, commands, graph rules, and history.
5. Build editor viewport, renderers, selection, drag, keyboard, and context menu adapters.
6. Build save/load, local fallback, cross-tab sync, and PNG export.
7. Add key logic and API integration tests.
8. Run final verification against acceptance criteria.
