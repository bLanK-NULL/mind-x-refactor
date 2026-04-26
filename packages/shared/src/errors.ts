import { z } from 'zod'

export const errorCodeSchema = z.enum([
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'VALIDATION_ERROR',
  'INTERNAL_ERROR'
])

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string().min(1),
    details: z.unknown().optional()
  })
})

export type ErrorCode =
  z.infer<typeof errorCodeSchema>

export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>
