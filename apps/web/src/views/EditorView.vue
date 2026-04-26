<script setup lang="ts">
import { ArrowLeftOutlined, LogoutOutlined } from '@ant-design/icons-vue'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const projectId = computed(() => String(route.params.id ?? ''))

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

    <main class="app-main">
      <section class="view-panel" aria-labelledby="editor-title">
        <div class="view-panel__body">
          <h2 id="editor-title" class="view-title">Mind Map Editor</h2>
          <p class="view-copy">Editor workspace placeholder for project {{ projectId }}.</p>
        </div>
      </section>
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
</style>
