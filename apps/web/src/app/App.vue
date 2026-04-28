<script setup lang="ts">
import { useTheme } from '@/shared/composables/theme/useTheme'

const { antDesignTheme } = useTheme()
</script>

<template>
  <a-config-provider :theme="antDesignTheme">
    <RouterView />
  </a-config-provider>
</template>
