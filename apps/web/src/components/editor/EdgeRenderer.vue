<script setup lang="ts">
import type { MindEdge, MindNode } from '@mind-x/shared'
import { computed } from 'vue'

const props = defineProps<{
  edges: MindEdge[]
  nodes: MindNode[]
}>()

const DEFAULT_WIDTH = 180
const DEFAULT_HEIGHT = 56
const EDGE_PADDING = 32

const nodeById = computed(() => new Map(props.nodes.map((node) => [node.id, node])))

const edgeViewport = computed(() => {
  if (props.nodes.length === 0) {
    return {
      height: 1,
      left: 0,
      top: 0,
      viewBox: '0 0 1 1',
      width: 1
    }
  }

  const minX = Math.min(0, ...props.nodes.map((node) => node.position.x))
  const minY = Math.min(0, ...props.nodes.map((node) => node.position.y))
  const maxX = Math.max(...props.nodes.map((node) => node.position.x + (node.size?.width ?? DEFAULT_WIDTH))) + EDGE_PADDING
  const maxY = Math.max(...props.nodes.map((node) => node.position.y + (node.size?.height ?? DEFAULT_HEIGHT))) + EDGE_PADDING
  const width = Math.max(1, maxX - minX)
  const height = Math.max(1, maxY - minY)

  return {
    height,
    left: minX,
    top: minY,
    viewBox: `0 0 ${width} ${height}`,
    width
  }
})

const edgeRendererStyle = computed(() => ({
  height: `${edgeViewport.value.height}px`,
  left: `${edgeViewport.value.left}px`,
  top: `${edgeViewport.value.top}px`,
  width: `${edgeViewport.value.width}px`
}))

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
  const offsetX = edgeViewport.value.left
  const offsetY = edgeViewport.value.top
  const sourceWidth = source.size?.width ?? DEFAULT_WIDTH
  const targetWidth = target.size?.width ?? DEFAULT_WIDTH
  const forward = targetCenter.x >= sourceCenter.x
  const startX = sourceCenter.x + (forward ? sourceWidth / 2 : -sourceWidth / 2) - offsetX
  const endX = targetCenter.x + (forward ? -targetWidth / 2 : targetWidth / 2) - offsetX
  const startY = sourceCenter.y - offsetY
  const endY = targetCenter.y - offsetY
  const curve = Math.max(64, Math.abs(endX - startX) * 0.45)
  const c1x = startX + (forward ? curve : -curve)
  const c2x = endX + (forward ? -curve : curve)

  return `M ${startX} ${startY} C ${c1x} ${startY}, ${c2x} ${endY}, ${endX} ${endY}`
}
</script>

<template>
  <svg class="edge-renderer" aria-hidden="true" :style="edgeRendererStyle" :viewBox="edgeViewport.viewBox">
    <template v-for="edge in edges" :key="edge.id">
      <path v-if="getPath(edge)" class="edge-renderer__path" :d="getPath(edge) ?? undefined" />
    </template>
  </svg>
</template>

<style scoped>
.edge-renderer {
  position: absolute;
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
