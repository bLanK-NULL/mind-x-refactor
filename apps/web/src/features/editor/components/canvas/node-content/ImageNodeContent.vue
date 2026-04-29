<script setup lang="ts">
import type { MindNode } from '@mind-x/shared'
import { computed } from 'vue'

type ImageNodeModel = Extract<MindNode, { type: 'image' }>

const props = defineProps<{
  node: ImageNodeModel
}>()

const objectFit = computed(() => props.node.contentStyle.objectFit)
</script>

<template>
  <div class="image-node__content">
    <img
      class="image-node__image"
      :alt="node.data.alt ?? ''"
      draggable="false"
      :src="node.data.url"
      :style="{ objectFit }"
      @dragstart.prevent
    />
  </div>
</template>

<style scoped>
.image-node__content {
  display: flex;
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  justify-content: center;
}

.image-node__image {
  width: 100%;
  height: 100%;
  min-height: 0;
  border-radius: 4px;
}
</style>
