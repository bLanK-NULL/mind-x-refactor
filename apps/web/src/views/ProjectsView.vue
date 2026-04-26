<script setup lang="ts">
import type { ProjectSummaryDto } from '@mind-x/shared'
import { DeleteOutlined, EditOutlined, LogoutOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { message, Modal } from 'ant-design-vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { publishCrossTabEvent, subscribeCrossTabEvents, type CrossTabEvent } from '@/services/crossTab'
import { useAuthStore } from '@/stores/auth'
import { useProjectsStore } from '@/stores/projects'

const auth = useAuthStore()
const projects = useProjectsStore()
const router = useRouter()
const newProjectName = ref('Untitled Mind Map')
const renameOpen = ref(false)
const renameName = ref('')
const renameTarget = ref<ProjectSummaryDto | null>(null)

const trimmedNewProjectName = computed(() => newProjectName.value.trim())
const trimmedRenameName = computed(() => renameName.value.trim())
const renameLoading = computed(() => {
  const projectId = renameTarget.value?.id
  return projectId === undefined ? false : projects.renamingIds[projectId] === true
})
const renameDisabled = computed(() => trimmedRenameName.value.length === 0 || renameLoading.value)

let unsubscribeCrossTabEvents: () => void = () => {}

onMounted(async () => {
  await loadProjects()
  unsubscribeCrossTabEvents = subscribeCrossTabEvents(handleCrossTabEvent)
})

onUnmounted(() => {
  unsubscribeCrossTabEvents()
})

async function loadProjects(): Promise<void> {
  await projects.fetchProjects()
  if (projects.error !== null) {
    message.error(projects.error)
  }
}

async function logout(): Promise<void> {
  auth.logout()
  await router.replace('/login')
}

async function createProject(): Promise<void> {
  if (trimmedNewProjectName.value.length === 0 || projects.creating) {
    return
  }

  try {
    const project = await projects.createProject(trimmedNewProjectName.value)
    publishCrossTabEvent({ type: 'projects:refresh' })
    newProjectName.value = ''
    await openProject(project)
  } catch {
    message.error(projects.error ?? 'Unable to create project')
  }
}

async function openProject(project: ProjectSummaryDto): Promise<void> {
  await router.push({ name: 'editor', params: { id: project.id } })
}

function openRename(project: ProjectSummaryDto): void {
  renameTarget.value = project
  renameName.value = project.name
  renameOpen.value = true
}

async function submitRename(): Promise<void> {
  const project = renameTarget.value
  if (project === null || renameDisabled.value) {
    return
  }

  try {
    const renamedProject = await projects.renameProject(project.id, trimmedRenameName.value)
    publishCrossTabEvent({
      name: renamedProject.name,
      projectId: renamedProject.id,
      type: 'project:renamed'
    })
    renameOpen.value = false
    renameTarget.value = null
    message.success('Project renamed')
  } catch {
    message.error(projects.error ?? 'Unable to rename project')
  }
}

function confirmDelete(project: ProjectSummaryDto): void {
  Modal.confirm({
    centered: true,
    content: project.name,
    okText: 'Delete',
    okType: 'danger',
    title: 'Delete project?',
    async onOk() {
      try {
        await projects.deleteProject(project.id)
        publishCrossTabEvent({ projectId: project.id, type: 'project:deleted' })
        message.success('Project deleted')
      } catch {
        message.error(projects.error ?? 'Unable to delete project')
      }
    }
  })
}

async function handleCrossTabEvent(event: CrossTabEvent): Promise<void> {
  if (event.type === 'projects:refresh') {
    await loadProjects()
    return
  }

  if (event.type === 'project:renamed') {
    const project = projects.projects.find((item) => item.id === event.projectId)
    if (project === undefined) {
      await loadProjects()
      return
    }

    project.name = event.name
    return
  }

  projects.projects = projects.projects.filter((project) => project.id !== event.projectId)
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <h1 class="app-title">Projects</h1>
      <div class="project-header-actions">
        <a-input
          v-model:value="newProjectName"
          class="project-create-input"
          maxlength="120"
          placeholder="Project name"
          @press-enter="createProject"
        />
        <a-button
          :disabled="trimmedNewProjectName.length === 0"
          :loading="projects.creating"
          type="primary"
          @click="createProject"
        >
          <template #icon>
            <PlusOutlined />
          </template>
          Create
        </a-button>
        <a-button type="text" @click="logout">
          <template #icon>
            <LogoutOutlined />
          </template>
          Logout
        </a-button>
      </div>
    </header>

    <main class="app-main">
      <section class="view-panel" aria-labelledby="projects-title">
        <div class="projects-panel__header">
          <h2 id="projects-title" class="projects-panel__title">Project Center</h2>
          <span class="projects-panel__count">{{ projects.projects.length }}</span>
        </div>

        <div class="projects-panel__body">
          <a-spin :spinning="projects.loading">
            <a-empty v-if="projects.projects.length === 0 && !projects.loading" description="No projects" />

            <div v-else class="project-grid">
              <article
                v-for="project in projects.projects"
                :key="project.id"
                class="project-card"
                role="button"
                tabindex="0"
                @click="openProject(project)"
                @keydown.enter.prevent="openProject(project)"
                @keydown.space.prevent="openProject(project)"
              >
                <div class="project-card__content">
                  <h3 class="project-card__name" :title="project.name">{{ project.name }}</h3>
                  <time class="project-card__time" :datetime="project.updatedAt">
                    {{ formatUpdatedAt(project.updatedAt) }}
                  </time>
                </div>

                <div class="project-card__actions" @click.stop>
                  <a-tooltip title="Rename">
                    <a-button
                      :loading="projects.renamingIds[project.id] === true"
                      aria-label="Rename project"
                      size="small"
                      type="text"
                      @click="openRename(project)"
                    >
                      <template #icon>
                        <EditOutlined />
                      </template>
                    </a-button>
                  </a-tooltip>
                  <a-tooltip title="Delete">
                    <a-button
                      :loading="projects.deletingIds[project.id] === true"
                      aria-label="Delete project"
                      danger
                      size="small"
                      type="text"
                      @click="confirmDelete(project)"
                    >
                      <template #icon>
                        <DeleteOutlined />
                      </template>
                    </a-button>
                  </a-tooltip>
                </div>
              </article>
            </div>
          </a-spin>
        </div>
      </section>
    </main>

    <a-modal
      v-model:open="renameOpen"
      :confirm-loading="renameLoading"
      :ok-button-props="{ disabled: renameDisabled }"
      destroy-on-close
      ok-text="Rename"
      title="Rename project"
      @ok="submitRename"
    >
      <a-input v-model:value="renameName" maxlength="120" @press-enter="submitRename" />
    </a-modal>
  </div>
</template>

<style scoped>
.project-header-actions {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
}

.project-create-input {
  width: min(320px, 100%);
}

.projects-panel__header {
  display: flex;
  min-height: 56px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 20px;
  border-bottom: 1px solid #e5ebf0;
}

.projects-panel__title {
  margin: 0;
  color: #111827;
  font-size: 16px;
  font-weight: 650;
  line-height: 1.35;
}

.projects-panel__count {
  display: inline-grid;
  min-width: 28px;
  height: 24px;
  place-items: center;
  padding: 0 8px;
  border-radius: 999px;
  background: #eef2f6;
  color: #4b5563;
  font-size: 12px;
  font-weight: 650;
}

.projects-panel__body {
  min-height: 220px;
  padding: 20px;
}

.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.project-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  min-height: 112px;
  padding: 16px;
  border: 1px solid #dbe3ea;
  border-radius: 8px;
  background: #ffffff;
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease;
}

.project-card:hover,
.project-card:focus-visible {
  border-color: #4f7fb8;
  box-shadow: 0 8px 22px rgb(17 24 39 / 8%);
  outline: none;
  transform: translateY(-1px);
}

.project-card__content {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: space-between;
  gap: 18px;
}

.project-card__name {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: #111827;
  font-size: 15px;
  font-weight: 650;
  line-height: 1.35;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.project-card__time {
  overflow: hidden;
  color: #64748b;
  font-size: 12px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-card__actions {
  display: flex;
  align-items: flex-start;
  gap: 2px;
}

@media (max-width: 640px) {
  .project-header-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .project-create-input {
    flex: 1 1 180px;
  }

  .projects-panel__header,
  .projects-panel__body {
    padding-right: 16px;
    padding-left: 16px;
  }

  .project-grid {
    grid-template-columns: 1fr;
  }
}
</style>
