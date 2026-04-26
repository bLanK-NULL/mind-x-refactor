import { randomUUID } from 'node:crypto'
import { createEmptyDocument } from '@mind-x/mind-engine'
import type { MindDocument, ProjectSummaryDto } from '@mind-x/shared'
import { HttpError } from '../../shared/http-error.js'
import {
  deleteProject,
  findProject,
  insertProject,
  listProjects,
  type ProjectSummaryRecord,
  updateProjectDocument,
  updateProjectName
} from './projects.repository.js'

type MysqlError = Error & {
  code?: string
  errno?: number
}

export async function getProjects(userId: string): Promise<ProjectSummaryDto[]> {
  const projects = await listProjects(userId)
  return projects.map(toProjectSummaryDto)
}

export async function createProject(userId: string, name: string): Promise<ProjectSummaryDto> {
  const id = randomUUID()
  const now = new Date().toISOString()
  const document = createEmptyDocument({ projectId: id, title: name, now })

  try {
    await insertProject({ document, id, name, userId })
  } catch (error) {
    if (isDuplicateEntryError(error)) {
      throw duplicateProjectNameError()
    }
    throw error
  }

  return getExistingProjectSummary(userId, id)
}

export async function renameProject(userId: string, projectId: string, name: string): Promise<ProjectSummaryDto> {
  let affectedRows: number
  try {
    affectedRows = await updateProjectName({ name, projectId, userId })
  } catch (error) {
    if (isDuplicateEntryError(error)) {
      throw duplicateProjectNameError()
    }
    throw error
  }

  if (affectedRows === 0) {
    throw projectNotFoundError()
  }

  return getExistingProjectSummary(userId, projectId)
}

export async function removeProject(userId: string, projectId: string): Promise<void> {
  const affectedRows = await deleteProject(userId, projectId)
  if (affectedRows === 0) {
    throw projectNotFoundError()
  }
}

export async function getDocument(userId: string, projectId: string): Promise<MindDocument> {
  const project = await findProject(userId, projectId)
  if (project === null) {
    throw projectNotFoundError()
  }

  return project.document
}

export async function saveDocument(userId: string, projectId: string, document: MindDocument): Promise<MindDocument> {
  if (document.meta.projectId !== projectId) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Document projectId must match route project id')
  }

  const affectedRows = await updateProjectDocument({ document, projectId, userId })
  if (affectedRows === 0) {
    throw projectNotFoundError()
  }

  return document
}

async function getExistingProjectSummary(userId: string, projectId: string): Promise<ProjectSummaryDto> {
  const project = await findProject(userId, projectId)
  if (project === null) {
    throw projectNotFoundError()
  }

  return toProjectSummaryDto(project)
}

function toProjectSummaryDto(project: ProjectSummaryRecord): ProjectSummaryDto {
  return {
    createdAt: project.createdAt.toISOString(),
    id: project.id,
    name: project.name,
    updatedAt: project.updatedAt.toISOString()
  }
}

function duplicateProjectNameError(): HttpError {
  return new HttpError(409, 'CONFLICT', 'Project name already exists')
}

function projectNotFoundError(): HttpError {
  return new HttpError(404, 'NOT_FOUND', 'Project not found')
}

function isDuplicateEntryError(error: unknown): error is MysqlError {
  if (!(error instanceof Error)) {
    return false
  }

  const mysqlError = error as MysqlError
  return mysqlError.code === 'ER_DUP_ENTRY' || mysqlError.errno === 1062 || /duplicate/i.test(mysqlError.message)
}
