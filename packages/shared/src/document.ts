import { z } from 'zod'

export const createPlainTextSchema = (maxLength = 500) =>
  z.string().min(1).max(maxLength).refine((value) => !/[<>]/.test(value), {
    message: 'HTML is not allowed'
  })

export const plainTextSchema = createPlainTextSchema()

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
})

export const edgeLabelStyleSchema = z.object({
  visible: z.literal(false)
})

export const edgeEndpointStyleSchema = z.object({
  source: z.literal('none'),
  target: z.literal('none')
})

export const edgeAnimationStyleSchema = z.object({
  enabled: z.literal(false)
})

export const edgeStyleSchema = z.object({
  colorToken: objectColorTokenSchema,
  linePattern: z.enum(['solid', 'dashed', 'dotted']),
  arrow: z.enum(['none', 'end']),
  width: z.enum(['thin', 'regular', 'thick']),
  routing: z.enum(['curved', 'straight', 'elbow']),
  labelStyle: edgeLabelStyleSchema,
  endpointStyle: edgeEndpointStyleSchema,
  animation: edgeAnimationStyleSchema
})

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

export const mindNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('topic'),
  position: pointSchema,
  size: sizeSchema.optional(),
  data: z.object({
    title: plainTextSchema
  }),
  style: topicNodeStyleSchema
})

export const mindEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  type: z.literal('mind-parent'),
  style: edgeStyleSchema
})

export const mindDocumentV2Schema = z.object({
  version: z.literal(2),
  meta: z.object({
    projectId: z.string().min(1),
    title: plainTextSchema,
    updatedAt: z.string().datetime()
  }),
  viewport: viewportSchema,
  nodes: z.array(mindNodeSchema),
  edges: z.array(mindEdgeSchema)
})

export const mindDocumentSchema = mindDocumentV2Schema

export function migrateMindDocument(input: unknown): MindDocument {
  const v2Result = mindDocumentV2Schema.safeParse(input)
  if (v2Result.success) {
    return v2Result.data
  }

  const v1 = mindDocumentV1Schema.parse(input)
  return mindDocumentV2Schema.parse({
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
      style: DEFAULT_TOPIC_STYLE
    })),
    edges: v1.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      style: DEFAULT_EDGE_STYLE
    }))
  })
}

export type Point = z.infer<typeof pointSchema>
export type Size = z.infer<typeof sizeSchema>
export type Viewport = z.infer<typeof viewportSchema>
export type ObjectColorToken = z.infer<typeof objectColorTokenSchema>
export type TopicNodeStyle = z.infer<typeof topicNodeStyleSchema>
export type EdgeStyle = z.infer<typeof edgeStyleSchema>
export type EdgeLabelStyle = z.infer<typeof edgeLabelStyleSchema>
export type EdgeEndpointStyle = z.infer<typeof edgeEndpointStyleSchema>
export type EdgeAnimationStyle = z.infer<typeof edgeAnimationStyleSchema>
export type MindNode = z.infer<typeof mindNodeSchema>
export type MindEdge = z.infer<typeof mindEdgeSchema>
export type MindDocument = z.infer<typeof mindDocumentV2Schema>
export type MindDocumentV1 = z.infer<typeof mindDocumentV1Schema>
export type ThemeName = z.infer<typeof legacyThemeNameSchema>
export type PlainText = z.infer<typeof plainTextSchema>
