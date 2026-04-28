import { z } from 'zod'
import { createPlainTextSchema, migrateMindDocument } from './document.js'

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
  name: createPlainTextSchema(120)
})

export const renameProjectRequestSchema = z.object({
  name: createPlainTextSchema(120)
})

export const saveDocumentRequestSchema = z.object({
  document: z.unknown().transform((document) => migrateMindDocument(document))
})

export type UserDto = z.infer<typeof userSchema>
export type ProjectSummaryDto = z.infer<typeof projectSummarySchema>
export type LoginRequest = z.infer<typeof loginRequestSchema>
export type LoginResponse = z.infer<typeof loginResponseSchema>
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>
export type RenameProjectRequest = z.infer<typeof renameProjectRequestSchema>
export type SaveDocumentRequest = z.infer<typeof saveDocumentRequestSchema>
