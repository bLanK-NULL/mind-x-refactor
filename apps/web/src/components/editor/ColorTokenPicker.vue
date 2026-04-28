<script setup lang="ts">
import { OBJECT_COLOR_TOKENS, type ObjectColorToken } from '@mind-x/shared'

defineProps<{
  value: ObjectColorToken
}>()

const emit = defineEmits<{
  change: [value: ObjectColorToken]
}>()

const COLOR_LABELS: Record<ObjectColorToken, string> = {
  danger: 'Danger',
  default: 'Default',
  info: 'Info',
  primary: 'Primary',
  purple: 'Purple',
  success: 'Success',
  warning: 'Warning'
}

function onChange(value: ObjectColorToken): void {
  emit('change', value)
}
</script>

<template>
  <a-select :value="value" size="small" @change="onChange">
    <a-select-option v-for="token in OBJECT_COLOR_TOKENS" :key="token" :value="token">
      {{ COLOR_LABELS[token] }}
    </a-select-option>
  </a-select>
</template>
