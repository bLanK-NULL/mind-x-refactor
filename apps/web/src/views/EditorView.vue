<script setup lang="ts">
import { ArrowLeftOutlined, LogoutOutlined } from '@ant-design/icons-vue'
import { createEmptyDocument } from '@mind-x/mind-engine'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MindEditor from '@/components/editor/MindEditor.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const projectId = computed(() => String(route.params.id ?? ''))
const provisionalDocument = computed(() =>
  createEmptyDocument({
    projectId: projectId.value || 'unknown-project',
    title: 'Untitled mind map',
    now: new Date().toISOString()
  })
)

async function goBack(): Promise<void> {
  await router.push('/projects')
}

async function logout(): Promise<void> {
  auth.logout()
  await router.replace('/login')
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
      <MindEditor :document="provisionalDocument" @save="() => undefined" />
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
</style>
