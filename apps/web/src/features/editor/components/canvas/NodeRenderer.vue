<script setup lang="ts">
import type { MindNode, Point } from '@mind-x/shared'
import BaseNode from './BaseNode.vue'
import TopicNodeContent from './node-content/TopicNodeContent.vue'

type TopicNodeModel = Extract<MindNode, { type: 'topic' }>

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

const contentComponentByType: Record<MindNode['type'], typeof TopicNodeContent> = {
  attachment: TopicNodeContent,
  code: TopicNodeContent,
  image: TopicNodeContent,
  link: TopicNodeContent,
  task: TopicNodeContent,
  topic: TopicNodeContent
}

function getContentComponent(node: MindNode): typeof TopicNodeContent {
  return contentComponentByType[node.type]
}

function getTopicContentNode(node: MindNode): TopicNodeModel {
  return node as TopicNodeModel
}

function onEditCommit(nodeId: string, title: unknown): void {
  if (typeof title !== 'string') {
    return
  }

  emit('editCommit', nodeId, { title })
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
      @edit-commit="onEditCommit"
      @resize="(nodeId, delta) => emit('resize', nodeId, delta)"
      @resize-end="emit('resizeEnd')"
      @select="emit('select', $event)"
    >
      <template #default="{ editing, commitEdit, cancelEdit }">
        <component
          :is="getContentComponent(node)"
          :editing="editing"
          :node="getTopicContentNode(node)"
          @cancel="cancelEdit"
          @commit="commitEdit"
        />
      </template>
    </BaseNode>
  </template>
</template>
