# Mind Document Migration Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Narrow `migrateMindDocument` usage to historical/external read boundaries and make all new document saves v2-only.

**Architecture:** `@mind-x/shared` keeps both the migratable read helper and the strict v2 schema, but save request validation switches to v2 only. API storage reads and web read/response parsing remain migration boundaries; API service saves and web save inputs stop re-normalizing already-typed v2 documents.

**Tech Stack:** TypeScript, Zod, Vitest, Koa, Vue service layer, npm workspaces.

---

## File Structure

- Modify `packages/shared/src/api.ts`: make `saveDocumentRequestSchema.document` validate with `mindDocumentSchema`.
- Modify `packages/shared/src/document.test.ts`: keep direct migration tests, change save request tests to accept v2 and reject v1.
- Modify `apps/api/src/modules/projects/projects.service.ts`: remove redundant save-time migration and operate on the v2 `document` argument.
- Modify `apps/api/src/modules/projects/projects.test.ts`: change the v1 PUT route behavior from normalization to validation rejection while keeping DB read migration coverage.
- Modify `apps/web/src/services/syncService.ts`: remove input migration from save paths while keeping migration for server responses and local draft reads.
- Modify `apps/web/src/services/syncService.test.ts`: prove save paths pass through their input documents and read paths still migrate legacy data.

## Task 1: Shared Save Request Schema Is V2-Only

**Files:**
- Modify: `packages/shared/src/api.ts`
- Modify: `packages/shared/src/document.test.ts`

- [ ] **Step 1: Replace the shared save request tests**

In `packages/shared/src/document.test.ts`, replace the current test named `migrates save document request bodies to v2` with these two tests:

```ts
  it('accepts v2 save document request bodies', () => {
    const document = v2Document()
    const parsed = saveDocumentRequestSchema.parse({ document })

    expect(parsed.document).toEqual(mindDocumentV2Schema.parse(document))
  })

  it('rejects v1 save document request bodies', () => {
    const result = saveDocumentRequestSchema.safeParse({ document: v1Document() })

    expect(result.success).toBe(false)
  })
```

- [ ] **Step 2: Run the shared document tests and verify the new rejection fails**

Run:

```bash
npm test -- packages/shared/src/document.test.ts
```

Expected: FAIL on `rejects v1 save document request bodies`, because `saveDocumentRequestSchema` still accepts migratable v1 input.

- [ ] **Step 3: Change `saveDocumentRequestSchema` to use the v2 document schema**

In `packages/shared/src/api.ts`, replace the document import:

```ts
import { createPlainTextSchema, migratableMindDocumentSchema } from './document.js'
```

with:

```ts
import { createPlainTextSchema, mindDocumentSchema } from './document.js'
```

Then replace:

```ts
export const saveDocumentRequestSchema = z.object({
  document: migratableMindDocumentSchema
})
```

with:

```ts
export const saveDocumentRequestSchema = z.object({
  document: mindDocumentSchema
})
```

- [ ] **Step 4: Run the shared document tests and verify they pass**

Run:

```bash
npm test -- packages/shared/src/document.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the shared schema change**

Run:

```bash
git add packages/shared/src/api.ts packages/shared/src/document.test.ts
git commit -m "refactor(shared): require v2 document save payloads"
```

Expected: commit succeeds.

## Task 2: API Save Path Stops Migrating Input

**Files:**
- Modify: `apps/api/src/modules/projects/projects.test.ts`
- Modify: `apps/api/src/modules/projects/projects.service.ts`

- [ ] **Step 1: Replace the v1 PUT normalization route test**

In `apps/api/src/modules/projects/projects.test.ts`, replace the test named `normalizes legacy v1 document saves and loads to v2` with:

```ts
  it('rejects legacy v1 document saves', async () => {
    installProjectStore()
    const headers = authHeaders()
    const createResponse = await requestApp('/api/projects', {
      body: { name: 'Legacy' },
      headers,
      method: 'POST'
    })
    const projectId = (createResponse.body as { project: { id: string } }).project.id
    const legacy = legacyDocument(projectId)

    await expect(
      requestApp(`/api/projects/${projectId}/document`, {
        body: { document: legacy },
        headers,
        method: 'PUT'
      })
    ).resolves.toMatchObject({
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed'
        }
      },
      status: 422
    })

    const loadResponse = await requestApp(`/api/projects/${projectId}/document`, { headers })
    expect(loadResponse.status).toBe(200)
    const loaded = (loadResponse.body as { document: MindDocument }).document
    expect(loaded.version).toBe(2)
    expect(loaded.meta.projectId).toBe(projectId)
    expect(loaded.meta.title).toBe('Legacy')
    expect(loaded.nodes).toEqual([])
    expect(loaded.edges).toEqual([])
  })
```

- [ ] **Step 2: Run the API project tests**

Run:

```bash
npm test -- apps/api/src/modules/projects/projects.test.ts
```

Expected: PASS after Task 1, because route request validation now rejects v1 PUT payloads.

- [ ] **Step 3: Verify the redundant API service migration still exists**

Run:

```bash
rg -n "migrateMindDocument" apps/api/src/modules/projects/projects.service.ts
```

Expected: one or more matches in `projects.service.ts`, proving the service still has redundant migration code to remove.

- [ ] **Step 4: Remove save-time migration from the API service**

In `apps/api/src/modules/projects/projects.service.ts`, replace:

```ts
import { migrateMindDocument, type MindDocument, type ProjectSummaryDto } from '@mind-x/shared'
```

with:

```ts
import type { MindDocument, ProjectSummaryDto } from '@mind-x/shared'
```

Then replace the full `saveDocument` function with:

```ts
export async function saveDocument(userId: string, projectId: string, document: MindDocument): Promise<MindDocument> {
  if (document.meta.projectId !== projectId) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Document projectId must match route project id')
  }

  const existingProject = await findProjectSummary(userId, projectId)
  if (existingProject === null) {
    throw projectNotFoundError()
  }

  try {
    assertMindTree(document)
  } catch (error) {
    if (error instanceof Error) {
      throw new HttpError(422, 'VALIDATION_ERROR', 'Document graph is invalid')
    }
    throw error
  }

  const affectedRows = await updateProjectDocument({ document, projectId, userId })
  if (affectedRows === 0) {
    const project = await findProjectSummary(userId, projectId)
    if (project === null) {
      throw projectNotFoundError()
    }
  }

  return document
}
```

- [ ] **Step 5: Run the API project tests again**

Run:

```bash
npm test -- apps/api/src/modules/projects/projects.test.ts
```

Expected: PASS.

- [ ] **Step 6: Verify API migration remains only in the repository read boundary**

Run:

```bash
rg -n "migrateMindDocument" apps/api/src/modules/projects
```

Expected output contains only these repository matches:

```text
apps/api/src/modules/projects/projects.repository.ts:2:import { migrateMindDocument, type MindDocument } from '@mind-x/shared'
apps/api/src/modules/projects/projects.repository.ts:153:    return migrateMindDocument(parsed)
```

Line numbers can shift, but no match should remain in `projects.service.ts`.

- [ ] **Step 7: Commit the API boundary change**

Run:

```bash
git add apps/api/src/modules/projects/projects.service.ts apps/api/src/modules/projects/projects.test.ts
git commit -m "refactor(api): keep document migration at read boundary"
```

Expected: commit succeeds.

## Task 3: Web Save Paths Stop Migrating Input

**Files:**
- Modify: `apps/web/src/services/syncService.test.ts`
- Modify: `apps/web/src/services/syncService.ts`

- [ ] **Step 1: Replace the server save legacy migration test**

In `apps/web/src/services/syncService.test.ts`, replace the test named `migrates legacy documents before saving to the server` with:

```ts
  it('sends save requests without migrating legacy-shaped runtime input', async () => {
    const legacy = legacyDocument('project/one')
    const savedDocument = document({ meta: { ...document().meta, title: 'Saved' } })
    mockedApiClient.put.mockResolvedValueOnce({ data: { document: savedDocument } })
    const { saveServerDocument } = await import('./syncService')

    await expect(saveServerDocument('project/one', legacy as any)).resolves.toEqual(savedDocument)

    expect(mockedApiClient.put).toHaveBeenCalledWith('/projects/project%2Fone/document', { document: legacy })
  })
```

- [ ] **Step 2: Replace the local draft legacy save migration test**

In `apps/web/src/services/syncService.test.ts`, replace the test named `migrates legacy documents before saving local drafts` with:

```ts
  it('stores local drafts without migrating legacy-shaped runtime input', async () => {
    const legacy = legacyDocument('project/one')
    const { saveLocalDraft } = await import('./syncService')

    const draft = await saveLocalDraft('project/one', legacy as any)

    expect(localForageMock.store.setItem).toHaveBeenCalledWith('project/one', {
      document: legacy,
      savedAt: expect.any(String)
    })
    expect(draft.document).toBe(legacy)
  })
```

- [ ] **Step 3: Run the web sync tests and verify the new pass-through tests fail**

Run:

```bash
npm test -- apps/web/src/services/syncService.test.ts
```

Expected: FAIL in the two new tests because `saveServerDocument` and `saveLocalDraft` still migrate input documents.

- [ ] **Step 4: Remove input migration from server saves**

In `apps/web/src/services/syncService.ts`, replace:

```ts
export async function saveServerDocument(projectId: string, document: MindDocument): Promise<MindDocument> {
  const validDocument = migrateMindDocument(document)
  const { data } = await apiClient.put<DocumentResponse>(documentUrl(projectId), { document: validDocument })
  const savedDocument = migrateMindDocument(data.document)
  await clearLocalDraftBestEffort(projectId, 'Unable to clear local draft after server save')
  return savedDocument
}
```

with:

```ts
export async function saveServerDocument(projectId: string, document: MindDocument): Promise<MindDocument> {
  const { data } = await apiClient.put<DocumentResponse>(documentUrl(projectId), { document })
  const savedDocument = migrateMindDocument(data.document)
  await clearLocalDraftBestEffort(projectId, 'Unable to clear local draft after server save')
  return savedDocument
}
```

- [ ] **Step 5: Remove input migration from local draft saves**

In `apps/web/src/services/syncService.ts`, replace:

```ts
export async function saveLocalDraft(projectId: string, document: MindDocument): Promise<LocalDraft> {
  const draft = {
    document: migrateMindDocument(document),
    savedAt: new Date().toISOString()
  }
  await draftsStore.setItem(projectId, draft)
  return draft
}
```

with:

```ts
export async function saveLocalDraft(projectId: string, document: MindDocument): Promise<LocalDraft> {
  const draft = {
    document,
    savedAt: new Date().toISOString()
  }
  await draftsStore.setItem(projectId, draft)
  return draft
}
```

- [ ] **Step 6: Run the web sync tests and verify they pass**

Run:

```bash
npm test -- apps/web/src/services/syncService.test.ts
```

Expected: PASS, including existing read-path tests `migrates legacy server documents when loading` and `migrates legacy local drafts when reading`.

- [ ] **Step 7: Verify web migration remains only on read/response paths**

Run:

```bash
rg -n "migrateMindDocument" apps/web/src/services/syncService.ts
```

Expected output contains migration for:

```text
import { migrateMindDocument, type MindDocument } from '@mind-x/shared'
return migrateMindDocument(data.document)
const savedDocument = migrateMindDocument(data.document)
document: migrateMindDocument(value.document)
```

Expected output does not contain migration of the `document` argument in `saveServerDocument` or `saveLocalDraft`.

- [ ] **Step 8: Commit the web boundary change**

Run:

```bash
git add apps/web/src/services/syncService.ts apps/web/src/services/syncService.test.ts
git commit -m "refactor(web): stop migrating document save inputs"
```

Expected: commit succeeds.

## Task 4: Boundary Acceptance Verification

**Files:**
- Inspect: `apps`
- Inspect: `packages`

- [ ] **Step 1: Verify migration usage across apps and packages**

Run:

```bash
rg -n "migrateMindDocument" apps packages -g '!*.test.ts'
```

Expected output contains only:

```text
apps/api/src/modules/projects/projects.repository.ts:2:import { migrateMindDocument, type MindDocument } from '@mind-x/shared'
apps/api/src/modules/projects/projects.repository.ts:<line>:    return migrateMindDocument(parsed)
apps/web/src/services/syncService.ts:1:import { migrateMindDocument, type MindDocument } from '@mind-x/shared'
apps/web/src/services/syncService.ts:<line>:  return migrateMindDocument(data.document)
apps/web/src/services/syncService.ts:<line>:  const savedDocument = migrateMindDocument(data.document)
apps/web/src/services/syncService.ts:<line>:      document: migrateMindDocument(value.document),
packages/shared/src/document.ts:<line>:export function migrateMindDocument(input: unknown): MindDocument {
```

`packages/shared/src/document.ts` can also show `migratableMindDocumentSchema` nearby if the search includes schema names. No matches should appear in `packages/shared/src/api.ts`, `apps/api/src/modules/projects/projects.service.ts`, or web save input code.

- [ ] **Step 2: Run focused tests for all touched areas**

Run:

```bash
npm test -- packages/shared/src/document.test.ts apps/api/src/modules/projects/projects.test.ts apps/web/src/services/syncService.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Inspect git history and working tree**

Run:

```bash
git log --oneline -5
git status --short
```

Expected: the last commits include the shared, API, and web refactor commits from this plan, and `git status --short` prints no tracked or untracked changes.
