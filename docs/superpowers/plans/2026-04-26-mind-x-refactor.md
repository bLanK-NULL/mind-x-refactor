# mind-x Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/Users/blank/code/mind-x-sp/mind-x-refactor` as a new full-stack `mind-x 2.0` core app with a Vue 3/Vite/TypeScript frontend, Koa/TypeScript backend, clean MySQL schema, and a self-owned mind-map editor engine guided by `vue-flow` architecture without importing `vue-flow`.

**Architecture:** Create a small npm-workspaces monorepo with `apps/web`, `apps/api`, `packages/shared`, and `packages/mind-engine`. The editor state and commands live in a DOM-free engine package, the API owns auth/project persistence with parameterized SQL, and the web app adapts UI events into engine commands.

**Tech Stack:** Vue 3, Vite, TypeScript, Pinia, Vue Router, ant-design-vue, Koa, @koa/router, mysql2, jsonwebtoken, bcryptjs, zod, Vitest, Supertest, d3-zoom, localForage, html2canvas, Docker Compose, MySQL 8.

---

## Scope Check

This plan covers one coupled vertical product: a runnable full-stack core rewrite. The backend, shared contracts, editor engine, and frontend depend on the same document and API model, so splitting into separate unrelated plans would create duplicated contract work. Each task below is still independently committable.

## Implementation Map

Create these top-level paths:

```text
/Users/blank/code/mind-x-sp/mind-x-refactor/
  package.json
  tsconfig.base.json
  .gitignore
  README.md
  docker/
    docker-compose.yml
    init.sql
  packages/
    shared/
      package.json
      tsconfig.json
      src/
        api.ts
        document.ts
        errors.ts
        index.ts
    mind-engine/
      package.json
      tsconfig.json
      src/
        commands.ts
        documentFactory.ts
        graph.ts
        history.ts
        index.ts
        selection.ts
        viewport.ts
  apps/
    api/
      package.json
      tsconfig.json
      src/
        app.ts
        server.ts
        config/env.ts
        db/pool.ts
        db/migrate.ts
        db/seed.ts
        middleware/auth.ts
        middleware/error-handler.ts
        middleware/request-logger.ts
        middleware/validate.ts
        modules/auth/auth.routes.ts
        modules/auth/auth.service.ts
        modules/auth/password.ts
        modules/projects/projects.routes.ts
        modules/projects/projects.service.ts
        modules/projects/projects.repository.ts
        routes.ts
        shared/http-error.ts
    web/
      package.json
      tsconfig.json
      index.html
      vite.config.ts
      src/
        main.ts
        App.vue
        router/index.ts
        styles/global.css
        api/client.ts
        stores/auth.ts
        stores/projects.ts
        stores/editor.ts
        services/syncService.ts
        services/crossTab.ts
        services/exportPng.ts
        views/LoginView.vue
        views/ProjectsView.vue
        views/EditorView.vue
        components/editor/MindEditor.vue
        components/editor/ViewportPane.vue
        components/editor/NodeRenderer.vue
        components/editor/TopicNode.vue
        components/editor/EdgeRenderer.vue
        components/editor/SelectionLayer.vue
        components/editor/EditorToolbar.vue
        components/editor/EditorContextMenu.vue
```

## Task 1: Scaffold Monorepo and Tooling

**Files:**
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/package.json`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/tsconfig.base.json`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/.gitignore`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/README.md`

- [ ] **Step 1: Create the project folder**

Run:

```bash
cd /Users/blank/code/mind-x-sp
mkdir mind-x-refactor
cd mind-x-refactor
git init
```

Expected: `Initialized empty Git repository`.

- [ ] **Step 2: Create root package metadata**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/package.json`:

```json
{
  "name": "mind-x-refactor",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "scripts": {
    "dev:api": "npm run dev -w apps/api",
    "dev:web": "npm run dev -w apps/web",
    "build": "npm run build --workspaces",
    "typecheck": "npm run typecheck --workspaces",
    "test": "vitest run",
    "test:engine": "npm run test -w packages/mind-engine",
    "test:api": "npm run test -w apps/api"
  },
  "devDependencies": {
    "@types/node": "^20.12.12",
    "typescript": "^5.6.3",
    "vitest": "^4.0.7"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 3: Create shared TypeScript config**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

- [ ] **Step 4: Create ignore rules**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/.gitignore`:

```gitignore
node_modules/
dist/
coverage/
.env
.env.local
.DS_Store
docker/mysql-data/
```

- [ ] **Step 5: Create README**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/README.md`:

````markdown
# mind-x-refactor

This is the mind-x 2.0 core refactor.

## Development

```bash
npm install
docker compose -f docker/docker-compose.yml up -d
npm run dev:api
npm run dev:web
```

Seed accounts:

- `blank / 123456`
- `admin / admin`

## Verification

```bash
npm run typecheck
npm test
npm run build
```
````

- [ ] **Step 6: Install root dependencies**

Run:

```bash
cd /Users/blank/code/mind-x-sp/mind-x-refactor
npm install
```

Expected: `package-lock.json` is created and installation exits with code 0.

- [ ] **Step 7: Confirm workspace metadata**

Run:

```bash
npm pkg get workspaces
```

Expected:

```json
[
  "packages/*",
  "apps/*"
]
```

- [ ] **Step 8: Commit**

Run:

```bash
git add package.json package-lock.json tsconfig.base.json .gitignore README.md
git commit -m "chore: scaffold mind-x refactor workspace"
```

## Task 2: Shared Contracts and Schemas

**Files:**
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/shared/package.json`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/shared/tsconfig.json`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/shared/src/document.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/shared/src/api.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/shared/src/errors.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/shared/src/index.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/shared/src/document.test.ts`

- [ ] **Step 1: Create package metadata**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/shared/package.json`:

```json
{
  "name": "@mind-x/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run src"
  },
  "dependencies": {
    "zod": "^3.24.1"
  }
}
```

- [ ] **Step 2: Create package tsconfig**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/shared/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write failing schema tests**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/shared/src/document.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mindDocumentSchema } from './document'

describe('mindDocumentSchema', () => {
  it('accepts a versioned mind document', () => {
    const parsed = mindDocumentSchema.parse({
      version: 1,
      meta: {
        projectId: 'project-1',
        title: 'Planning',
        theme: 'light',
        updatedAt: '2026-04-26T00:00:00.000Z'
      },
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [
        {
          id: 'node-1',
          type: 'topic',
          position: { x: 0, y: 0 },
          data: { title: 'Root' }
        }
      ],
      edges: []
    })

    expect(parsed.nodes[0].data.title).toBe('Root')
  })

  it('rejects HTML titles', () => {
    const result = mindDocumentSchema.safeParse({
      version: 1,
      meta: {
        projectId: 'project-1',
        title: 'Planning',
        theme: 'light',
        updatedAt: '2026-04-26T00:00:00.000Z'
      },
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [
        {
          id: 'node-1',
          type: 'topic',
          position: { x: 0, y: 0 },
          data: { title: '<img src=x onerror=alert(1)>' }
        }
      ],
      edges: []
    })

    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 4: Run failing shared tests**

Run:

```bash
cd /Users/blank/code/mind-x-sp/mind-x-refactor
npm run test -w packages/shared
```

Expected: FAIL because `./document` does not exist.

- [ ] **Step 5: Implement document schema**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/shared/src/document.ts`:

```ts
import { z } from 'zod'

const plainTextSchema = z.string().min(1).max(500).refine((value) => !/[<>]/.test(value), {
  message: 'HTML is not allowed'
})

export const pointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite()
})

export const sizeSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive()
})

export const viewportSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  zoom: z.number().min(0.2).max(3)
})

export const mindNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('topic'),
  position: pointSchema,
  size: sizeSchema.optional(),
  data: z.object({
    title: plainTextSchema
  })
})

export const mindEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  type: z.literal('mind-parent')
})

export const mindDocumentSchema = z.object({
  version: z.literal(1),
  meta: z.object({
    projectId: z.string().min(1),
    title: plainTextSchema,
    theme: z.enum(['light', 'dark']),
    updatedAt: z.string().datetime()
  }),
  viewport: viewportSchema,
  nodes: z.array(mindNodeSchema),
  edges: z.array(mindEdgeSchema)
})

export type Point = z.infer<typeof pointSchema>
export type Size = z.infer<typeof sizeSchema>
export type Viewport = z.infer<typeof viewportSchema>
export type MindNode = z.infer<typeof mindNodeSchema>
export type MindEdge = z.infer<typeof mindEdgeSchema>
export type MindDocument = z.infer<typeof mindDocumentSchema>
export type ThemeName = MindDocument['meta']['theme']
```

- [ ] **Step 6: Implement API and error contracts**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/shared/src/api.ts`:

```ts
import { z } from 'zod'
import { mindDocumentSchema } from './document'

export const userSchema = z.object({
  id: z.string(),
  username: z.string()
})

export const projectSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

export const loginRequestSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128)
})

export const loginResponseSchema = z.object({
  token: z.string(),
  user: userSchema
})

export const createProjectRequestSchema = z.object({
  name: z.string().min(1).max(120)
})

export const renameProjectRequestSchema = z.object({
  name: z.string().min(1).max(120)
})

export const saveDocumentRequestSchema = z.object({
  document: mindDocumentSchema
})

export type UserDto = z.infer<typeof userSchema>
export type ProjectSummaryDto = z.infer<typeof projectSummarySchema>
export type LoginRequest = z.infer<typeof loginRequestSchema>
export type LoginResponse = z.infer<typeof loginResponseSchema>
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>
export type RenameProjectRequest = z.infer<typeof renameProjectRequestSchema>
export type SaveDocumentRequest = z.infer<typeof saveDocumentRequestSchema>
```

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/shared/src/errors.ts`:

```ts
export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR'

export type ApiErrorBody = {
  error: {
    code: ErrorCode
    message: string
    details?: unknown
  }
}
```

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/shared/src/index.ts`:

```ts
export * from './api'
export * from './document'
export * from './errors'
```

- [ ] **Step 7: Run shared tests and typecheck**

Run:

```bash
npm run test -w packages/shared
npm run typecheck -w packages/shared
```

Expected: both commands PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add package.json package-lock.json packages/shared
git commit -m "feat(shared): add API and document contracts"
```

## Task 3: Mind Engine Graph Rules

**Files:**
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/mind-engine/package.json`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/mind-engine/tsconfig.json`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/mind-engine/src/documentFactory.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/mind-engine/src/graph.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/mind-engine/src/index.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/mind-engine/src/graph.test.ts`

- [ ] **Step 1: Create engine package metadata**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/mind-engine/package.json`:

```json
{
  "name": "@mind-x/mind-engine",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run src"
  },
  "dependencies": {
    "@mind-x/shared": "0.1.0"
  }
}
```

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/mind-engine/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  },
  "include": ["src"]
}
```

- [ ] **Step 2: Write failing graph tests**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/mind-engine/src/graph.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from './documentFactory'
import { assertMindTree, getChildIds, getParentId } from './graph'

describe('graph rules', () => {
  it('accepts a document where each node has at most one parent', () => {
    const doc = createEmptyDocument({
      projectId: 'project-1',
      title: 'Planning',
      now: '2026-04-26T00:00:00.000Z'
    })
    doc.nodes.push(
      { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } },
      { id: 'child', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'Child' } }
    )
    doc.edges.push({ id: 'edge-1', source: 'root', target: 'child', type: 'mind-parent' })

    expect(() => assertMindTree(doc)).not.toThrow()
    expect(getParentId(doc, 'child')).toBe('root')
    expect(getChildIds(doc, 'root')).toEqual(['child'])
  })

  it('rejects a node with two parent edges', () => {
    const doc = createEmptyDocument({
      projectId: 'project-1',
      title: 'Planning',
      now: '2026-04-26T00:00:00.000Z'
    })
    doc.nodes.push(
      { id: 'a', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'A' } },
      { id: 'b', type: 'topic', position: { x: 0, y: 120 }, data: { title: 'B' } },
      { id: 'c', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'C' } }
    )
    doc.edges.push(
      { id: 'edge-1', source: 'a', target: 'c', type: 'mind-parent' },
      { id: 'edge-2', source: 'b', target: 'c', type: 'mind-parent' }
    )

    expect(() => assertMindTree(doc)).toThrow('Node c has more than one parent')
  })
})
```

- [ ] **Step 3: Run failing graph tests**

Run:

```bash
npm run test -w packages/mind-engine
```

Expected: FAIL because `documentFactory` and `graph` do not exist.

- [ ] **Step 4: Implement document factory**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/mind-engine/src/documentFactory.ts`:

```ts
import type { MindDocument } from '@mind-x/shared'

export type CreateDocumentInput = {
  projectId: string
  title: string
  now: string
}

export function createEmptyDocument(input: CreateDocumentInput): MindDocument {
  return {
    version: 1,
    meta: {
      projectId: input.projectId,
      title: input.title,
      theme: 'light',
      updatedAt: input.now
    },
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [],
    edges: []
  }
}
```

- [ ] **Step 5: Implement graph rules**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/mind-engine/src/graph.ts`:

```ts
import type { MindDocument, MindEdge, MindNode } from '@mind-x/shared'

export function findNode(document: MindDocument, nodeId: string): MindNode | undefined {
  return document.nodes.find((node) => node.id === nodeId)
}

export function getParentId(document: MindDocument, nodeId: string): string | null {
  const parentEdges = document.edges.filter((edge) => edge.target === nodeId)
  if (parentEdges.length === 0) {
    return null
  }
  if (parentEdges.length > 1) {
    throw new Error(`Node ${nodeId} has more than one parent`)
  }
  return parentEdges[0].source
}

export function getChildIds(document: MindDocument, nodeId: string): string[] {
  return document.edges.filter((edge) => edge.source === nodeId).map((edge) => edge.target)
}

export function createParentEdge(source: string, target: string): MindEdge {
  return {
    id: `${source}->${target}`,
    source,
    target,
    type: 'mind-parent'
  }
}

export function assertMindTree(document: MindDocument): void {
  const nodeIds = new Set(document.nodes.map((node) => node.id))
  const parentCountByNode = new Map<string, number>()

  for (const edge of document.edges) {
    if (!nodeIds.has(edge.source)) {
      throw new Error(`Edge ${edge.id} source ${edge.source} does not exist`)
    }
    if (!nodeIds.has(edge.target)) {
      throw new Error(`Edge ${edge.id} target ${edge.target} does not exist`)
    }
    parentCountByNode.set(edge.target, (parentCountByNode.get(edge.target) ?? 0) + 1)
  }

  for (const [nodeId, parentCount] of parentCountByNode.entries()) {
    if (parentCount > 1) {
      throw new Error(`Node ${nodeId} has more than one parent`)
    }
  }
}
```

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/mind-engine/src/index.ts`:

```ts
export * from './documentFactory'
export * from './graph'
```

- [ ] **Step 6: Run graph tests and typecheck**

Run:

```bash
npm run test -w packages/mind-engine
npm run typecheck -w packages/mind-engine
```

Expected: both commands PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add package.json package-lock.json packages/mind-engine
git commit -m "feat(engine): add mind map graph rules"
```

## Task 4: Mind Engine Commands and History

**Files:**
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/mind-engine/src/commands.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/mind-engine/src/history.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/mind-engine/src/selection.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/mind-engine/src/viewport.ts`
- Modify: `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/mind-engine/src/index.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/mind-engine/src/commands.test.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/mind-engine/src/history.test.ts`

- [ ] **Step 1: Write failing command tests**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/mind-engine/src/commands.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from './documentFactory'
import { addChildNode, deleteNodePromoteChildren, editNodeTitle, moveNodes } from './commands'
import { getParentId } from './graph'

describe('commands', () => {
  it('adds a child node to the right of its parent', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push({ id: 'root', type: 'topic', position: { x: 10, y: 20 }, size: { width: 160, height: 48 }, data: { title: 'Root' } })

    const result = addChildNode(doc, {
      parentId: 'root',
      id: 'child',
      title: 'Child'
    })

    expect(result.nodes.find((node) => node.id === 'child')?.position).toEqual({ x: 250, y: 20 })
    expect(getParentId(result, 'child')).toBe('root')
  })

  it('edits a node title as plain text', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push({ id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } })

    const result = editNodeTitle(doc, { nodeId: 'root', title: 'Updated' })

    expect(result.nodes[0].data.title).toBe('Updated')
  })

  it('moves selected nodes by delta', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push(
      { id: 'a', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'A' } },
      { id: 'b', type: 'topic', position: { x: 10, y: 20 }, data: { title: 'B' } }
    )

    const result = moveNodes(doc, { nodeIds: ['a', 'b'], delta: { x: 5, y: -3 } })

    expect(result.nodes.map((node) => node.position)).toEqual([{ x: 5, y: -3 }, { x: 15, y: 17 }])
  })

  it('deletes a node and promotes children to the deleted node parent', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push(
      { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } },
      { id: 'middle', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'Middle' } },
      { id: 'leaf', type: 'topic', position: { x: 480, y: 0 }, data: { title: 'Leaf' } }
    )
    doc.edges.push(
      { id: 'root->middle', source: 'root', target: 'middle', type: 'mind-parent' },
      { id: 'middle->leaf', source: 'middle', target: 'leaf', type: 'mind-parent' }
    )

    const result = deleteNodePromoteChildren(doc, { nodeId: 'middle' })

    expect(result.nodes.map((node) => node.id)).toEqual(['root', 'leaf'])
    expect(getParentId(result, 'leaf')).toBe('root')
  })
})
```

- [ ] **Step 2: Write failing history tests**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/mind-engine/src/history.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from './documentFactory'
import { createHistory } from './history'

describe('history', () => {
  it('undoes and redoes document snapshots', () => {
    const initial = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    const next = {
      ...initial,
      nodes: [{ id: 'root', type: 'topic' as const, position: { x: 0, y: 0 }, data: { title: 'Root' } }]
    }
    const history = createHistory(initial)

    history.push(next)

    expect(history.current().nodes).toHaveLength(1)
    expect(history.undo().nodes).toHaveLength(0)
    expect(history.redo().nodes).toHaveLength(1)
  })
})
```

- [ ] **Step 3: Run failing engine tests**

Run:

```bash
npm run test -w packages/mind-engine
```

Expected: FAIL because command and history modules do not exist.

- [ ] **Step 4: Implement commands**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/mind-engine/src/commands.ts`:

```ts
import type { MindDocument, Point } from '@mind-x/shared'
import { assertMindTree, createParentEdge, findNode, getChildIds, getParentId } from './graph'

const DEFAULT_NODE_WIDTH = 160
const CHILD_GAP_X = 80
const SIBLING_GAP_Y = 72

function cloneDocument(document: MindDocument): MindDocument {
  return structuredClone(document)
}

export type AddChildNodeInput = {
  parentId: string
  id: string
  title: string
}

export function addChildNode(document: MindDocument, input: AddChildNodeInput): MindDocument {
  const next = cloneDocument(document)
  const parent = findNode(next, input.parentId)
  if (!parent) {
    throw new Error(`Parent node ${input.parentId} does not exist`)
  }

  const childCount = getChildIds(next, input.parentId).length
  const parentWidth = parent.size?.width ?? DEFAULT_NODE_WIDTH
  const position = {
    x: parent.position.x + parentWidth + CHILD_GAP_X,
    y: parent.position.y + childCount * SIBLING_GAP_Y
  }

  next.nodes.push({
    id: input.id,
    type: 'topic',
    position,
    data: { title: input.title }
  })
  next.edges.push(createParentEdge(input.parentId, input.id))
  assertMindTree(next)
  return next
}

export type EditNodeTitleInput = {
  nodeId: string
  title: string
}

export function editNodeTitle(document: MindDocument, input: EditNodeTitleInput): MindDocument {
  if (/[<>]/.test(input.title) || input.title.trim().length === 0) {
    throw new Error('Node title must be non-empty plain text')
  }
  const next = cloneDocument(document)
  const node = findNode(next, input.nodeId)
  if (!node) {
    throw new Error(`Node ${input.nodeId} does not exist`)
  }
  node.data.title = input.title
  return next
}

export type MoveNodesInput = {
  nodeIds: string[]
  delta: Point
}

export function moveNodes(document: MindDocument, input: MoveNodesInput): MindDocument {
  const next = cloneDocument(document)
  const selected = new Set(input.nodeIds)
  for (const node of next.nodes) {
    if (selected.has(node.id)) {
      node.position = {
        x: node.position.x + input.delta.x,
        y: node.position.y + input.delta.y
      }
    }
  }
  return next
}

export type DeleteNodeInput = {
  nodeId: string
}

export function deleteNodePromoteChildren(document: MindDocument, input: DeleteNodeInput): MindDocument {
  const next = cloneDocument(document)
  const node = findNode(next, input.nodeId)
  if (!node) {
    throw new Error(`Node ${input.nodeId} does not exist`)
  }

  const parentId = getParentId(next, input.nodeId)
  const childIds = getChildIds(next, input.nodeId)

  next.nodes = next.nodes.filter((candidate) => candidate.id !== input.nodeId)
  next.edges = next.edges.filter((edge) => edge.source !== input.nodeId && edge.target !== input.nodeId)

  if (parentId) {
    for (const childId of childIds) {
      next.edges.push(createParentEdge(parentId, childId))
    }
  }

  assertMindTree(next)
  return next
}
```

- [ ] **Step 5: Implement history, selection, and viewport helpers**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/mind-engine/src/history.ts`:

```ts
export type History<T> = {
  current(): T
  push(value: T): void
  undo(): T
  redo(): T
  canUndo(): boolean
  canRedo(): boolean
}

export function createHistory<T>(initial: T): History<T> {
  let stack = [structuredClone(initial)]
  let index = 0

  return {
    current() {
      return structuredClone(stack[index])
    },
    push(value) {
      stack = stack.slice(0, index + 1)
      stack.push(structuredClone(value))
      index = stack.length - 1
    },
    undo() {
      if (index > 0) {
        index -= 1
      }
      return structuredClone(stack[index])
    },
    redo() {
      if (index < stack.length - 1) {
        index += 1
      }
      return structuredClone(stack[index])
    },
    canUndo() {
      return index > 0
    },
    canRedo() {
      return index < stack.length - 1
    }
  }
}
```

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/mind-engine/src/selection.ts`:

```ts
import type { MindNode, Point, Size } from '@mind-x/shared'

export type Rect = Point & Size

export function nodeIntersectsRect(node: MindNode, rect: Rect): boolean {
  const width = node.size?.width ?? 160
  const height = node.size?.height ?? 48
  return (
    node.position.x < rect.x + rect.width &&
    node.position.x + width > rect.x &&
    node.position.y < rect.y + rect.height &&
    node.position.y + height > rect.y
  )
}

export function getNodesInRect(nodes: MindNode[], rect: Rect): string[] {
  return nodes.filter((node) => nodeIntersectsRect(node, rect)).map((node) => node.id)
}
```

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/mind-engine/src/viewport.ts`:

```ts
import type { Point, Viewport } from '@mind-x/shared'

export function screenToWorld(point: Point, viewport: Viewport): Point {
  return {
    x: (point.x - viewport.x) / viewport.zoom,
    y: (point.y - viewport.y) / viewport.zoom
  }
}

export function worldToScreen(point: Point, viewport: Viewport): Point {
  return {
    x: point.x * viewport.zoom + viewport.x,
    y: point.y * viewport.zoom + viewport.y
  }
}
```

Update `/Users/blank/code/mind-x-sp/mind-x-refactor/packages/mind-engine/src/index.ts`:

```ts
export * from './commands'
export * from './documentFactory'
export * from './graph'
export * from './history'
export * from './selection'
export * from './viewport'
```

- [ ] **Step 6: Run engine tests and typecheck**

Run:

```bash
npm run test -w packages/mind-engine
npm run typecheck -w packages/mind-engine
```

Expected: both commands PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add packages/mind-engine
git commit -m "feat(engine): add commands and history"
```

## Task 5: Docker, Database, and API Foundation

**Files:**
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/docker/docker-compose.yml`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/docker/init.sql`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/package.json`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/tsconfig.json`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/config/env.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/shared/http-error.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/middleware/error-handler.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/middleware/request-logger.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/db/pool.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/app.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/server.ts`

- [ ] **Step 1: Create Docker database files**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/docker/docker-compose.yml`:

```yaml
services:
  mysql:
    image: mysql:8.0.39
    container_name: mind-x-refactor-db
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: mind_x_refactor
      MYSQL_USER: mindx
      MYSQL_PASSWORD: mindx
      TZ: Asia/Shanghai
    ports:
      - "3307:3306"
    volumes:
      - ./mysql-data:/var/lib/mysql
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    command: --default-authentication-plugin=mysql_native_password
```

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/docker/init.sql`:

```sql
CREATE DATABASE IF NOT EXISTS mind_x_refactor CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE mind_x_refactor;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  document_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_project_name (user_id, name),
  CONSTRAINT fk_projects_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

- [ ] **Step 2: Create API package metadata**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/package.json`:

```json
{
  "name": "@mind-x/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run src",
    "db:seed": "tsx src/db/seed.ts"
  },
  "dependencies": {
    "@koa/router": "^13.1.0",
    "@mind-x/mind-engine": "0.1.0",
    "@mind-x/shared": "0.1.0",
    "bcryptjs": "^2.4.3",
    "dotenv": "^16.4.7",
    "jsonwebtoken": "^9.0.2",
    "koa": "^2.16.3",
    "koa-bodyparser": "^4.4.1",
    "mysql2": "^3.11.5",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/koa": "^2.15.0",
    "@types/koa-bodyparser": "^4.3.12",
    "@types/supertest": "^6.0.2",
    "supertest": "^7.0.0",
    "tsx": "^4.19.2"
  }
}
```

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Implement environment and error foundation**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/config/env.ts`:

```ts
import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  JWT_SECRET: z.string().min(16).default('mind-x-dev-secret-change-me'),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().default(3307),
  DB_USER: z.string().default('mindx'),
  DB_PASSWORD: z.string().default('mindx'),
  DB_NAME: z.string().default('mind_x_refactor')
})

export const env = envSchema.parse(process.env)
```

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/shared/http-error.ts`:

```ts
import type { ErrorCode } from '@mind-x/shared'

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message)
  }
}
```

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/middleware/error-handler.ts`:

```ts
import type Koa from 'koa'
import { ZodError } from 'zod'
import { HttpError } from '../shared/http-error'

export async function errorHandler(ctx: Koa.Context, next: Koa.Next): Promise<void> {
  try {
    await next()
  } catch (error) {
    if (error instanceof HttpError) {
      ctx.status = error.status
      ctx.body = { error: { code: error.code, message: error.message, details: error.details } }
      return
    }

    if (error instanceof ZodError) {
      ctx.status = 422
      ctx.body = { error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details: error.flatten() } }
      return
    }

    ctx.status = 500
    ctx.body = { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }
    ctx.app.emit('error', error, ctx)
  }
}
```

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/middleware/request-logger.ts`:

```ts
import type Koa from 'koa'

export async function requestLogger(ctx: Koa.Context, next: Koa.Next): Promise<void> {
  const start = Date.now()
  await next()
  const ms = Date.now() - start
  console.log(`${ctx.method} ${ctx.url} ${ctx.status} - ${ms}ms`)
}
```

- [ ] **Step 4: Implement pool and Koa app**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/db/pool.ts`:

```ts
import mysql from 'mysql2/promise'
import { env } from '../config/env'

export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: false,
  multipleStatements: false
})
```

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/app.ts`:

```ts
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import { errorHandler } from './middleware/error-handler'
import { requestLogger } from './middleware/request-logger'

export function createApp(): Koa {
  const app = new Koa()

  app.use(errorHandler)
  app.use(requestLogger)
  app.use(bodyParser({ jsonLimit: '2mb' }))

  app.use((ctx) => {
    if (ctx.path === '/api/health') {
      ctx.body = { ok: true }
      return
    }
    ctx.status = 404
    ctx.body = { error: { code: 'NOT_FOUND', message: 'Route not found' } }
  })

  app.on('error', (error) => {
    console.error(error)
  })

  return app
}
```

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/server.ts`:

```ts
import { env } from './config/env'
import { createApp } from './app'

const app = createApp()

app.listen(env.PORT, () => {
  console.log(`mind-x api listening on ${env.PORT}`)
})
```

- [ ] **Step 5: Install workspace dependencies**

Run:

```bash
cd /Users/blank/code/mind-x-sp/mind-x-refactor
npm install
```

Expected: installation exits with code 0.

- [ ] **Step 6: Verify API typecheck**

Run:

```bash
npm run typecheck -w apps/api
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add package.json package-lock.json docker apps/api
git commit -m "feat(api): add Koa and database foundation"
```

## Task 6: Auth API and Seed Accounts

**Files:**
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/modules/auth/password.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/modules/auth/auth.service.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/modules/auth/auth.routes.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/middleware/auth.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/middleware/validate.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/routes.ts`
- Modify: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/app.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/db/seed.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/modules/auth/auth.test.ts`

- [ ] **Step 1: Write failing auth tests**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/modules/auth/auth.test.ts`:

```ts
import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../app'
import { seedUsers } from '../../db/seed'

describe('auth routes', () => {
  beforeAll(async () => {
    await seedUsers()
  })

  it('logs in with a seed account', async () => {
    const response = await request(createApp().callback())
      .post('/api/auth/login')
      .send({ username: 'blank', password: '123456' })
      .expect(200)

    expect(response.body.token).toEqual(expect.any(String))
    expect(response.body.user.username).toBe('blank')
  })

  it('rejects bad credentials with 401', async () => {
    const response = await request(createApp().callback())
      .post('/api/auth/login')
      .send({ username: 'blank', password: 'wrong' })
      .expect(401)

    expect(response.body.error.code).toBe('UNAUTHORIZED')
  })
})
```

- [ ] **Step 2: Run failing auth tests**

Run:

```bash
docker compose -f docker/docker-compose.yml up -d
npm run test -w apps/api -- src/modules/auth/auth.test.ts
```

Expected: FAIL because auth modules and seed script do not exist.

- [ ] **Step 3: Implement validation middleware**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/middleware/validate.ts`:

```ts
import type Koa from 'koa'
import type { ZodSchema } from 'zod'

export function validateBody<T>(schema: ZodSchema<T>) {
  return async (ctx: Koa.Context, next: Koa.Next): Promise<void> => {
    ctx.request.body = schema.parse(ctx.request.body)
    await next()
  }
}
```

- [ ] **Step 4: Implement password and auth service**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/modules/auth/password.ts`:

```ts
import bcrypt from 'bcryptjs'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
```

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/modules/auth/auth.service.ts`:

```ts
import jwt from 'jsonwebtoken'
import type { RowDataPacket } from 'mysql2'
import type { LoginRequest, LoginResponse, UserDto } from '@mind-x/shared'
import { env } from '../../config/env'
import { pool } from '../../db/pool'
import { HttpError } from '../../shared/http-error'
import { verifyPassword } from './password'

type UserRow = RowDataPacket & {
  id: string
  username: string
  password_hash: string
}

export type AuthTokenPayload = {
  userId: string
  username: string
}

export function signToken(user: UserDto): string {
  return jwt.sign({ userId: user.id, username: user.username }, env.JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload
}

export async function login(input: LoginRequest): Promise<LoginResponse> {
  const [rows] = await pool.query<UserRow[]>('SELECT id, username, password_hash FROM users WHERE username = ?', [input.username])
  const user = rows[0]
  if (!user) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Invalid username or password')
  }

  const passwordMatches = await verifyPassword(input.password, user.password_hash)
  if (!passwordMatches) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Invalid username or password')
  }

  const dto = { id: user.id, username: user.username }
  return { token: signToken(dto), user: dto }
}
```

- [ ] **Step 5: Implement auth middleware and routes**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/middleware/auth.ts`:

```ts
import type Koa from 'koa'
import { HttpError } from '../shared/http-error'
import { verifyToken } from '../modules/auth/auth.service'

export type AuthState = {
  user: {
    id: string
    username: string
  }
}

export async function requireAuth(ctx: Koa.ParameterizedContext<AuthState>, next: Koa.Next): Promise<void> {
  const header = ctx.get('authorization')
  const match = header.match(/^Bearer (.+)$/)
  if (!match) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Missing bearer token')
  }

  const payload = verifyToken(match[1])
  ctx.state.user = { id: payload.userId, username: payload.username }
  await next()
}
```

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/modules/auth/auth.routes.ts`:

```ts
import Router from '@koa/router'
import { loginRequestSchema } from '@mind-x/shared'
import { validateBody } from '../../middleware/validate'
import { requireAuth } from '../../middleware/auth'
import { login } from './auth.service'

export function createAuthRouter(): Router {
  const router = new Router({ prefix: '/auth' })

  router.post('/login', validateBody(loginRequestSchema), async (ctx) => {
    ctx.body = await login(ctx.request.body)
  })

  router.get('/me', requireAuth, async (ctx) => {
    ctx.body = { user: ctx.state.user }
  })

  return router
}
```

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/routes.ts`:

```ts
import Router from '@koa/router'
import { createAuthRouter } from './modules/auth/auth.routes'

export function createApiRouter(): Router {
  const router = new Router({ prefix: '/api' })
  const authRouter = createAuthRouter()
  router.use(authRouter.routes())
  router.use(authRouter.allowedMethods())
  return router
}
```

Update `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/app.ts`:

```ts
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import { createApiRouter } from './routes'
import { errorHandler } from './middleware/error-handler'
import { requestLogger } from './middleware/request-logger'

export function createApp(): Koa {
  const app = new Koa()
  const apiRouter = createApiRouter()

  app.use(errorHandler)
  app.use(requestLogger)
  app.use(bodyParser({ jsonLimit: '2mb' }))

  app.use(apiRouter.routes())
  app.use(apiRouter.allowedMethods())

  app.use((ctx) => {
    if (ctx.path === '/api/health') {
      ctx.body = { ok: true }
      return
    }
    ctx.status = 404
    ctx.body = { error: { code: 'NOT_FOUND', message: 'Route not found' } }
  })

  app.on('error', (error) => {
    console.error(error)
  })

  return app
}
```

- [ ] **Step 6: Implement seed script**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/db/seed.ts`:

```ts
import { pool } from './pool'
import { hashPassword } from '../modules/auth/password'

const seedUserRows = [
  { id: '00000000-0000-4000-8000-000000000001', username: 'blank', password: '123456' },
  { id: '00000000-0000-4000-8000-000000000002', username: 'admin', password: 'admin' }
]

export async function seedUsers(): Promise<void> {
  for (const user of seedUserRows) {
    const passwordHash = await hashPassword(user.password)
    await pool.execute(
      `INSERT INTO users (id, username, password_hash)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      [user.id, user.username, passwordHash]
    )
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await seedUsers()
  await pool.end()
}
```

- [ ] **Step 7: Run auth tests and typecheck**

Run:

```bash
npm run test -w apps/api -- src/modules/auth/auth.test.ts
npm run typecheck -w apps/api
```

Expected: both commands PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add apps/api
git commit -m "feat(api): add auth and seed accounts"
```

## Task 7: Project API

**Files:**
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/modules/projects/projects.repository.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/modules/projects/projects.service.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/modules/projects/projects.routes.ts`
- Modify: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/routes.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/modules/projects/projects.test.ts`

- [ ] **Step 1: Write failing project API tests**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/modules/projects/projects.test.ts`:

```ts
import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@mind-x/mind-engine'
import { createApp } from '../../app'
import { seedUsers } from '../../db/seed'

async function loginToken(): Promise<string> {
  const response = await request(createApp().callback())
    .post('/api/auth/login')
    .send({ username: 'blank', password: '123456' })
    .expect(200)
  return response.body.token
}

describe('project routes', () => {
  beforeAll(async () => {
    await seedUsers()
  })

  it('creates, lists, saves, loads, renames, and deletes a project', async () => {
    const token = await loginToken()
    const app = createApp().callback()

    const created = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Project ${Date.now()}` })
      .expect(201)

    const projectId = created.body.project.id

    const list = await request(app).get('/api/projects').set('Authorization', `Bearer ${token}`).expect(200)
    expect(list.body.projects.some((project: { id: string }) => project.id === projectId)).toBe(true)

    const document = createEmptyDocument({
      projectId,
      title: 'Saved Doc',
      now: '2026-04-26T00:00:00.000Z'
    })

    await request(app)
      .put(`/api/projects/${projectId}/document`)
      .set('Authorization', `Bearer ${token}`)
      .send({ document })
      .expect(200)

    const loaded = await request(app)
      .get(`/api/projects/${projectId}/document`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    expect(loaded.body.document.meta.title).toBe('Saved Doc')

    await request(app)
      .patch(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Renamed ${Date.now()}` })
      .expect(200)

    await request(app).delete(`/api/projects/${projectId}`).set('Authorization', `Bearer ${token}`).expect(204)
  })

  it('returns 401 for project list without a token', async () => {
    const response = await request(createApp().callback()).get('/api/projects').expect(401)
    expect(response.body.error.code).toBe('UNAUTHORIZED')
  })
})
```

- [ ] **Step 2: Run failing project tests**

Run:

```bash
npm run test -w apps/api -- src/modules/projects/projects.test.ts
```

Expected: FAIL because project modules are missing.

- [ ] **Step 3: Implement repository**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/modules/projects/projects.repository.ts`:

```ts
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import type { MindDocument } from '@mind-x/shared'
import { pool } from '../../db/pool'

export type ProjectRow = RowDataPacket & {
  id: string
  user_id: string
  name: string
  document_json: MindDocument
  created_at: Date
  updated_at: Date
}

export async function listProjects(userId: string): Promise<ProjectRow[]> {
  const [rows] = await pool.query<ProjectRow[]>(
    'SELECT id, user_id, name, document_json, created_at, updated_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC',
    [userId]
  )
  return rows
}

export async function findProject(userId: string, projectId: string): Promise<ProjectRow | null> {
  const [rows] = await pool.query<ProjectRow[]>(
    'SELECT id, user_id, name, document_json, created_at, updated_at FROM projects WHERE user_id = ? AND id = ?',
    [userId, projectId]
  )
  return rows[0] ?? null
}

export async function insertProject(input: {
  id: string
  userId: string
  name: string
  document: MindDocument
}): Promise<void> {
  await pool.execute<ResultSetHeader>(
    'INSERT INTO projects (id, user_id, name, document_json) VALUES (?, ?, ?, ?)',
    [input.id, input.userId, input.name, JSON.stringify(input.document)]
  )
}

export async function updateProjectName(input: { userId: string; projectId: string; name: string }): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    'UPDATE projects SET name = ? WHERE user_id = ? AND id = ?',
    [input.name, input.userId, input.projectId]
  )
  return result.affectedRows
}

export async function updateProjectDocument(input: {
  userId: string
  projectId: string
  document: MindDocument
}): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    'UPDATE projects SET document_json = ? WHERE user_id = ? AND id = ?',
    [JSON.stringify(input.document), input.userId, input.projectId]
  )
  return result.affectedRows
}

export async function deleteProject(userId: string, projectId: string): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>('DELETE FROM projects WHERE user_id = ? AND id = ?', [userId, projectId])
  return result.affectedRows
}
```

- [ ] **Step 4: Implement service and routes**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/modules/projects/projects.service.ts`:

```ts
import type { MindDocument, ProjectSummaryDto } from '@mind-x/shared'
import { createEmptyDocument } from '@mind-x/mind-engine'
import { HttpError } from '../../shared/http-error'
import {
  deleteProject,
  findProject,
  insertProject,
  listProjects,
  updateProjectDocument,
  updateProjectName
} from './projects.repository'

function toSummary(row: Awaited<ReturnType<typeof listProjects>>[number]): ProjectSummaryDto {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  }
}

export async function getProjects(userId: string): Promise<ProjectSummaryDto[]> {
  return (await listProjects(userId)).map(toSummary)
}

export async function createProject(userId: string, name: string): Promise<ProjectSummaryDto> {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const document = createEmptyDocument({ projectId: id, title: name, now })
  try {
    await insertProject({ id, userId, name, document })
  } catch (error) {
    if (String(error).includes('Duplicate')) {
      throw new HttpError(409, 'CONFLICT', 'Project name already exists')
    }
    throw error
  }
  const row = await findProject(userId, id)
  if (!row) {
    throw new HttpError(500, 'INTERNAL_ERROR', 'Created project could not be loaded')
  }
  return toSummary(row)
}

export async function renameProject(userId: string, projectId: string, name: string): Promise<ProjectSummaryDto> {
  try {
    const affected = await updateProjectName({ userId, projectId, name })
    if (affected === 0) {
      throw new HttpError(404, 'NOT_FOUND', 'Project not found')
    }
  } catch (error) {
    if (error instanceof HttpError) {
      throw error
    }
    if (String(error).includes('Duplicate')) {
      throw new HttpError(409, 'CONFLICT', 'Project name already exists')
    }
    throw error
  }
  const row = await findProject(userId, projectId)
  if (!row) {
    throw new HttpError(404, 'NOT_FOUND', 'Project not found')
  }
  return toSummary(row)
}

export async function removeProject(userId: string, projectId: string): Promise<void> {
  const affected = await deleteProject(userId, projectId)
  if (affected === 0) {
    throw new HttpError(404, 'NOT_FOUND', 'Project not found')
  }
}

export async function getDocument(userId: string, projectId: string): Promise<MindDocument> {
  const row = await findProject(userId, projectId)
  if (!row) {
    throw new HttpError(404, 'NOT_FOUND', 'Project not found')
  }
  return row.document_json
}

export async function saveDocument(userId: string, projectId: string, document: MindDocument): Promise<MindDocument> {
  const affected = await updateProjectDocument({ userId, projectId, document })
  if (affected === 0) {
    throw new HttpError(404, 'NOT_FOUND', 'Project not found')
  }
  return document
}
```

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/modules/projects/projects.routes.ts`:

```ts
import Router from '@koa/router'
import { createProjectRequestSchema, renameProjectRequestSchema, saveDocumentRequestSchema } from '@mind-x/shared'
import { requireAuth } from '../../middleware/auth'
import { validateBody } from '../../middleware/validate'
import { createProject, getDocument, getProjects, removeProject, renameProject, saveDocument } from './projects.service'

export function createProjectsRouter(): Router {
  const router = new Router({ prefix: '/projects' })

  router.use(requireAuth)

  router.get('/', async (ctx) => {
    ctx.body = { projects: await getProjects(ctx.state.user.id) }
  })

  router.post('/', validateBody(createProjectRequestSchema), async (ctx) => {
    ctx.status = 201
    ctx.body = { project: await createProject(ctx.state.user.id, ctx.request.body.name) }
  })

  router.patch('/:id', validateBody(renameProjectRequestSchema), async (ctx) => {
    ctx.body = { project: await renameProject(ctx.state.user.id, ctx.params.id, ctx.request.body.name) }
  })

  router.delete('/:id', async (ctx) => {
    await removeProject(ctx.state.user.id, ctx.params.id)
    ctx.status = 204
  })

  router.get('/:id/document', async (ctx) => {
    ctx.body = { document: await getDocument(ctx.state.user.id, ctx.params.id) }
  })

  router.put('/:id/document', validateBody(saveDocumentRequestSchema), async (ctx) => {
    ctx.body = { document: await saveDocument(ctx.state.user.id, ctx.params.id, ctx.request.body.document) }
  })

  return router
}
```

Update `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/api/src/routes.ts`:

```ts
import Router from '@koa/router'
import { createAuthRouter } from './modules/auth/auth.routes'
import { createProjectsRouter } from './modules/projects/projects.routes'

export function createApiRouter(): Router {
  const router = new Router({ prefix: '/api' })
  const authRouter = createAuthRouter()
  const projectsRouter = createProjectsRouter()

  router.use(authRouter.routes())
  router.use(authRouter.allowedMethods())
  router.use(projectsRouter.routes())
  router.use(projectsRouter.allowedMethods())

  return router
}
```

- [ ] **Step 5: Run project API tests and typecheck**

Run:

```bash
npm run test -w apps/api -- src/modules/projects/projects.test.ts
npm run typecheck -w apps/api
```

Expected: both commands PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/api
git commit -m "feat(api): add project document APIs"
```

## Task 8: Web App Shell, Router, and API Client

**Files:**
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/package.json`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/tsconfig.json`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/vite.config.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/index.html`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/main.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/App.vue`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/router/index.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/api/client.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/stores/auth.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/styles/global.css`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/views/LoginView.vue`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/views/ProjectsView.vue`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/views/EditorView.vue`

- [ ] **Step 1: Create web package metadata**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/package.json`:

```json
{
  "name": "@mind-x/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0 --port 5173",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "vue-tsc -b",
    "test": "vitest run src"
  },
  "dependencies": {
    "@mind-x/mind-engine": "0.1.0",
    "@mind-x/shared": "0.1.0",
    "ant-design-vue": "^4.2.6",
    "axios": "^1.7.9",
    "d3-selection": "^3.0.0",
    "d3-zoom": "^3.0.0",
    "html2canvas": "^1.4.1",
    "localforage": "^1.10.0",
    "pinia": "^2.2.6",
    "vue": "^3.5.13",
    "vue-router": "^4.5.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.2.1",
    "@vue/tsconfig": "^0.7.0",
    "vite": "^6.0.3",
    "vue-tsc": "^2.1.10"
  }
}
```

- [ ] **Step 2: Create Vite and TypeScript files**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["vite/client"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "vite.config.ts"]
}
```

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/vite.config.ts`:

```ts
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3000'
    }
  }
})
```

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>mind-x</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 3: Implement API client and auth store**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/api/client.ts`:

```ts
import axios from 'axios'

export const apiClient = axios.create({
  baseURL: '/api'
})

apiClient.interceptors.request.use((config) => {
  const token = window.localStorage.getItem('mind-x-token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
```

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/stores/auth.ts`:

```ts
import { defineStore } from 'pinia'
import type { LoginResponse, UserDto } from '@mind-x/shared'
import { apiClient } from '@/api/client'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: window.localStorage.getItem('mind-x-token') as string | null,
    user: null as UserDto | null,
    loading: false,
    error: null as string | null
  }),
  actions: {
    async login(username: string, password: string) {
      this.loading = true
      this.error = null
      try {
        const response = await apiClient.post<LoginResponse>('/auth/login', { username, password })
        this.token = response.data.token
        this.user = response.data.user
        window.localStorage.setItem('mind-x-token', response.data.token)
      } catch {
        this.error = 'Invalid username or password'
        throw new Error(this.error)
      } finally {
        this.loading = false
      }
    },
    logout() {
      this.token = null
      this.user = null
      window.localStorage.removeItem('mind-x-token')
    }
  }
})
```

- [ ] **Step 4: Implement router, app, and login view**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/router/index.ts`:

```ts
import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import LoginView from '@/views/LoginView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView },
    { path: '/', redirect: '/projects' },
    { path: '/projects', name: 'projects', component: () => import('@/views/ProjectsView.vue'), meta: { requiresAuth: true } },
    { path: '/projects/:id', name: 'editor', component: () => import('@/views/EditorView.vue'), meta: { requiresAuth: true } }
  ]
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.token) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  return true
})
```

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/main.ts`:

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import './styles/global.css'
import App from './App.vue'
import { router } from './router'

createApp(App).use(createPinia()).use(router).use(Antd).mount('#app')
```

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/App.vue`:

```vue
<template>
  <router-view />
</template>
```

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/styles/global.css`:

```css
html,
body,
#app {
  width: 100%;
  height: 100%;
  margin: 0;
}

body {
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #f6f7f9;
  color: #1f2328;
}
```

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/views/LoginView.vue`:

```vue
<script setup lang="ts">
import { reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const form = reactive({
  username: 'blank',
  password: '123456'
})

async function submit() {
  try {
    await auth.login(form.username, form.password)
    await router.push((route.query.redirect as string) || '/projects')
  } catch {
    message.error(auth.error || 'Login failed')
  }
}
</script>

<template>
  <main class="login-view">
    <section class="login-panel">
      <h1>mind-x</h1>
      <a-form layout="vertical" :model="form" @finish="submit">
        <a-form-item label="Username" name="username" :rules="[{ required: true, message: 'Username is required' }]">
          <a-input v-model:value="form.username" />
        </a-form-item>
        <a-form-item label="Password" name="password" :rules="[{ required: true, message: 'Password is required' }]">
          <a-input-password v-model:value="form.password" />
        </a-form-item>
        <a-button type="primary" html-type="submit" block :loading="auth.loading">Log in</a-button>
      </a-form>
    </section>
  </main>
</template>

<style scoped>
.login-view {
  min-height: 100%;
  display: grid;
  place-items: center;
  padding: 24px;
}

.login-panel {
  width: min(360px, 100%);
  padding: 28px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

h1 {
  margin: 0 0 24px;
  font-size: 28px;
}
</style>
```

- [ ] **Step 5: Create protected route targets**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/views/ProjectsView.vue`:

```vue
<template>
  <main class="projects-view">
    <p>Projects loading...</p>
  </main>
</template>

<style scoped>
.projects-view {
  padding: 24px;
}
</style>
```

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/views/EditorView.vue`:

```vue
<template>
  <main class="editor-view">
    <router-link to="/projects">Back to projects</router-link>
    <p>Editor loading...</p>
  </main>
</template>

<style scoped>
.editor-view {
  padding: 24px;
}
</style>
```

- [ ] **Step 6: Install and typecheck web**

Run:

```bash
npm install
npm run typecheck -w apps/web
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add package.json package-lock.json apps/web
git commit -m "feat(web): add app shell and login flow"
```

## Task 9: Project Center Frontend

**Files:**
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/stores/projects.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/services/crossTab.ts`
- Modify: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/views/ProjectsView.vue`

- [ ] **Step 1: Implement project store**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/stores/projects.ts`:

```ts
import { defineStore } from 'pinia'
import type { ProjectSummaryDto } from '@mind-x/shared'
import { apiClient } from '@/api/client'

export const useProjectsStore = defineStore('projects', {
  state: () => ({
    projects: [] as ProjectSummaryDto[],
    loading: false
  }),
  actions: {
    async fetchProjects() {
      this.loading = true
      try {
        const response = await apiClient.get<{ projects: ProjectSummaryDto[] }>('/projects')
        this.projects = response.data.projects
      } finally {
        this.loading = false
      }
    },
    async createProject(name: string) {
      const response = await apiClient.post<{ project: ProjectSummaryDto }>('/projects', { name })
      this.projects.unshift(response.data.project)
      return response.data.project
    },
    async renameProject(id: string, name: string) {
      const response = await apiClient.patch<{ project: ProjectSummaryDto }>(`/projects/${id}`, { name })
      this.projects = this.projects.map((project) => (project.id === id ? response.data.project : project))
      return response.data.project
    },
    async deleteProject(id: string) {
      await apiClient.delete(`/projects/${id}`)
      this.projects = this.projects.filter((project) => project.id !== id)
    }
  }
})
```

- [ ] **Step 2: Implement cross-tab service**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/services/crossTab.ts`:

```ts
export type CrossTabEvent =
  | { type: 'projects:refresh' }
  | { type: 'project:renamed'; projectId: string; name: string }
  | { type: 'project:deleted'; projectId: string }

const channel = new BroadcastChannel('mind-x')

export function publishCrossTabEvent(event: CrossTabEvent): void {
  channel.postMessage(event)
}

export function subscribeCrossTabEvents(handler: (event: CrossTabEvent) => void): () => void {
  const listener = (message: MessageEvent<CrossTabEvent>) => handler(message.data)
  channel.addEventListener('message', listener)
  return () => channel.removeEventListener('message', listener)
}
```

- [ ] **Step 3: Implement projects view**

Replace `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/views/ProjectsView.vue` with:

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import { useProjectsStore } from '@/stores/projects'
import { publishCrossTabEvent, subscribeCrossTabEvents } from '@/services/crossTab'

const router = useRouter()
const projectsStore = useProjectsStore()
const newName = ref('Untitled Mind Map')
let unsubscribeCrossTab: (() => void) | null = null

onMounted(async () => {
  await projectsStore.fetchProjects()
  unsubscribeCrossTab = subscribeCrossTabEvents(async (event) => {
    if (event.type === 'projects:refresh') {
      await projectsStore.fetchProjects()
    }
  })
})

onUnmounted(() => unsubscribeCrossTab?.())

async function createProject() {
  const project = await projectsStore.createProject(newName.value)
  publishCrossTabEvent({ type: 'projects:refresh' })
  await router.push(`/projects/${project.id}`)
}

async function renameProject(id: string, currentName: string) {
  const nextName = window.prompt('Project name', currentName)?.trim()
  if (!nextName) return
  const project = await projectsStore.renameProject(id, nextName)
  publishCrossTabEvent({ type: 'project:renamed', projectId: id, name: project.name })
  message.success('Project renamed')
}

async function deleteProject(id: string) {
  Modal.confirm({
    title: 'Delete project',
    content: 'This project will be removed.',
    okType: 'danger',
    async onOk() {
      await projectsStore.deleteProject(id)
      publishCrossTabEvent({ type: 'project:deleted', projectId: id })
      message.success('Project deleted')
    }
  })
}
</script>

<template>
  <main class="projects-view">
    <header class="projects-header">
      <h1>My Projects</h1>
      <div class="create-row">
        <a-input v-model:value="newName" />
        <a-button type="primary" @click="createProject">New</a-button>
      </div>
    </header>

    <a-spin :spinning="projectsStore.loading">
      <section class="project-grid">
        <a-card v-for="project in projectsStore.projects" :key="project.id" class="project-card" @click="router.push(`/projects/${project.id}`)">
          <template #title>{{ project.name }}</template>
          <template #extra>
            <a-space @click.stop>
              <a-button size="small" @click="renameProject(project.id, project.name)">Rename</a-button>
              <a-button size="small" danger @click="deleteProject(project.id)">Delete</a-button>
            </a-space>
          </template>
          <p>Updated {{ new Date(project.updatedAt).toLocaleString() }}</p>
        </a-card>
      </section>
    </a-spin>
  </main>
</template>

<style scoped>
.projects-view {
  padding: 24px;
}

.projects-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.create-row {
  display: flex;
  gap: 8px;
  width: min(420px, 100%);
}

.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.project-card {
  cursor: pointer;
}
</style>
```

- [ ] **Step 4: Run web typecheck**

Run:

```bash
npm run typecheck -w apps/web
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/web
git commit -m "feat(web): add project center"
```

## Task 10: Editor Store and Renderers

**Files:**
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/stores/editor.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/components/editor/MindEditor.vue`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/components/editor/ViewportPane.vue`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/components/editor/NodeRenderer.vue`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/components/editor/TopicNode.vue`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/components/editor/EdgeRenderer.vue`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/components/editor/SelectionLayer.vue`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/components/editor/EditorToolbar.vue`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/components/editor/EditorContextMenu.vue`
- Modify: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/views/EditorView.vue`

- [ ] **Step 1: Implement editor store**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/stores/editor.ts`:

```ts
import { defineStore } from 'pinia'
import type { MindDocument, Point, Viewport } from '@mind-x/shared'
import { addChildNode, createHistory, deleteNodePromoteChildren, editNodeTitle, moveNodes } from '@mind-x/mind-engine'

export const useEditorStore = defineStore('editor', {
  state: () => ({
    document: null as MindDocument | null,
    selectedNodeIds: [] as string[],
    dirty: false,
    history: null as ReturnType<typeof createHistory<MindDocument>> | null
  }),
  actions: {
    load(document: MindDocument) {
      this.document = document
      this.selectedNodeIds = []
      this.dirty = false
      this.history = createHistory(document)
    },
    commit(document: MindDocument) {
      this.document = document
      this.history?.push(document)
      this.dirty = true
    },
    selectOnly(nodeId: string) {
      this.selectedNodeIds = [nodeId]
    },
    setSelection(nodeIds: string[]) {
      this.selectedNodeIds = nodeIds
    },
    addChild(parentId: string) {
      if (!this.document) return
      this.commit(addChildNode(this.document, { parentId, id: crypto.randomUUID(), title: 'New Topic' }))
    },
    editTitle(nodeId: string, title: string) {
      if (!this.document) return
      this.commit(editNodeTitle(this.document, { nodeId, title }))
    },
    deleteSelected() {
      if (!this.document) return
      let next = this.document
      for (const nodeId of this.selectedNodeIds) {
        next = deleteNodePromoteChildren(next, { nodeId })
      }
      this.commit(next)
      this.selectedNodeIds = []
    },
    moveSelected(delta: Point) {
      if (!this.document || this.selectedNodeIds.length === 0) return
      this.commit(moveNodes(this.document, { nodeIds: this.selectedNodeIds, delta }))
    },
    setViewport(viewport: Viewport) {
      if (!this.document) return
      this.document = { ...this.document, viewport }
      this.dirty = true
    },
    undo() {
      const previous = this.history?.undo()
      if (previous) {
        this.document = previous
        this.dirty = true
      }
    },
    redo() {
      const next = this.history?.redo()
      if (next) {
        this.document = next
        this.dirty = true
      }
    }
  }
})
```

- [ ] **Step 2: Implement viewport pane**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/components/editor/ViewportPane.vue`:

```vue
<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type D3ZoomEvent } from 'd3-zoom'
import type { Viewport } from '@mind-x/shared'

const props = defineProps<{ viewport: Viewport }>()
const emit = defineEmits<{ viewportChange: [viewport: Viewport] }>()

const paneRef = ref<HTMLDivElement | null>(null)
const contentRef = ref<HTMLDivElement | null>(null)

onMounted(() => {
  if (!paneRef.value || !contentRef.value) return
  const behavior = zoom<HTMLDivElement, unknown>()
    .scaleExtent([0.2, 3])
    .on('zoom', (event: D3ZoomEvent<HTMLDivElement, unknown>) => {
      const viewport = { x: event.transform.x, y: event.transform.y, zoom: event.transform.k }
      emit('viewportChange', viewport)
    })

  const selection = select(paneRef.value)
  selection.call(behavior)
  selection.call(behavior.transform, zoomIdentity.translate(props.viewport.x, props.viewport.y).scale(props.viewport.zoom))
})

watch(
  () => props.viewport,
  (viewport) => {
    if (contentRef.value) {
      contentRef.value.style.transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`
    }
  },
  { immediate: true, deep: true }
)
</script>

<template>
  <div ref="paneRef" class="viewport-pane">
    <div ref="contentRef" class="viewport-content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.viewport-pane {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background-color: #f8fafc;
  background-image:
    linear-gradient(#e5e7eb 1px, transparent 1px),
    linear-gradient(90deg, #e5e7eb 1px, transparent 1px);
  background-size: 32px 32px;
}

.viewport-content {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
}
</style>
```

- [ ] **Step 3: Implement renderers**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/components/editor/TopicNode.vue`:

```vue
<script setup lang="ts">
import type { MindNode } from '@mind-x/shared'

defineProps<{ node: MindNode; selected: boolean }>()
const emit = defineEmits<{
  select: [nodeId: string]
  edit: [nodeId: string, title: string]
  drag: [nodeId: string, delta: { x: number; y: number }]
}>()

let lastPoint: { x: number; y: number } | null = null

function pointerDown(event: PointerEvent, nodeId: string) {
  emit('select', nodeId)
  lastPoint = { x: event.clientX, y: event.clientY }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function pointerMove(event: PointerEvent, nodeId: string) {
  if (!lastPoint) return
  const delta = { x: event.clientX - lastPoint.x, y: event.clientY - lastPoint.y }
  lastPoint = { x: event.clientX, y: event.clientY }
  emit('drag', nodeId, delta)
}

function pointerUp() {
  lastPoint = null
}
</script>

<template>
  <div
    class="topic-node"
    :class="{ selected }"
    :style="{ transform: `translate(${node.position.x}px, ${node.position.y}px)` }"
    @pointerdown="pointerDown($event, node.id)"
    @pointermove="pointerMove($event, node.id)"
    @pointerup="pointerUp"
    @dblclick="emit('edit', node.id, window.prompt('Topic title', node.data.title) || node.data.title)"
  >
    {{ node.data.title }}
  </div>
</template>

<style scoped>
.topic-node {
  position: absolute;
  min-width: 160px;
  max-width: 260px;
  padding: 10px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
  cursor: grab;
  user-select: none;
}

.topic-node.selected {
  border-color: #1677ff;
  box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.16);
}
</style>
```

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/components/editor/NodeRenderer.vue`:

```vue
<script setup lang="ts">
import type { MindDocument } from '@mind-x/shared'
import TopicNode from './TopicNode.vue'

defineProps<{ document: MindDocument; selectedNodeIds: string[] }>()
const emit = defineEmits<{
  select: [nodeId: string]
  edit: [nodeId: string, title: string]
  drag: [nodeId: string, delta: { x: number; y: number }]
}>()

function forwardEdit(nodeId: string, title: string) {
  emit('edit', nodeId, title)
}

function forwardDrag(nodeId: string, delta: { x: number; y: number }) {
  emit('drag', nodeId, delta)
}
</script>

<template>
  <TopicNode
    v-for="node in document.nodes"
    :key="node.id"
    :node="node"
    :selected="selectedNodeIds.includes(node.id)"
    @select="emit('select', $event)"
    @edit="forwardEdit"
    @drag="forwardDrag"
  />
</template>
```

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/components/editor/EdgeRenderer.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { MindDocument } from '@mind-x/shared'

const props = defineProps<{ document: MindDocument }>()

const paths = computed(() =>
  props.document.edges
    .map((edge) => {
      const source = props.document.nodes.find((node) => node.id === edge.source)
      const target = props.document.nodes.find((node) => node.id === edge.target)
      if (!source || !target) return null
      const sx = source.position.x + (source.size?.width ?? 160)
      const sy = source.position.y + (source.size?.height ?? 48) / 2
      const tx = target.position.x
      const ty = target.position.y + (target.size?.height ?? 48) / 2
      const mid = sx + (tx - sx) / 2
      return { id: edge.id, d: `M ${sx} ${sy} C ${mid} ${sy}, ${mid} ${ty}, ${tx} ${ty}` }
    })
    .filter((path): path is { id: string; d: string } => Boolean(path))
)
</script>

<template>
  <svg class="edge-renderer">
    <path v-for="path in paths" :key="path.id" :d="path.d" fill="none" stroke="#94a3b8" stroke-width="2" />
  </svg>
</template>

<style scoped>
.edge-renderer {
  position: absolute;
  left: -10000px;
  top: -10000px;
  width: 20000px;
  height: 20000px;
  overflow: visible;
  pointer-events: none;
}
</style>
```

- [ ] **Step 4: Implement remaining editor components and view**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/components/editor/SelectionLayer.vue`:

```vue
<template>
  <div class="selection-layer"></div>
</template>

<style scoped>
.selection-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
</style>
```

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/components/editor/EditorToolbar.vue`:

```vue
<script setup lang="ts">
defineProps<{ dirty: boolean }>()
const emit = defineEmits<{ save: []; undo: []; redo: []; addChild: [] }>()
</script>

<template>
  <div class="editor-toolbar">
    <a-space>
      <a-button @click="emit('addChild')">Add child</a-button>
      <a-button @click="emit('undo')">Undo</a-button>
      <a-button @click="emit('redo')">Redo</a-button>
      <a-button type="primary" @click="emit('save')">{{ dirty ? 'Save *' : 'Save' }}</a-button>
    </a-space>
  </div>
</template>

<style scoped>
.editor-toolbar {
  position: absolute;
  z-index: 5;
  top: 12px;
  left: 12px;
  padding: 8px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}
</style>
```

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/components/editor/EditorContextMenu.vue`:

```vue
<template>
  <div class="editor-context-menu" hidden></div>
</template>
```

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/components/editor/MindEditor.vue`:

```vue
<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import ViewportPane from './ViewportPane.vue'
import NodeRenderer from './NodeRenderer.vue'
import EdgeRenderer from './EdgeRenderer.vue'
import EditorToolbar from './EditorToolbar.vue'
import { useEditorStore } from '@/stores/editor'

const emit = defineEmits<{ save: [] }>()
const editor = useEditorStore()
const document = computed(() => editor.document)

function keydown(event: KeyboardEvent) {
  if (!document.value) return
  const mod = event.ctrlKey || event.metaKey
  if (event.key === 'Tab') {
    event.preventDefault()
    const selected = editor.selectedNodeIds[0]
    if (selected) editor.addChild(selected)
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    editor.deleteSelected()
  }
  if (mod && event.key.toLowerCase() === 's') {
    event.preventDefault()
    emit('save')
  }
  if (mod && event.key.toLowerCase() === 'z' && !event.shiftKey) {
    event.preventDefault()
    editor.undo()
  }
  if ((mod && event.key.toLowerCase() === 'y') || (mod && event.shiftKey && event.key.toLowerCase() === 'z')) {
    event.preventDefault()
    editor.redo()
  }
}

onMounted(() => window.addEventListener('keydown', keydown))
onUnmounted(() => window.removeEventListener('keydown', keydown))
</script>

<template>
  <section class="mind-editor">
    <EditorToolbar
      :dirty="editor.dirty"
      @save="emit('save')"
      @undo="editor.undo"
      @redo="editor.redo"
      @add-child="editor.selectedNodeIds[0] && editor.addChild(editor.selectedNodeIds[0])"
    />
    <ViewportPane v-if="document" :viewport="document.viewport" @viewport-change="editor.setViewport">
      <EdgeRenderer :document="document" />
      <NodeRenderer
        :document="document"
        :selected-node-ids="editor.selectedNodeIds"
        @select="editor.selectOnly"
        @edit="editor.editTitle"
        @drag="editor.moveSelected"
      />
    </ViewportPane>
  </section>
</template>

<style scoped>
.mind-editor {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
```

Update `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/views/EditorView.vue` in Task 11 after sync service exists.

- [ ] **Step 5: Run web typecheck**

Run:

```bash
npm run typecheck -w apps/web
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/web
git commit -m "feat(web): add mind editor renderers"
```

## Task 11: Save, Load, Local Drafts, Cross-Tab Sync, and PNG Export

**Files:**
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/services/syncService.ts`
- Create: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/services/exportPng.ts`
- Modify: `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/views/EditorView.vue`

- [ ] **Step 1: Implement sync service**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/services/syncService.ts`:

```ts
import localforage from 'localforage'
import type { MindDocument } from '@mind-x/shared'
import { apiClient } from '@/api/client'

const draftStore = localforage.createInstance({
  name: 'mind-x',
  storeName: 'pending_drafts'
})

export async function loadServerDocument(projectId: string): Promise<MindDocument> {
  const response = await apiClient.get<{ document: MindDocument }>(`/projects/${projectId}/document`)
  return response.data.document
}

export async function saveServerDocument(projectId: string, document: MindDocument): Promise<MindDocument> {
  const response = await apiClient.put<{ document: MindDocument }>(`/projects/${projectId}/document`, { document })
  await draftStore.removeItem(projectId)
  return response.data.document
}

export async function saveLocalDraft(projectId: string, document: MindDocument): Promise<void> {
  await draftStore.setItem(projectId, { document, savedAt: new Date().toISOString() })
}

export async function getLocalDraft(projectId: string): Promise<{ document: MindDocument; savedAt: string } | null> {
  return draftStore.getItem(projectId)
}
```

- [ ] **Step 2: Implement PNG export**

Create `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/services/exportPng.ts`:

```ts
import html2canvas from 'html2canvas'
import type { MindDocument } from '@mind-x/shared'

export async function exportMindMapPng(root: HTMLElement, document: MindDocument): Promise<void> {
  if (document.nodes.length === 0) {
    return
  }

  const padding = 48
  const bounds = document.nodes.reduce(
    (acc, node) => {
      const width = node.size?.width ?? 160
      const height = node.size?.height ?? 48
      return {
        minX: Math.min(acc.minX, node.position.x),
        minY: Math.min(acc.minY, node.position.y),
        maxX: Math.max(acc.maxX, node.position.x + width),
        maxY: Math.max(acc.maxY, node.position.y + height)
      }
    },
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  )

  const canvas = await html2canvas(root, {
    x: bounds.minX - padding,
    y: bounds.minY - padding,
    width: bounds.maxX - bounds.minX + padding * 2,
    height: bounds.maxY - bounds.minY + padding * 2,
    backgroundColor: '#ffffff',
    scale: 2
  })

  const url = canvas.toDataURL('image/png')
  const link = window.document.createElement('a')
  link.href = url
  link.download = `${document.meta.title}.png`
  link.click()
}
```

- [ ] **Step 3: Wire editor view**

Replace `/Users/blank/code/mind-x-sp/mind-x-refactor/apps/web/src/views/EditorView.vue` with:

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import MindEditor from '@/components/editor/MindEditor.vue'
import { useEditorStore } from '@/stores/editor'
import { getLocalDraft, loadServerDocument, saveLocalDraft, saveServerDocument } from '@/services/syncService'
import { subscribeCrossTabEvents } from '@/services/crossTab'

const route = useRoute()
const router = useRouter()
const editor = useEditorStore()
const projectId = route.params.id as string
const unsubscribe = ref<(() => void) | null>(null)

async function load() {
  const serverDocument = await loadServerDocument(projectId)
  const draft = await getLocalDraft(projectId)
  editor.load(draft?.document ?? serverDocument)
  if (draft) {
    message.warning('Loaded a local draft from this browser')
  }
}

async function save() {
  if (!editor.document) return
  try {
    const saved = await saveServerDocument(projectId, editor.document)
    editor.load(saved)
    message.success('Saved')
  } catch {
    await saveLocalDraft(projectId, editor.document)
    message.warning('Server unavailable. Saved locally in this browser.')
  }
}

onMounted(async () => {
  await load()
  unsubscribe.value = subscribeCrossTabEvents(async (event) => {
    if (event.type === 'project:deleted' && event.projectId === projectId) {
      message.warning('This project was deleted in another tab')
      await router.push('/projects')
    }
    if (event.type === 'project:renamed' && event.projectId === projectId && editor.document) {
      editor.document.meta.title = event.name
    }
  })
})

onUnmounted(() => unsubscribe.value?.())
</script>

<template>
  <MindEditor @save="save" />
</template>
```

- [ ] **Step 4: Run typecheck and build**

Run:

```bash
npm run typecheck -w apps/web
npm run build -w apps/web
```

Expected: both commands PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/web
git commit -m "feat(web): add document sync and export"
```

## Task 12: Final Verification and Documentation

**Files:**
- Modify: `/Users/blank/code/mind-x-sp/mind-x-refactor/README.md`

- [ ] **Step 1: Update README with verified commands**

Replace `/Users/blank/code/mind-x-sp/mind-x-refactor/README.md` with:

````markdown
# mind-x-refactor

mind-x 2.0 core refactor.

## Stack

- Vue 3 + Vite + TypeScript frontend
- Koa + TypeScript API
- MySQL 8 database
- Self-owned mind map engine
- `d3-zoom` for viewport pan and zoom

## Start

```bash
npm install
docker compose -f docker/docker-compose.yml up -d
npm run db:seed -w apps/api
npm run dev:api
npm run dev:web
```

Open `http://localhost:5173`.

Seed accounts:

- `blank / 123456`
- `admin / admin`

## Verify

```bash
npm run typecheck
npm test
npm run build
```

## Product Scope

This app supports login, project list, project create/rename/delete, mind map editing, manual save, local draft fallback, cross-tab project events, and PNG export.
````

- [ ] **Step 2: Run full verification**

Run:

```bash
docker compose -f docker/docker-compose.yml up -d
npm run db:seed -w apps/api
npm run typecheck
npm test
npm run build
```

Expected:

```text
typecheck: all workspace typechecks pass
test: shared, mind-engine, and api tests pass
build: api, shared, mind-engine, and web builds pass
```

- [ ] **Step 3: Manual smoke test**

Run:

```bash
npm run dev:api
```

In a second terminal:

```bash
npm run dev:web
```

Open `http://localhost:5173` and verify:

```text
1. Login with blank / 123456.
2. Create a project.
3. Open the editor.
4. Select the root node or create the first topic.
5. Add a child with the toolbar or Tab.
6. Edit a title.
7. Drag a node.
8. Save.
9. Refresh the browser and confirm the document reloads.
10. Rename the project from the project center.
11. Delete a project and confirm the editor tab reacts.
```

- [ ] **Step 4: Commit**

Run:

```bash
git add README.md
git commit -m "docs: add mind-x refactor verification guide"
```
