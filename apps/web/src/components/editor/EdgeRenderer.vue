<script setup lang="ts">
import type { MindEdge, MindNode } from '@mind-x/shared'
import { computed } from 'vue'

const props = defineProps<{
  edges: MindEdge[]
  nodes: MindNode[]
}>()

const DEFAULT_WIDTH = 180
const DEFAULT_HEIGHT = 56

const nodeById = computed(() => new Map(props.nodes.map((node) => [node.id, node])))

function getNodeCenter(node: MindNode) {
  return {
    x: node.position.x + (node.size?.width ?? DEFAULT_WIDTH) / 2,
    y: node.position.y + (node.size?.height ?? DEFAULT_HEIGHT) / 2
  }
}

function getPath(edge: MindEdge): string | null {
  const source = nodeById.value.get(edge.source)
  const target = nodeById.value.get(edge.target)
  if (!source || !target) {
    return null
  }

  const sourceCenter = getNodeCenter(source)
  const targetCenter = getNodeCenter(target)
  const sourceWidth = source.size?.width ?? DEFAULT_WIDTH
  const targetWidth = target.size?.width ?? DEFAULT_WIDTH
  const forward = targetCenter.x >= sourceCenter.x
  const startX = sourceCenter.x + (forward ? sourceWidth / 2 : -sourceWidth / 2)
  const endX = targetCenter.x + (forward ? -targetWidth / 2 : targetWidth / 2)
  const startY = sourceCenter.y
  const endY = targetCenter.y
  const curve = Math.max(64, Math.abs(endX - startX) * 0.45)
  const c1x = startX + (forward ? curve : -curve)
  const c2x = endX + (forward ? -curve : curve)

  return `M ${startX} ${startY} C ${c1x} ${startY}, ${c2x} ${endY}, ${endX} ${endY}`
}
</script>

<template>
  <svg class="edge-renderer" aria-hidden="true">
    <template v-for="edge in edges" :key="edge.id">
      <path v-if="getPath(edge)" class="edge-renderer__path" :d="getPath(edge) ?? undefined" />
    </template>
  </svg>
</template>

<style scoped>
.edge-renderer {
  position: absolute;
  top: 0;
  left: 0;
  width: 1px;
  height: 1px;
  overflow: visible;
  pointer-events: none;
}

.edge-renderer__path {
  fill: none;
  stroke: #64748b;
  stroke-linecap: round;
  stroke-width: 2;
}
</style>
