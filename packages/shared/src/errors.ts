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
