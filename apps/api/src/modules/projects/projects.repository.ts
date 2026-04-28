import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { migrateMindDocument, type MindDocument } from '@mind-x/shared'
import { pool } from '../../db/pool.js'

export type ProjectSummaryRecord = {
  createdAt: Date
  id: string
  name: string
  updatedAt: Date
}

export type ProjectRecord = ProjectSummaryRecord & {
  document: MindDocument
  userId: string
}

export class StoredProjectDocumentError extends Error {
  constructor(cause: unknown) {
    super('Stored project document is invalid', { cause })
    this.name = 'StoredProjectDocumentError'
  }
}

type ProjectSummaryRow = RowDataPacket & {
  created_at: Date | string
  id: string
  name: string
  updated_at: Date | string
}

type ProjectRow = ProjectSummaryRow & {
  document_json: MindDocument | string
  user_id: string
}

type InsertProjectInput = {
  document: MindDocument
  id: string
  name: string
  userId: string
}

type UpdateProjectNameInput = {
  name: string
  projectId: string
  userId: string
}

type UpdateProjectDocumentInput = {
  document: MindDocument
  projectId: string
  userId: string
}

export async function listProjects(userId: string): Promise<ProjectSummaryRecord[]> {
  const [rows] = await pool.execute<ProjectSummaryRow[]>(
    [
      'SELECT id, name, created_at, updated_at',
      'FROM projects',
      'WHERE user_id = ?',
      'ORDER BY updated_at DESC'
    ].join(' '),
    [userId]
  )

  return rows.map(toProjectSummaryRecord)
}

export async function findProject(userId: string, projectId: string): Promise<ProjectRecord | null> {
  const [rows] = await pool.execute<ProjectRow[]>(
    [
      'SELECT id, user_id, name, document_json, created_at, updated_at',
      'FROM projects',
      'WHERE user_id = ? AND id = ?',
      'LIMIT 1'
    ].join(' '),
    [userId, projectId]
  )

  const row = rows[0]
  return row === undefined ? null : toProjectRecord(row)
}

export async function findProjectSummary(userId: string, projectId: string): Promise<ProjectSummaryRecord | null> {
  const [rows] = await pool.execute<ProjectSummaryRow[]>(
    [
      'SELECT id, name, created_at, updated_at',
      'FROM projects',
      'WHERE user_id = ? AND id = ?',
      'LIMIT 1'
    ].join(' '),
    [userId, projectId]
  )

  const row = rows[0]
  return row === undefined ? null : toProjectSummaryRecord(row)
}

export async function insertProject(input: InsertProjectInput): Promise<void> {
  await pool.execute<ResultSetHeader>(
    'INSERT INTO projects (id, user_id, name, document_json) VALUES (?, ?, ?, ?)',
    [input.id, input.userId, input.name, JSON.stringify(input.document)]
  )
}

export async function updateProjectName(input: UpdateProjectNameInput): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    'UPDATE projects SET name = ? WHERE user_id = ? AND id = ?',
    [input.name, input.userId, input.projectId]
  )

  return result.affectedRows
}

export async function updateProjectDocument(input: UpdateProjectDocumentInput): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    'UPDATE projects SET document_json = ? WHERE user_id = ? AND id = ?',
    [JSON.stringify(input.document), input.userId, input.projectId]
  )

  return result.affectedRows
}

export async function deleteProject(userId: string, projectId: string): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>('DELETE FROM projects WHERE user_id = ? AND id = ?', [
    userId,
    projectId
  ])

  return result.affectedRows
}

function toProjectSummaryRecord(row: ProjectSummaryRow): ProjectSummaryRecord {
  return {
    createdAt: toDate(row.created_at),
    id: row.id,
    name: row.name,
    updatedAt: toDate(row.updated_at)
  }
}

function toProjectRecord(row: ProjectRow): ProjectRecord {
  return {
    ...toProjectSummaryRecord(row),
    document: parseDocumentJson(row.document_json),
    userId: row.user_id
  }
}

function parseDocumentJson(value: MindDocument | string): MindDocument {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    return migrateMindDocument(parsed)
  } catch (error) {
    throw new StoredProjectDocumentError(error)
  }
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}
