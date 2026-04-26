<script setup lang="ts">
import type { MindDocument, ThemeName } from '@mind-x/shared'
import { ArrowLeftOutlined, LogoutOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ThemeToggle from '@/components/ThemeToggle.vue'
import MindEditor from '@/components/editor/MindEditor.vue'
import { getApiErrorMessage } from '@/api/client'
import { useTheme } from '@/composables/useTheme'
import { exportDocumentAsPng } from '@/services/exportPng'
import { selectFailedSaveDraftDocument } from '@/services/saveFailureDraft'
import { subscribeCrossTabEvents, type CrossTabEvent } from '@/services/crossTab'
import { getLocalDraft, loadServerDocument, saveLocalDraft, saveServerDocument } from '@/services/syncService'
import { useAuthStore } from '@/stores/auth'
import { serializeMindDocument, useEditorStore } from '@/stores/editor'

const auth = useAuthStore()
const editor = useEditorStore()
const route = useRoute()
const router = useRouter()
const { setTheme } = useTheme()
const projectId = computed(() => String(route.params.id ?? ''))
const loadedDocument = ref<MindDocument | null>(null)
const loading = ref(false)
const loadError = ref<string | null>(null)
const saving = ref(false)
const exporting = ref(false)

let isEditorViewMounted = false
let editorSessionGeneration = 0
let unsubscribeCrossTabEvents: () => void = () => {}

onMounted(() => {
  isEditorViewMounted = true
  unsubscribeCrossTabEvents = subscribeCrossTabEvents(handleCrossTabEvent)
  void loadProjectDocument()
})

onUnmounted(() => {
  isEditorViewMounted = false
  unsubscribeCrossTabEvents()
})

watch(projectId, () => {
  if (isEditorViewMounted) {
    void loadProjectDocument()
  }
})

async function loadProjectDocument(): Promise<void> {
  const id = projectId.value
  const requestId = ++editorSessionGeneration
  loading.value = true
  loadError.value = null
  loadedDocument.value = null
  editor.$reset()

  try {
    const serverDocument = await loadServerDocument(id)
    const draft = await getLocalDraft(id)
    if (!isEditorViewMounted || requestId !== editorSessionGeneration) {
      return
    }

    const activeDocument = draft?.document ?? serverDocument
    setTheme(activeDocument.meta.theme)
    loadedDocument.value = activeDocument
    await nextTick()
    if (!isEditorViewMounted || requestId !== editorSessionGeneration) {
      return
    }

    if (draft !== null) {
      editor.load(serverDocument)
      editor.commit(draft.document)
      message.warning('Local draft restored')
    } else {
      editor.load(serverDocument)
    }
  } catch (error) {
    if (isEditorViewMounted && requestId === editorSessionGeneration) {
      loadError.value = getApiErrorMessage(error)
    }
  } finally {
    if (isEditorViewMounted && requestId === editorSessionGeneration) {
      loading.value = false
    }
  }
}

async function goBack(): Promise<void> {
  await router.push('/projects')
}

async function logout(): Promise<void> {
  auth.logout()
  await router.replace('/login')
}

function handleThemeChange(themeName: ThemeName): void {
  editor.setDocumentTheme(themeName)
}

async function saveDocument(): Promise<void> {
  if (!editor.document || saving.value) {
    return
  }

  const id = projectId.value
  const saveSessionGeneration = editorSessionGeneration
  const documentSnapshotJson = serializeMindDocument(editor.document)
  if (documentSnapshotJson === null) {
    return
  }

  const document = JSON.parse(documentSnapshotJson) as MindDocument
  saving.value = true
  try {
    const savedDocument = await saveServerDocument(id, document)
    const saveSessionStillCurrent =
      isEditorViewMounted && id === projectId.value && saveSessionGeneration === editorSessionGeneration
    if (!saveSessionStillCurrent) {
      return
    }

    if (editor.hasDocumentSnapshot(documentSnapshotJson)) {
      loadedDocument.value = savedDocument
      editor.load(savedDocument)
      message.success('Document saved')
    } else {
      message.info('Saved; newer edits remain unsaved')
    }
  } catch (error) {
    try {
      const isCurrentProject = isEditorViewMounted && id === projectId.value
      const saveSessionStillCurrent = isCurrentProject && saveSessionGeneration === editorSessionGeneration
      const draftDocument = selectFailedSaveDraftDocument({
        capturedDocument: document,
        currentDocument: editor.document,
        isCurrentProject,
        saveSessionStillCurrent,
        snapshotStillCurrent: editor.hasDocumentSnapshot(documentSnapshotJson)
      })
      await saveLocalDraft(id, draftDocument)
      if (saveSessionStillCurrent) {
        message.warning('Saved local draft')
      }
    } catch {
      if (isEditorViewMounted && id === projectId.value && saveSessionGeneration === editorSessionGeneration) {
        message.error(getApiErrorMessage(error))
      }
    }
  } finally {
    saving.value = false
  }
}

async function handleExportPng(root: HTMLElement, document: MindDocument): Promise<void> {
  if (exporting.value) {
    return
  }

  exporting.value = true
  try {
    const filename = await exportDocumentAsPng({ document, root })
    if (filename === false) {
      message.warning('Nothing to export')
      return
    }

    message.success(`Exported ${filename}`)
  } catch (error) {
    message.error(getApiErrorMessage(error))
  } finally {
    exporting.value = false
  }
}

async function handleCrossTabEvent(event: CrossTabEvent): Promise<void> {
  if (!isEditorViewMounted) {
    return
  }

  if (event.type === 'project:deleted' && event.projectId === projectId.value) {
    message.warning('Project deleted')
    await router.replace('/projects')
    return
  }

  if (event.type === 'project:renamed' && event.project.id === projectId.value) {
    editor.updateDocumentTitle(event.project.name)
  }
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <h1 class="app-title">Editor</h1>
      <div class="editor-actions">
        <a-button type="text" @click="goBack">
          <template #icon>
            <ArrowLeftOutlined />
          </template>
          Projects
        </a-button>
        <a-button type="text" @click="logout">
          <template #icon>
            <LogoutOutlined />
          </template>
          Logout
        </a-button>
        <ThemeToggle @change="handleThemeChange" />
      </div>
    </header>

    <main class="editor-main">
      <div v-if="loading" class="editor-state">
        <a-spin />
      </div>
      <a-result
        v-else-if="loadError !== null"
        :sub-title="loadError"
        class="editor-state"
        status="error"
        title="Unable to load document"
      >
        <template #extra>
          <a-button type="primary" @click="loadProjectDocument">Retry</a-button>
        </template>
      </a-result>
      <MindEditor v-else-if="loadedDocument" :document="loadedDocument" @export-png="handleExportPng" @save="saveDocument" />
    </main>
  </div>
</template>

<style scoped>
.editor-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.editor-main {
  min-height: calc(100vh - 65px);
}

.editor-state {
  display: grid;
  min-height: calc(100vh - 65px);
  place-items: center;
}
</style>
