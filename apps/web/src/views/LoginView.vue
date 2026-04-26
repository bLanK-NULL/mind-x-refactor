<script setup lang="ts">
import { LockOutlined, UserOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { sanitizeRedirect } from '@/router/redirect'
import { useAuthStore } from '@/stores/auth'

type LoginFormState = {
  password: string
  username: string
}

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const formState = reactive<LoginFormState>({
  password: '',
  username: ''
})

async function submitLogin(): Promise<void> {
  try {
    await auth.login(formState.username, formState.password)
    await router.replace(sanitizeRedirect(route.query.redirect))
  } catch {
    message.error(auth.error ?? 'Unable to sign in')
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-panel" aria-labelledby="login-title">
      <div class="login-panel__header">
        <h1 id="login-title">Mind X</h1>
      </div>

      <a-form :model="formState" layout="vertical" @finish="submitLogin">
        <a-form-item
          label="Username"
          name="username"
          :rules="[{ required: true, message: 'Enter username' }]"
        >
          <a-input v-model:value="formState.username" autocomplete="username" size="large">
            <template #prefix>
              <UserOutlined />
            </template>
          </a-input>
        </a-form-item>

        <a-form-item
          label="Password"
          name="password"
          :rules="[{ required: true, message: 'Enter password' }]"
        >
          <a-input-password
            v-model:value="formState.password"
            autocomplete="current-password"
            size="large"
          >
            <template #prefix>
              <LockOutlined />
            </template>
          </a-input-password>
        </a-form-item>

        <a-button block html-type="submit" :loading="auth.loading" size="large" type="primary">
          Sign in
        </a-button>
      </a-form>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 24px;
  background: var(--color-bg-soft);
}

.login-panel {
  width: min(100%, 380px);
  padding: 28px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  box-shadow: var(--shadow-panel);
}

.login-panel__header {
  margin-bottom: 24px;
}

.login-panel h1 {
  margin: 0;
  color: var(--color-text-strong);
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
}

@media (max-width: 420px) {
  .login-page {
    align-items: start;
    padding: 16px;
  }

  .login-panel {
    padding: 20px;
  }
}
</style>
