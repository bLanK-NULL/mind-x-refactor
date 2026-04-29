<script setup lang="ts">
import type { MindNode } from '@mind-x/shared'

type AttachmentNodeModel = Extract<MindNode, { type: 'attachment' }>

defineProps<{
  node: AttachmentNodeModel
}>()
</script>

<template>
  <div class="attachment-node__content">
    <a
      class="attachment-node__link"
      draggable="false"
      :href="node.data.url"
      rel="noopener noreferrer"
      target="_blank"
      @click.prevent
      @dragstart.prevent
    >
      <span aria-hidden="true" class="attachment-node__icon">FILE</span>
      <span class="attachment-node__meta">
        <span class="attachment-node__name">{{ node.data.fileName }}</span>
        <span v-if="node.data.fileSizeLabel" class="attachment-node__size">{{ node.data.fileSizeLabel }}</span>
        <span class="attachment-node__url">{{ node.data.url }}</span>
      </span>
    </a>
  </div>
</template>

<style scoped>
.attachment-node__content {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.attachment-node__link {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  color: inherit;
  text-decoration: none;
}

.attachment-node__icon {
  flex: 0 0 auto;
  border-radius: 3px;
  color: var(--color-text-subtle);
  font-size: 10px;
  font-weight: 750;
  line-height: 1;
}

.attachment-node__meta {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.attachment-node__name {
  overflow: hidden;
  font-size: 14px;
  font-weight: 650;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-node__size,
.attachment-node__url {
  overflow: hidden;
  color: var(--color-text-subtle);
  font-size: 11px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
