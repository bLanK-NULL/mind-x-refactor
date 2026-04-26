<script setup lang="ts">
import type { MindDocument } from '@mind-x/shared'
import { ArrowLeftOutlined, LogoutOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MindEditor from '@/components/editor/MindEditor.vue'
import { getApiErrorMessage } from '@/api/client'
import { exportDocumentAsPng } from '@/services/exportPng'
import { subscribeCrossTabEvents, type CrossTabEvent } from '@/services/crossTab'
import { getLocalDraft, loadServerDocument, saveLocalDraft, saveServerDocument } from '@/services/syncService'
import { useAuthStore } from '@/stores/auth'
import { useEditorStore } from '@/stores/editor'

const auth = useAuthStore()
const editor = useEditorStore()
const route = useRoute()
const router = useRouter()
const projectId = computed(() => String(route.params.id ?? ''))
const loadedDocument = ref<MindDocument | null>(null)
const loading = ref(false)
const loadError = ref<string | null>(null)
const saving = ref(false)
const exporting = ref(false)

let isEditorViewMounted = false
let loadSequence = 0
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
  const requestId = ++loadSequence
  loading.value = true
  loadError.value = null
  loadedDocument.value = null
  editor.$reset()

  try {
    const serverDocument = await loadServerDocument(id)
    const draft = await getLocalDraft(id)
    if (!isEditorViewMounted || requestId !== loadSequence) {
      return
    }

    loadedDocument.value = draft?.document ?? serverDocument
    await nextTick()
    if (!isEditorViewMounted || requestId !== loadSequence) {
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
    if (isEditorViewMounted && requestId === loadSequence) {
      loadError.value = getApiErrorMessage(error)
    }
  } finally {
    if (isEditorViewMounted && requestId === loadSequence) {
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

async function saveDocument(): Promise<void> {
  if (!editor.document || saving.value) {
    return
  }

  const id = projectId.value
  const document = editor.document
  saving.value = true
  try {
    const savedDocument = await saveServerDocument(id, document)
    if (!isEditorViewMounted || id !== projectId.value) {
      return
    }

    loadedDocument.value = savedDocument
    editor.load(savedDocument)
    message.success('Document saved')
  } catch (error) {
    try {
      await saveLocalDraft(id, document)
      message.warning('Saved local draft')
    } catch {
      message.error(getApiErrorMessage(error))
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
