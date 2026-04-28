import Antd from 'ant-design-vue'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import 'ant-design-vue/dist/reset.css'
import App from './App.vue'
import { setUnauthorizedHandler } from '@/shared/api/client'
import { initializeTheme } from '@/shared/composables/theme/useTheme'
import router from './router'
import { useAuthStore } from '@/features/auth/stores/auth'
import '@/shared/styles/global.css'

const pinia = createPinia()

initializeTheme()

setUnauthorizedHandler(() => {
  useAuthStore(pinia).logout()
})

createApp(App).use(pinia).use(router).use(Antd).mount('#app')
