<script setup lang="ts">
import type { MindNode, Point } from '@mind-x/shared'
import type { PropType } from 'vue'
import { defineComponent, h } from 'vue'
import BaseNode from './BaseNode.vue'
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

const NodeFallbackContent = defineComponent({
  name: 'NodeFallbackContent',
  props: {
    node: {
      required: true,
      type: Object as PropType<MindNode>
    }
  },
  setup(props) {
    return () => h('span', { class: 'node-fallback' }, props.node.type)
  }
})

const contentComponentByType = {
  attachment: NodeFallbackContent,
  code: NodeFallbackContent,
  image: NodeFallbackContent,
  link: NodeFallbackContent,
  task: NodeFallbackContent,
  topic: TopicNodeContent
} satisfies Record<MindNode['type'], typeof NodeFallbackContent | typeof TopicNodeContent>

function getContentComponent(node: MindNode): typeof NodeFallbackContent | typeof TopicNodeContent {
  return contentComponentByType[node.type]
}

function onContentCommit(node: MindNode, title: unknown, finishEdit: (payload: unknown) => void): void {
  if (node.type !== 'topic' || typeof title !== 'string') {
    return
  }

  finishEdit(title)
  emit('editCommit', node.id, { title })
}

function handleContentCommit(node: MindNode, finishEdit: (payload: unknown) => void, title: unknown): void {
  onContentCommit(node, title, finishEdit)
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
