import { z } from 'zod'

export const createPlainTextSchema = (maxLength = 500) =>
  z.string().min(1).max(maxLength).refine((value) => !/[<>]/.test(value), {
    message: 'HTML is not allowed'
  })

export const plainTextSchema = createPlainTextSchema()

export const webUrlSchema = z.string().refine(
  (value) => {
    try {
      const url = new URL(value)
      return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
      return false
    }
  },
  { message: 'URL must use http or https' }
)

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

const pointV2Schema = pointSchema.strict()
const sizeV2Schema = sizeSchema.strict()
const viewportV2Schema = viewportSchema.strict()

export const legacyThemeNameSchema = z.enum(['light', 'dark', 'colorful', 'vivid'])
export const edgeComponentSchema = z.enum(['plain', 'dashed', 'arrow', 'dashed-arrow'])
export const edgeDirectionSchema = z.literal('source-target')

export const mindNodeV1Schema = z.object({
  id: z.string().min(1),
  type: z.literal('topic'),
  position: pointSchema,
  size: sizeSchema.optional(),
  data: z.object({
    title: plainTextSchema
  })
})

export const mindEdgeV1Schema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  type: z.literal('mind-parent'),
  component: edgeComponentSchema.optional(),
  data: z
    .object({
      direction: edgeDirectionSchema.optional()
    })
    .optional()
})

export const mindDocumentV1Schema = z.object({
  version: z.literal(1),
  meta: z.object({
    projectId: z.string().min(1),
    title: plainTextSchema,
    theme: legacyThemeNameSchema,
    updatedAt: z.string().datetime()
  }),
  viewport: viewportSchema,
  nodes: z.array(mindNodeV1Schema),
  edges: z.array(mindEdgeV1Schema)
})

export const OBJECT_COLOR_TOKENS = ['default', 'primary', 'success', 'warning', 'danger', 'info', 'purple'] as const

export const objectColorTokenSchema = z.enum(OBJECT_COLOR_TOKENS)

export const topicNodeStyleSchema = z.object({
  colorToken: objectColorTokenSchema,
  tone: z.enum(['soft', 'solid', 'outline']),
  shape: z.enum(['rounded', 'rectangle', 'pill']),
  size: z.enum(['sm', 'md', 'lg']),
  borderStyle: z.enum(['none', 'solid', 'dashed']),
  shadowLevel: z.enum(['none', 'sm', 'md']),
  textWeight: z.enum(['regular', 'medium', 'bold'])
}).strict()

export const edgeLabelStyleSchema = z.object({
  visible: z.literal(false)
}).strict()

export const edgeEndpointStyleSchema = z.object({
  source: z.literal('none'),
  target: z.literal('none')
}).strict()

export const edgeAnimationStyleSchema = z.object({
  enabled: z.literal(false)
}).strict()

export const edgeStyleSchema = z.object({
  colorToken: objectColorTokenSchema,
  linePattern: z.enum(['solid', 'dashed', 'dotted']),
  arrow: z.enum(['none', 'end']),
  width: z.enum(['thin', 'regular', 'thick']),
  routing: z.enum(['curved', 'straight', 'elbow']),
  labelStyle: edgeLabelStyleSchema,
  endpointStyle: edgeEndpointStyleSchema,
  animation: edgeAnimationStyleSchema
}).strict()

export const DEFAULT_TOPIC_STYLE = {
  borderStyle: 'solid',
  colorToken: 'default',
  shadowLevel: 'sm',
  shape: 'rounded',
  size: 'md',
  textWeight: 'medium',
  tone: 'soft'
} as const satisfies z.infer<typeof topicNodeStyleSchema>

export const DEFAULT_EDGE_STYLE = {
  animation: { enabled: false },
  arrow: 'none',
  colorToken: 'default',
  endpointStyle: { source: 'none', target: 'none' },
  labelStyle: { visible: false },
  linePattern: 'solid',
  routing: 'curved',
  width: 'regular'
} as const satisfies z.infer<typeof edgeStyleSchema>

export const NODE_TYPES = ['topic', 'image', 'link', 'attachment', 'code', 'task'] as const
export const mindNodeTypeSchema = z.enum(NODE_TYPES)

export const nodeShellStyleSchema = z.object({
  colorToken: objectColorTokenSchema,
  tone: z.enum(['soft', 'solid', 'outline']),
  shape: z.enum(['rounded', 'rectangle', 'pill']),
  borderStyle: z.enum(['none', 'solid', 'dashed']),
  shadowLevel: z.enum(['none', 'sm', 'md'])
}).strict()

export const topicContentStyleSchema = z.object({
  textWeight: z.enum(['regular', 'medium', 'bold'])
}).strict()

export const imageContentStyleSchema = z.object({
  objectFit: z.enum(['cover', 'contain'])
}).strict()

export const linkContentStyleSchema = z.object({
  layout: z.literal('summary')
}).strict()

export const attachmentContentStyleSchema = z.object({
  icon: z.literal('file')
}).strict()

export const codeContentStyleSchema = z.object({
  wrap: z.boolean()
}).strict()

export const taskContentStyleSchema = z.object({
  density: z.enum(['comfortable', 'compact'])
}).strict()

export const DEFAULT_NODE_SHELL_STYLE = {
  borderStyle: 'solid',
  colorToken: 'default',
  shadowLevel: 'sm',
  shape: 'rounded',
  tone: 'soft'
} as const satisfies z.infer<typeof nodeShellStyleSchema>

export const DEFAULT_TOPIC_CONTENT_STYLE = {
  textWeight: 'medium'
} as const satisfies z.infer<typeof topicContentStyleSchema>

export const DEFAULT_IMAGE_CONTENT_STYLE = {
  objectFit: 'cover'
} as const satisfies z.infer<typeof imageContentStyleSchema>

export const DEFAULT_LINK_CONTENT_STYLE = {
  layout: 'summary'
} as const satisfies z.infer<typeof linkContentStyleSchema>

export const DEFAULT_ATTACHMENT_CONTENT_STYLE = {
  icon: 'file'
} as const satisfies z.infer<typeof attachmentContentStyleSchema>

export const DEFAULT_CODE_CONTENT_STYLE = {
  wrap: true
} as const satisfies z.infer<typeof codeContentStyleSchema>

export const DEFAULT_TASK_CONTENT_STYLE = {
  density: 'comfortable'
} as const satisfies z.infer<typeof taskContentStyleSchema>

export const DEFAULT_NODE_SIZE_BY_TYPE = {
  attachment: { width: 240, height: 72 },
  code: { width: 320, height: 180 },
  image: { width: 240, height: 160 },
  link: { width: 240, height: 88 },
  task: { width: 260, height: 180 },
  topic: { width: 180, height: 56 }
} as const satisfies Record<z.infer<typeof mindNodeTypeSchema>, z.infer<typeof sizeSchema>>

const LEGACY_TOPIC_SIZE_TO_NODE_SIZE = {
  lg: { width: 220, height: 72 },
  md: DEFAULT_NODE_SIZE_BY_TYPE.topic,
  sm: { width: 150, height: 44 }
} as const satisfies Record<z.infer<typeof topicNodeStyleSchema>['size'], z.infer<typeof sizeSchema>>

export const createDefaultTopicStyle = (): z.infer<typeof topicNodeStyleSchema> => ({
  ...DEFAULT_TOPIC_STYLE
})

export const createDefaultEdgeStyle = (): z.infer<typeof edgeStyleSchema> => ({
  ...DEFAULT_EDGE_STYLE,
  animation: { ...DEFAULT_EDGE_STYLE.animation },
  endpointStyle: { ...DEFAULT_EDGE_STYLE.endpointStyle },
  labelStyle: { ...DEFAULT_EDGE_STYLE.labelStyle }
})

const mindNodeDataSchema = z.object({
  title: plainTextSchema
}).strict()

const mindDocumentMetaSchema = z.object({
  projectId: z.string().min(1),
  title: plainTextSchema,
  updatedAt: z.string().datetime()
}).strict()

export const mindNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('topic'),
  position: pointV2Schema,
  size: sizeV2Schema.optional(),
  data: mindNodeDataSchema,
  style: topicNodeStyleSchema
}).strict()

export const mindEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  type: z.literal('mind-parent'),
  style: edgeStyleSchema
}).strict()

const nodeBaseV3Schema = z.object({
  id: z.string().min(1),
  position: pointV2Schema,
  size: sizeV2Schema,
  shellStyle: nodeShellStyleSchema
}).strict()

const topicNodeV3Schema = nodeBaseV3Schema.extend({
  type: z.literal('topic'),
  data: z.object({ title: plainTextSchema }).strict(),
  contentStyle: topicContentStyleSchema
}).strict()

const imageNodeV3Schema = nodeBaseV3Schema.extend({
  type: z.literal('image'),
  data: z.object({
    url: webUrlSchema,
    alt: plainTextSchema.optional(),
    caption: plainTextSchema.optional()
  }).strict(),
  contentStyle: imageContentStyleSchema
}).strict()

const linkNodeV3Schema = nodeBaseV3Schema.extend({
  type: z.literal('link'),
  data: z.object({
    url: webUrlSchema,
    title: plainTextSchema,
    description: plainTextSchema.optional()
  }).strict(),
  contentStyle: linkContentStyleSchema
}).strict()

const attachmentNodeV3Schema = nodeBaseV3Schema.extend({
  type: z.literal('attachment'),
  data: z.object({
    url: webUrlSchema,
    fileName: plainTextSchema,
    fileSizeLabel: plainTextSchema.optional(),
    mimeType: plainTextSchema.optional()
  }).strict(),
  contentStyle: attachmentContentStyleSchema
}).strict()

const codeNodeV3Schema = nodeBaseV3Schema.extend({
  type: z.literal('code'),
  data: z.object({
    code: z.string().max(20000),
    language: z.string().min(1).max(64).optional()
  }).strict(),
  contentStyle: codeContentStyleSchema
}).strict()

const taskItemSchema = z.object({
  id: z.string().min(1),
  title: plainTextSchema,
  done: z.boolean(),
  notes: plainTextSchema.optional(),
  dueDate: z.string().datetime().optional(),
  priority: z.enum(['low', 'normal', 'high']).optional()
}).strict()

const taskNodeV3Schema = nodeBaseV3Schema.extend({
  type: z.literal('task'),
  data: z.object({
    items: z.array(taskItemSchema).min(1)
  }).strict(),
  contentStyle: taskContentStyleSchema
}).strict()

export const mindNodeV3Schema = z.discriminatedUnion('type', [
  topicNodeV3Schema,
  imageNodeV3Schema,
  linkNodeV3Schema,
  attachmentNodeV3Schema,
  codeNodeV3Schema,
  taskNodeV3Schema
])

export const mindDocumentV3Schema = z.object({
  version: z.literal(3),
  meta: mindDocumentMetaSchema,
  viewport: viewportV2Schema,
  nodes: z.array(mindNodeV3Schema),
  edges: z.array(mindEdgeSchema)
}).strict()

export const mindDocumentV2Schema = z.object({
  version: z.literal(2),
  meta: mindDocumentMetaSchema,
  viewport: viewportV2Schema,
  nodes: z.array(mindNodeSchema),
  edges: z.array(mindEdgeSchema)
}).strict()

export const mindDocumentSchema = mindDocumentV2Schema

const migrateV1MindDocument = (v1: z.infer<typeof mindDocumentV1Schema>) =>
  ({
    version: 2,
    meta: {
      projectId: v1.meta.projectId,
      title: v1.meta.title,
      updatedAt: v1.meta.updatedAt
    },
    viewport: v1.viewport,
    nodes: v1.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      ...(node.size ? { size: node.size } : {}),
      data: node.data,
      style: createDefaultTopicStyle()
    })),
    edges: v1.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      style: createDefaultEdgeStyle()
    }))
  }) satisfies z.infer<typeof mindDocumentV2Schema>

function migrateTopicStyleToShellStyle(style: TopicNodeStyle): z.infer<typeof nodeShellStyleSchema> {
  return {
    borderStyle: style.borderStyle,
    colorToken: style.colorToken,
    shadowLevel: style.shadowLevel,
    shape: style.shape,
    tone: style.tone
  }
}

function createDefaultTopicContentStyleFromLegacy(style: TopicNodeStyle): z.infer<typeof topicContentStyleSchema> {
  return {
    textWeight: style.textWeight
  }
}

function cloneSize(size: Size): Size {
  return {
    height: size.height,
    width: size.width
  }
}

function migrateV2MindDocumentToV3(v2: z.infer<typeof mindDocumentV2Schema>): z.infer<typeof mindDocumentV3Schema> {
  return {
    version: 3,
    meta: v2.meta,
    viewport: v2.viewport,
    nodes: v2.nodes.map((node) => ({
      id: node.id,
      type: 'topic',
      position: node.position,
      size: cloneSize(node.size ?? LEGACY_TOPIC_SIZE_TO_NODE_SIZE[node.style.size]),
      shellStyle: migrateTopicStyleToShellStyle(node.style),
      data: node.data,
      contentStyle: createDefaultTopicContentStyleFromLegacy(node.style)
    })),
    edges: v2.edges
  }
}

export function migrateMindDocumentToV3(input: unknown): z.infer<typeof mindDocumentV3Schema> {
  return z.union([
    mindDocumentV3Schema,
    mindDocumentV2Schema.transform((document) => migrateV2MindDocumentToV3(document)),
    mindDocumentV1Schema.transform((document) => migrateV2MindDocumentToV3(migrateV1MindDocument(document)))
  ]).parse(input)
}

export const migratableMindDocumentSchema = z.union([
  mindDocumentV2Schema,
  mindDocumentV1Schema.transform((document) => migrateV1MindDocument(document))
])

export function migrateMindDocument(input: unknown): MindDocument {
  return migratableMindDocumentSchema.parse(input)
}

export type Point = z.infer<typeof pointSchema>
export type Size = z.infer<typeof sizeSchema>
export type Viewport = z.infer<typeof viewportSchema>
export type ObjectColorToken = z.infer<typeof objectColorTokenSchema>
export type TopicNodeStyle = z.infer<typeof topicNodeStyleSchema>
export type MindNodeType = z.infer<typeof mindNodeTypeSchema>
export type NodeShellStyle = z.infer<typeof nodeShellStyleSchema>
export type TopicContentStyle = z.infer<typeof topicContentStyleSchema>
export type ImageContentStyle = z.infer<typeof imageContentStyleSchema>
export type LinkContentStyle = z.infer<typeof linkContentStyleSchema>
export type AttachmentContentStyle = z.infer<typeof attachmentContentStyleSchema>
export type CodeContentStyle = z.infer<typeof codeContentStyleSchema>
export type TaskContentStyle = z.infer<typeof taskContentStyleSchema>
export type EdgeStyle = z.infer<typeof edgeStyleSchema>
export type EdgeLabelStyle = z.infer<typeof edgeLabelStyleSchema>
export type EdgeEndpointStyle = z.infer<typeof edgeEndpointStyleSchema>
export type EdgeAnimationStyle = z.infer<typeof edgeAnimationStyleSchema>
export type MindNode = z.infer<typeof mindNodeSchema>
export type MindNodeV3 = z.infer<typeof mindNodeV3Schema>
export type MindEdge = z.infer<typeof mindEdgeSchema>
export type MindDocument = z.infer<typeof mindDocumentV2Schema>
export type MindDocumentV3 = z.infer<typeof mindDocumentV3Schema>
export type MindDocumentV1 = z.infer<typeof mindDocumentV1Schema>
export type ThemeName = z.infer<typeof legacyThemeNameSchema>
export type PlainText = z.infer<typeof plainTextSchema>
