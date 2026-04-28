<script setup lang="ts">
import type { MindNode, Point } from '@mind-x/shared'
import type { Component } from 'vue'
import BaseNode from './BaseNode.vue'
import AttachmentNodeContent from './node-content/AttachmentNodeContent.vue'
import CodeNodeContent from './node-content/CodeNodeContent.vue'
import ImageNodeContent from './node-content/ImageNodeContent.vue'
import LinkNodeContent from './node-content/LinkNodeContent.vue'
import TaskNodeContent from './node-content/TaskNodeContent.vue'
import TopicNodeContent from './node-content/TopicNodeContent.vue'

defineProps<{
  nodes: MindNode[]
  selectedNodeIds: string[]
}>()

const emit = defineEmits<{
  cancelEdit: [nodeId: string]
  drag: [nodeId: string, delta: Point]
  dragEnd: []
  editCommit: [nodeId: string, dataPatch: Record<string, unknown>]
  resize: [nodeId: string, delta: { width: number; height: number }]
  resizeEnd: []
  select: [nodeId: string]
}>()

const contentComponentByType = {
  attachment: AttachmentNodeContent,
  code: CodeNodeContent,
  image: ImageNodeContent,
  link: LinkNodeContent,
  task: TaskNodeContent,
  topic: TopicNodeContent
} satisfies Record<MindNode['type'], Component>

function getContentComponent(node: MindNode): Component {
  return contentComponentByType[node.type]
}

function isDataPatch(payload: unknown): payload is Record<string, unknown> {
  return !!payload && typeof payload === 'object' && !Array.isArray(payload)
}

function onContentCommit(node: MindNode, payload: unknown, finishEdit: (payload: unknown) => void): void {
  if (node.type === 'topic' && typeof payload === 'string') {
    const title = payload
    finishEdit(title)
    emit('editCommit', node.id, { title })
    return
  }

  if (isDataPatch(payload)) {
    const dataPatch = payload
    finishEdit(dataPatch)
    emit('editCommit', node.id, dataPatch)
  }
}

function handleContentCommit(node: MindNode, finishEdit: (payload: unknown) => void, payload: unknown): void {
  onContentCommit(node, payload, finishEdit)
}
</script>

<template>
  <template v-for="node in nodes" :key="node.id">
    <BaseNode
      :node="node"
      :selected="selectedNodeIds.includes(node.id)"
      @drag="(nodeId, delta) => emit('drag', nodeId, delta)"
      @drag-end="emit('dragEnd')"
      @cancel-edit="emit('cancelEdit', $event)"
      @resize="(nodeId, delta) => emit('resize', nodeId, delta)"
      @resize-end="emit('resizeEnd')"
      @select="emit('select', $event)"
    >
      <template #default="{ editing, commitEdit, cancelEdit }">
        <component
          :is="getContentComponent(node)"
          :editing="editing"
          :node="node"
          @cancel="cancelEdit"
          @commit="handleContentCommit(node, commitEdit, $event)"
        />
      </template>
    </BaseNode>
  </template>
</template>
