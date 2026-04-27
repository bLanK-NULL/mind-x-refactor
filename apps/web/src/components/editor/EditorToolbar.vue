<script setup lang="ts">
import {
  DeleteOutlined,
  DownloadOutlined,
  PlusOutlined,
  RedoOutlined,
  SaveOutlined,
  UndoOutlined
} from '@ant-design/icons-vue'

defineProps<{
  canRedo: boolean
  canUndo: boolean
  dirty: boolean
  hasDocument: boolean
  hasDeletableSelection: boolean
  hasNodes: boolean
  hasSelection: boolean
}>()

const emit = defineEmits<{
  addChild: []
  addTopic: []
  delete: []
  exportPng: []
  redo: []
  save: []
  undo: []
}>()
</script>

<template>
  <div class="editor-toolbar" role="toolbar" aria-label="Editor toolbar">
    <a-tooltip title="Add topic">
      <a-button
        :disabled="!hasDocument || hasNodes"
        aria-label="Add topic"
        shape="circle"
        type="text"
        @click="emit('addTopic')"
      >
        <template #icon>
          <PlusOutlined />
        </template>
      </a-button>
    </a-tooltip>
    <a-tooltip title="Add child">
      <a-button
        :disabled="!hasDocument || !hasSelection"
        aria-label="Add child"
        shape="circle"
        type="text"
        @click="emit('addChild')"
      >
        <template #icon>
          <PlusOutlined />
        </template>
      </a-button>
    </a-tooltip>
    <a-divider class="editor-toolbar__divider" type="vertical" />
    <a-tooltip title="Undo">
      <a-button :disabled="!canUndo" aria-label="Undo" shape="circle" type="text" @click="emit('undo')">
        <template #icon>
          <UndoOutlined />
        </template>
      </a-button>
    </a-tooltip>
    <a-tooltip title="Redo">
      <a-button :disabled="!canRedo" aria-label="Redo" shape="circle" type="text" @click="emit('redo')">
        <template #icon>
          <RedoOutlined />
        </template>
      </a-button>
    </a-tooltip>
    <a-divider class="editor-toolbar__divider" type="vertical" />
    <a-tooltip title="Delete">
      <a-button
        :disabled="!hasDeletableSelection"
        aria-label="Delete"
        danger
        shape="circle"
        type="text"
        @click="emit('delete')"
      >
        <template #icon>
          <DeleteOutlined />
        </template>
      </a-button>
    </a-tooltip>
    <a-tooltip title="Save">
      <a-button :disabled="!hasDocument || !dirty" aria-label="Save" shape="circle" type="text" @click="emit('save')">
        <template #icon>
          <SaveOutlined />
        </template>
      </a-button>
    </a-tooltip>
    <a-tooltip title="Export PNG">
      <a-button
        :disabled="!hasDocument || !hasNodes"
        aria-label="Export PNG"
        shape="circle"
        type="text"
        @click="emit('exportPng')"
      >
        <template #icon>
          <DownloadOutlined />
        </template>
      </a-button>
    </a-tooltip>
  </div>
</template>

<style scoped>
.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  box-shadow: var(--shadow-toolbar);
}

.editor-toolbar__divider {
  height: 24px;
  margin-inline: 2px;
}
</style>
