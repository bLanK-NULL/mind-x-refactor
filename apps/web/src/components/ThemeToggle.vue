<script setup lang="ts">
import type { ThemeName } from '@mind-x/shared'
import { BulbOutlined } from '@ant-design/icons-vue'
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'

const emit = defineEmits<{
  change: [theme: ThemeName]
}>()

const { currentTheme, toggleTheme } = useTheme()
const nextTheme = computed<ThemeName>(() => (currentTheme.value === 'dark' ? 'light' : 'dark'))
const label = computed(() => `Switch to ${nextTheme.value} theme`)

function onToggleTheme(): void {
  emit('change', toggleTheme())
}
</script>

<template>
  <a-tooltip :title="label">
    <a-button :aria-label="label" shape="circle" type="text" @click="onToggleTheme">
      <template #icon>
        <BulbOutlined />
      </template>
    </a-button>
  </a-tooltip>
</template>
