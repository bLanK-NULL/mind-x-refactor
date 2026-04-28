# Mind Document Migration Boundary Design

## Context

`migrateMindDocument` was introduced to keep v1 persisted mind documents readable after the v2 object-style document contract landed. It currently appears in several entry points, including API storage reads, API saves, server response parsing, local draft persistence, and request validation.

That makes the compatibility layer too broad. Some calls protect true external or historical data boundaries, while others re-normalize documents that are already typed as current v2 `MindDocument`.

## Goal

Make v1 compatibility explicit and narrow:

- Keep v1 migration only at read boundaries that may encounter historical persisted data.
- Make all new writes v2-only.
- Keep internal editor, sync, service, repository write, and mind-engine code operating on v2 `MindDocument`.
- Preserve existing behavior for reading valid v1 DB rows, server documents, and local drafts.

## Non-Goals

- Do not write migrated v1 documents back to DB or local draft storage during reads.
- Do not add a background migration job.
- Do not preserve removed v1 fields such as `meta.theme`, edge `component`, or edge direction data.
- Do not rename `migrateMindDocument` in this change.

## Decisions

Use a boundary-centered contract.

`migrateMindDocument(input: unknown): MindDocument` remains the compatibility helper for data that can be historical, external, or untrusted. Normal v2 validation continues to use `mindDocumentSchema`.

New save requests stop accepting v1 documents. `saveDocumentRequestSchema` should validate `document` with `mindDocumentSchema` instead of `migratableMindDocumentSchema`. A v1 PUT body should fail request validation with the existing 422 validation response.

Read migration is not persisted back. If a v1 DB row, server response, or local draft is read successfully, callers receive a v2 document in memory. The original stored value remains unchanged until a normal v2 save happens.

## Component Changes

`@mind-x/shared`

- Keep `mindDocumentV1Schema`, `mindDocumentV2Schema`, `migratableMindDocumentSchema`, and `migrateMindDocument`.
- Keep `mindDocumentSchema` as the v2 schema.
- Change `saveDocumentRequestSchema.document` to use `mindDocumentSchema`.
- Update schema tests so save requests accept v2 and reject v1.

`apps/api`

- Keep repository read migration in `parseDocumentJson`, because DB JSON may contain historical v1 documents.
- Remove `migrateMindDocument` from `projects.service.saveDocument`; the route schema already guarantees v2 before service code runs.
- Keep `saveDocument` responsible for project id matching, project existence checks, graph validation via `assertMindTree`, and persistence.
- Keep repository write inputs typed as v2 `MindDocument`.

`apps/web`

- Keep migration in `loadServerDocument`, because server responses are external data.
- Keep migration in `getLocalDraft` parsing, because local draft storage may contain old v1 data or corrupt data.
- Remove migration from `saveServerDocument` before PUT. It should send the v2 `MindDocument` it receives and still validate the server response with `migrateMindDocument`.
- Remove migration from `saveLocalDraft`; it should persist the v2 `MindDocument` it receives.

`@mind-x/mind-engine` and editor store

- No migration logic is added.
- They continue to accept and produce v2 `MindDocument` only.

## Data Flow

Save flow:

```text
Editor store v2 document
  -> syncService.saveServerDocument(v2)
  -> PUT /projects/:id/document
  -> saveDocumentRequestSchema validates v2 only
  -> projects.service.saveDocument(v2)
  -> assertMindTree(v2)
  -> repository.updateProjectDocument(v2)
```

Read flow:

```text
DB JSON / server response / local draft value
  -> migrateMindDocument(unknown)
  -> v2 MindDocument
  -> editor store and mind-engine session
```

## Error Handling

Invalid PUT documents, including valid v1 documents, should fail request validation and return the existing 422 validation response.

Stored DB documents that cannot be parsed or migrated continue to throw `StoredProjectDocumentError`, which the service maps to the existing clean stored-document error response.

Corrupt local drafts continue to be cleared best-effort and return `null`.

Invalid server document responses continue to reject from the sync service parse step.

Graph-invalid v2 save payloads continue to pass schema validation but fail `assertMindTree` in the service with `Document graph is invalid`.

## Testing

Shared tests:

- Keep direct `migrateMindDocument` coverage for valid v1 to v2 migration.
- Keep direct v2 schema coverage.
- Change save request schema coverage so v2 is accepted and v1 is rejected.

API tests:

- Replace the current "normalizes legacy v1 document saves and loads to v2" route test with a PUT v1 rejection test.
- Keep repository coverage proving v1 JSON columns are migrated to v2 records on read.
- Keep route coverage for stored invalid document errors.
- Keep graph validation tests for malformed v2 graph documents.

Web sync tests:

- Keep "migrates legacy server documents when loading".
- Keep "migrates legacy local drafts when reading".
- Remove or rewrite tests that expect `saveServerDocument` or `saveLocalDraft` to accept v1 input.
- Keep saved server response validation, because the response remains external data.

## Acceptance Criteria

- `rg "migrateMindDocument" apps packages` shows migration only in shared definitions/tests, API repository read parsing, and web read/response parsing.
- PUT `/projects/:id/document` rejects a v1 document with validation error semantics.
- Reading a v1 DB document still returns v2 to API consumers.
- Reading a v1 local draft still returns v2 to the editor.
- Saving server documents and local drafts no longer migrates their input documents.
- Existing build, typecheck, and relevant tests pass.
