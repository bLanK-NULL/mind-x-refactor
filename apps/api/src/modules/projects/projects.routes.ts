import Router from '@koa/router'
import {
  createProjectRequestSchema,
  type CreateProjectRequest,
  renameProjectRequestSchema,
  type RenameProjectRequest,
  saveDocumentRequestSchema,
  type SaveDocumentRequest,
  type UserDto
} from '@mind-x/shared'
import { requireAuth } from '../../middleware/auth.js'
import { validateBody } from '../../middleware/validate.js'
import { createProject, getDocument, getProjects, removeProject, renameProject, saveDocument } from './projects.service.js'

export function createProjectsRouter(): Router {
  const router = new Router({ prefix: '/projects' })

  router.use(requireAuth)

  router.get('/', async (ctx) => {
    const user = ctx.state.user as UserDto
    ctx.body = { projects: await getProjects(user.id) }
  })

  router.post('/', validateBody(createProjectRequestSchema), async (ctx) => {
    const user = ctx.state.user as UserDto
    const body = ctx.request.body as CreateProjectRequest
    ctx.status = 201
    ctx.body = { project: await createProject(user.id, body.name) }
  })

  router.patch('/:id', validateBody(renameProjectRequestSchema), async (ctx) => {
    const user = ctx.state.user as UserDto
    const body = ctx.request.body as RenameProjectRequest
    ctx.body = { project: await renameProject(user.id, ctx.params.id, body.name) }
  })

  router.delete('/:id', async (ctx) => {
    const user = ctx.state.user as UserDto
    await removeProject(user.id, ctx.params.id)
    ctx.status = 204
  })

  router.get('/:id/document', async (ctx) => {
    const user = ctx.state.user as UserDto
    ctx.body = { document: await getDocument(user.id, ctx.params.id) }
  })

  router.put('/:id/document', validateBody(saveDocumentRequestSchema), async (ctx) => {
    const user = ctx.state.user as UserDto
    const body = ctx.request.body as SaveDocumentRequest
    ctx.body = { document: await saveDocument(user.id, ctx.params.id, body.document) }
  })

  return router
}
