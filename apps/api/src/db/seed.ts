import { fileURLToPath } from 'node:url'
import type { Pool } from 'mysql2/promise'
import { pool } from './pool.js'
import { hashPassword } from '../modules/auth/password.js'

type SeedUser = {
  id: string
  password: string
  username: string
}

type SeedDatabase = Pick<Pool, 'execute'>

const seedAccounts: SeedUser[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    password: '123456',
    username: 'blank'
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    password: 'admin',
    username: 'admin'
  }
]

const upsertUserSql = `
INSERT INTO users (id, username, password_hash)
VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE
  username = VALUES(username),
  password_hash = VALUES(password_hash),
  updated_at = CURRENT_TIMESTAMP
`

export async function seedUsers(database: SeedDatabase = pool): Promise<void> {
  for (const account of seedAccounts) {
    await database.execute(upsertUserSql, [account.id, account.username, await hashPassword(account.password)])
  }
}

async function main(): Promise<void> {
  try {
    await seedUsers()
  } finally {
    await pool.end()
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
