import 'dotenv/config'
import { z } from 'zod'

const rawEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  JWT_SECRET: z.string().min(16).optional(),
  DB_HOST: z.string().min(1).optional(),
  DB_PORT: z.coerce.number().int().positive().optional(),
  DB_USER: z.string().min(1).optional(),
  DB_PASSWORD: z.string().optional(),
  DB_DATABASE: z.string().min(1).optional(),
  DB_NAME: z.string().min(1).optional()
})

const rawEnv = rawEnvSchema.parse(process.env)
const isProduction = rawEnv.NODE_ENV === 'production'

function requiredInProduction(name: string, value: string | undefined): string {
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} must be configured when NODE_ENV=production`)
  }

  return value
}

export const env = {
  NODE_ENV: rawEnv.NODE_ENV,
  PORT: rawEnv.PORT,
  JWT_SECRET: isProduction
    ? requiredInProduction('JWT_SECRET', rawEnv.JWT_SECRET)
    : rawEnv.JWT_SECRET ?? 'mind-x-dev-secret-change-me',
  DB_HOST: rawEnv.DB_HOST ?? '127.0.0.1',
  DB_PORT: rawEnv.DB_PORT ?? 3307,
  DB_USER: rawEnv.DB_USER ?? 'mindx',
  DB_PASSWORD: isProduction
    ? requiredInProduction('DB_PASSWORD', rawEnv.DB_PASSWORD)
    : rawEnv.DB_PASSWORD ?? 'mindx',
  DB_DATABASE: rawEnv.DB_DATABASE ?? rawEnv.DB_NAME ?? 'mind_x_refactor'
} as const
