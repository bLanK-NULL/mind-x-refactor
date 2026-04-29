<script setup lang="ts">
import type { MindNode } from '@mind-x/shared'

type LinkNodeModel = Extract<MindNode, { type: 'link' }>

defineProps<{
  node: LinkNodeModel
}>()
</script>

<template>
  <div class="link-node__content">
    <a
      class="link-node__anchor"
      draggable="false"
      :href="node.data.url"
      rel="noopener noreferrer"
      target="_blank"
      @click.prevent
      @dragstart.prevent
    >
      <span class="link-node__title">{{ node.data.title }}</span>
      <span class="link-node__url">{{ node.data.url }}</span>
    </a>
  </div>
</template>

<style scoped>
.link-node__content {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.link-node__anchor {
  display: flex;
  min-width: 0;
  flex-direction: column;
  color: inherit;
  text-decoration: none;
}

.link-node__title {
  overflow: hidden;
  font-size: 14px;
  font-weight: 650;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.link-node__url {
  overflow: hidden;
  color: var(--color-text-subtle);
  font-size: 11px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
