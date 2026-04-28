# Theme Object Style System Design

Date: 2026-04-28

Status: Approved for spec review

## Goal

Refactor the color and theme system so application theme and mind map object styles are separate concepts.

The application theme becomes a user preference. It controls app chrome, Ant Design Vue, canvas background, grid, panels, menus, and other global UI surfaces. It is stored locally and is no longer persisted in `MindDocument.meta`.

Mind map object styling becomes document content. Nodes and edges have explicit persisted `style` data, can be edited from the floating inspector, are saved with the document, and participate in undo and redo history.

This split keeps future edge color configuration and future non-text node types from depending on the app theme system.

## Chosen Approach

Use a shared-first v2 document style contract.

`@mind-x/shared` owns:

- v1 and v2 document schemas.
- v1 to v2 migration.
- object style token enums.
- default object style constants.
- exported v2 document and style types.

`@mind-x/mind-engine`, `apps/api`, and `apps/web` consume that shared contract instead of defining their own defaults or migration behavior.

## Core Decisions

- `MindDocument` upgrades from `version: 1` to `version: 2`.
- `MindDocument.meta.theme` is removed in v2.
- v1 `meta.theme` is discarded during migration.
- App theme remains a local UI preference and continues to use the current theme controller and `localStorage`.
- Nodes and edges have required explicit `style` fields in v2.
- Node style is defined per node type. The first supported type remains `topic`.
- Edge visual configuration moves into `edge.style`; v2 removes `edge.component`.
- v1 edge `component` values are not preserved during migration. All migrated edges receive the v2 default edge style.
- Object colors use built-in tokens instead of persisted hex values.
- Object-level style edits are undoable document edits.
- Future global or default style preferences are not undoable object edits.
- The existing floating inspector remains the object configuration surface.

## Object Color Tokens

The first object palette is fixed in code:

```ts
type ObjectColorToken =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'purple'
```

Documents store these stable tokens. Web rendering resolves tokens to concrete colors. The concrete colors are not persisted in the document.

## V2 Document Contract

`mindDocumentSchema` should point to the v2 schema for normal consumers.

Shared should also export:

```ts
mindDocumentV1Schema
mindDocumentV2Schema
migrateMindDocument(input: unknown): MindDocument
DEFAULT_TOPIC_STYLE
DEFAULT_EDGE_STYLE
OBJECT_COLOR_TOKENS
```

### V2 Meta

V2 metadata keeps document identity and audit fields, but drops theme:

```ts
type MindDocumentMeta = {
  projectId: string
  title: PlainText
  updatedAt: string
}
```

### Topic Node Style

The first node type remains `topic`. Topic style is explicit and tailored to text topic nodes.

```ts
type TopicNodeStyle = {
  colorToken: ObjectColorToken
  tone: 'soft' | 'solid' | 'outline'
  shape: 'rounded' | 'rectangle' | 'pill'
  size: 'sm' | 'md' | 'lg'
  borderStyle: 'none' | 'solid' | 'dashed'
  shadowLevel: 'none' | 'sm' | 'md'
  textWeight: 'regular' | 'medium' | 'bold'
}

type TopicNode = {
  id: string
  type: 'topic'
  position: Point
  size?: Size
  data: {
    title: PlainText
  }
  style: TopicNodeStyle
}
```

Future node types should define their own style schema instead of reusing `TopicNodeStyle` by default.

### Edge Style

Edge style replaces the current `component` field.

```ts
type EdgeStyle = {
  colorToken: ObjectColorToken
  linePattern: 'solid' | 'dashed' | 'dotted'
  arrow: 'none' | 'end'
  width: 'thin' | 'regular' | 'thick'
  routing: 'curved' | 'straight' | 'elbow'
  labelStyle: EdgeLabelStyle
  endpointStyle: EdgeEndpointStyle
  animation: EdgeAnimationStyle
}
```

The first UI exposes `colorToken`, `linePattern`, `arrow`, `width`, and `routing`.

`labelStyle`, `endpointStyle`, and `animation` are persisted schema fields with default values, but are not exposed in the first inspector UI. They reserve stable room for relationship labels, endpoint decoration, and visual motion without forcing those interaction designs into this phase.

The first nested shapes are intentionally minimal and default-driven:

```ts
type EdgeLabelStyle = {
  visible: false
}

type EdgeEndpointStyle = {
  source: 'none'
  target: 'none'
}

type EdgeAnimationStyle = {
  enabled: false
}
```

## Migration

`migrateMindDocument(input)` accepts unknown data and returns a validated v2 `MindDocument`.

Rules:

- If input is valid v2, return the parsed v2 document.
- If input is valid v1, convert it to v2.
- If input is neither valid v1 nor valid v2, throw the schema validation error.
- Set `version` to `2`.
- Preserve `meta.projectId`, `meta.title`, and `meta.updatedAt`.
- Drop `meta.theme`.
- Preserve `viewport`.
- Preserve node ids, type, positions, sizes, and data.
- Add `DEFAULT_TOPIC_STYLE` to every migrated topic node.
- Preserve edge ids, sources, targets, and type.
- Drop `edge.component`.
- Drop v1 edge direction data.
- Add `DEFAULT_EDGE_STYLE` to every migrated edge.

Migrated documents save back as v2 only.

## Package Responsibilities

### Shared

`@mind-x/shared` is the source of truth for document shape and object style contracts.

It defines all schemas, exported types, default style constants, object token arrays, and migration helpers. Tests in shared should cover valid v1, valid v2, migration, invalid tokens, and invalid future style fields.

### Mind Engine

`@mind-x/mind-engine` only accepts v2 documents.

Creation commands write explicit styles:

- `addRootNodeCommand` creates a topic node with `DEFAULT_TOPIC_STYLE`.
- `addChildNodeCommand` creates a topic node with `DEFAULT_TOPIC_STYLE`.
- `addChildNodeCommand` creates the parent edge with `DEFAULT_EDGE_STYLE`.

The existing edge component command is replaced by style commands:

```ts
setNodeStyleCommand(document, { nodeId, stylePatch })
setEdgeStyleCommand(document, { edgeId, stylePatch })
```

Each style patch is a partial style update that is merged into the selected object's current style. The merged document is parsed through the v2 schema before the command succeeds. These commands produce normal patch history entries, so object style changes undo and redo like title edits, movement, edge deletion, and node deletion.

### API

`apps/api` migrates project documents at read and write boundaries.

The API should return v2 documents to clients and save v2 documents. Existing v1 documents from storage, seed data, or tests are accepted through `migrateMindDocument`.

The API should not read or write document theme data after this change.

### Web

`apps/web` migrates all unknown document inputs before they reach the editor store:

- server documents
- local drafts
- save-failure drafts
- any test fixtures that mimic persisted documents

The editor store stores v2 only.

`EditorView` no longer applies `document.meta.theme` on load. Theme changes continue to update the theme controller and local preference, but do not mutate the document.

## Rendering

Object rendering should use a web-side resolver module, for example `apps/web/src/components/editor/objectStyles.ts`.

The resolver maps shared style tokens and style fields to CSS classes or local CSS custom properties.

Topic node rendering should expose local variables such as:

```css
--object-fill
--object-border
--object-text
--object-shadow
```

Edge rendering should expose local variables such as:

```css
--edge-stroke
--edge-width
--edge-dasharray
```

Global theme variables continue to drive app surfaces, canvas, grid, panels, controls, and interaction affordances. Object fill, text, stroke, border, and shape come from object style data.

Selection and hover feedback may still use global interaction variables, but should not overwrite object identity. A selected red edge should remain visibly red while also gaining selected emphasis.

## Inspector UI

The existing floating `InspectorPanel` remains the host for object editing.

The inspector structure becomes:

- `NodeInspector` for selected nodes.
- `EdgeInspector` for selected edges.
- Shared style controls for reusable fields such as color token selection.
- Object-specific controls for fields that only apply to topic nodes or edges.

Topic node controls expose:

- color token
- tone
- shape
- size
- border style
- shadow level
- text weight

Edge controls expose:

- color token
- line pattern
- arrow
- width
- routing

Edge `labelStyle`, `endpointStyle`, and `animation` are not shown in the first UI.

Inspector updates call the editor store, the store calls engine style commands, and the resulting command result is committed to history.

## Undo, Redo, Dirty State

Object style changes are document content changes.

They must:

- mark the editor dirty
- save with the document
- enter undo history
- enter redo history
- survive reload after save
- be included in patch-based history entries

App theme changes are user preference changes.

They must:

- update visible app theme
- persist local preference
- not mutate `MindDocument`
- not mark the document dirty
- not enter undo history

## Error Handling

- Invalid documents are rejected at shared schema boundaries.
- Unsupported object color tokens are rejected.
- Unsupported style enum values are rejected.
- Missing required v2 style fields are rejected.
- Engine style commands throw clear missing-node or missing-edge errors.
- Web renderers may defensively fall back to shared default styles if bad runtime data slips through, but this fallback should not weaken the v2 schema.
- API errors should continue through the existing validation and error handler flow.

## Testing

Shared tests:

- Accept valid v1 documents.
- Accept valid v2 documents.
- Migrate v1 to v2.
- Drop v1 `meta.theme`.
- Add default topic and edge styles during migration.
- Drop v1 `edge.component` during migration.
- Reject invalid object color tokens.
- Reject missing v2 object style fields.

Engine tests:

- New root nodes include `DEFAULT_TOPIC_STYLE`.
- New child nodes include `DEFAULT_TOPIC_STYLE`.
- New child edges include `DEFAULT_EDGE_STYLE`.
- Node style commands update topic style and produce patches.
- Edge style commands update edge style and produce patches.
- Undo and redo restore object style changes.
- Existing edge component command tests are replaced by edge style command tests.

Web store tests:

- Loading server documents stores v2.
- Loading local drafts stores v2.
- Style edits are dirty and undoable.
- Theme edits no longer mutate document metadata.
- Undo and redo preserve the local app theme.

Component tests:

- `TopicNode` maps style fields to the expected classes or local CSS variables.
- `EdgeRenderer` maps style fields to stroke, dash, arrow, width, and routing behavior.
- `NodeInspector` emits style patches.
- `EdgeInspector` emits style patches.

API and sync tests:

- API read/write paths normalize v1 input to v2.
- Project save accepts v2 without `meta.theme`.
- Save failure drafts and restored local drafts are normalized to v2.

Build checks:

- `npm run typecheck`
- `npm test`
- `npm run build`

## Out Of Scope

- User-defined custom color palettes.
- Persisting hex colors in documents.
- Account-level theme sync.
- Document-level theme persistence.
- Preserving v1 edge component visual differences during migration.
- UI for edge labels, endpoint decoration, or animation.
- New non-topic node types.
- Global default object style preferences.
