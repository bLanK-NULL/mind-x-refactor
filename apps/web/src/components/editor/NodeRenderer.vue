<script setup lang="ts">
import type { MindNode, Point } from '@mind-x/shared'
import TopicNode from './TopicNode.vue'

defineProps<{
  nodes: MindNode[]
  selectedNodeIds: string[]
}>()

const emit = defineEmits<{
  drag: [nodeId: string, delta: Point]
  edit: [nodeId: string, title: string]
  select: [nodeId: string]
}>()
</script>

<template>
  <TopicNode
    v-for="node in nodes"
    :key="node.id"
    :node="node"
    :selected="selectedNodeIds.includes(node.id)"
    @drag="(nodeId, delta) => emit('drag', nodeId, delta)"
    @edit="(nodeId, title) => emit('edit', nodeId, title)"
    @select="emit('select', $event)"
  />
</template>
