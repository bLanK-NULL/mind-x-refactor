<script setup lang="ts">
import type { ThemeName } from '@mind-x/shared'
import { BulbOutlined } from '@ant-design/icons-vue'
import { computed } from 'vue'
import { THEME_LABELS, THEME_NAMES, isThemeName, useTheme } from '@/composables/useTheme'

const emit = defineEmits<{
  change: [theme: ThemeName]
}>()

const { currentTheme, setTheme } = useTheme()
const selectedKeys = computed(() => [currentTheme.value])
const currentThemeLabel = computed(() => THEME_LABELS[currentTheme.value])
const label = computed(() => `Current theme: ${currentThemeLabel.value}`)

function onThemeMenuClick(event: { key: string | number }): void {
  if (!isThemeName(event.key)) {
    return
  }

  emit('change', setTheme(event.key))
}
</script>

<template>
  <a-dropdown :trigger="['click']">
    <a-button :aria-label="label" :title="label" shape="circle" type="text">
      <template #icon>
        <BulbOutlined />
      </template>
    </a-button>

    <template #overlay>
      <a-menu :selected-keys="selectedKeys" @click="onThemeMenuClick">
        <a-menu-item v-for="themeName in THEME_NAMES" :key="themeName">
          {{ THEME_LABELS[themeName] }}
        </a-menu-item>
      </a-menu>
    </template>
  </a-dropdown>
</template>
