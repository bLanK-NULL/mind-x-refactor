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
export type PlainText = z.infer<typeof plainTextSchema>
