import bcrypt from 'bcryptjs'

export const PASSWORD_HASH_COST = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, PASSWORD_HASH_COST)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
