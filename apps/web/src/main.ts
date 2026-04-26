import Antd from 'ant-design-vue'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import 'ant-design-vue/dist/reset.css'
import App from './App.vue'
import { setUnauthorizedHandler } from './api/client'
import router from './router'
import { useAuthStore } from './stores/auth'
import './styles/global.css'

const pinia = createPinia()

setUnauthorizedHandler(() => {
  useAuthStore(pinia).logout()
})

createApp(App).use(pinia).use(router).use(Antd).mount('#app')
