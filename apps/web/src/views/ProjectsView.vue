<script setup lang="ts">
import { LogoutOutlined } from '@ant-design/icons-vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

async function logout(): Promise<void> {
  auth.logout()
  await router.replace('/login')
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <h1 class="app-title">Projects</h1>
      <a-button type="text" @click="logout">
        <template #icon>
          <LogoutOutlined />
        </template>
        Logout
      </a-button>
    </header>

    <main class="app-main">
      <section class="view-panel" aria-labelledby="projects-title">
        <div class="view-panel__body">
          <h2 id="projects-title" class="view-title">Project Center</h2>
          <p class="view-copy">Project list and creation tools will be added in the project center task.</p>
        </div>
      </section>
    </main>
  </div>
</template>
