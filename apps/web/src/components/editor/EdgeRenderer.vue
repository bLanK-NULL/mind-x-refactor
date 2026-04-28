<script lang="ts">
let edgeRendererInstanceCounter = 0
</script>

<script setup lang="ts">
import type { MindEdge, MindNode } from '@mind-x/shared'
import { computed, ref } from 'vue'
import { createEdgePath, getEdgeMarkerEnd, resolveEdgeStyle } from './objectStyles'

const props = defineProps<{
  edges: MindEdge[]
  nodes: MindNode[]
  selectedEdgeId?: string | null
}>()

const emit = defineEmits<{
  select: [edgeId: string]
}>()

const DEFAULT_WIDTH = 180
const DEFAULT_HEIGHT = 56
const EDGE_PADDING = 32
const markerIdPrefix = `edge-renderer-${edgeRendererInstanceCounter++}`
const edgeArrowMarkerId = `${markerIdPrefix}-arrow`
const selectedEdgeArrowMarkerId = `${markerIdPrefix}-arrow-selected`

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

const hoveredEdgeId = ref<string | null>(null)

function isEdgeActive(edge: MindEdge): boolean {
  return props.selectedEdgeId === edge.id || hoveredEdgeId.value === edge.id
}

function getVisiblePathClass(edge: MindEdge) {
  const resolved = resolveEdgeStyle(edge.style)
  return [
    ...resolved.classNames,
    {
      'edge-renderer__path--active': isEdgeActive(edge),
      'edge-renderer__path--selected': props.selectedEdgeId === edge.id
    }
  ]
}

function getVisiblePathStyle(edge: MindEdge) {
  return resolveEdgeStyle(edge.style).style
}

function getMarkerEnd(edge: MindEdge): string | undefined {
  const markerId = props.selectedEdgeId === edge.id ? selectedEdgeArrowMarkerId : edgeArrowMarkerId
  return getEdgeMarkerEnd(edge.style, markerId)
}

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

  return createEdgePath({
    endX,
    endY,
    forward,
    routing: edge.style.routing,
    startX,
    startY
  })
}
</script>

<template>
  <svg class="edge-renderer" aria-hidden="true" :style="edgeRendererStyle" :viewBox="edgeViewport.viewBox">
    <defs>
      <marker
        :id="edgeArrowMarkerId"
        markerHeight="8"
        markerUnits="strokeWidth"
        markerWidth="8"
        orient="auto"
        refX="7"
        refY="4"
        viewBox="0 0 8 8"
      >
        <path class="edge-renderer__marker" d="M 0 0 L 8 4 L 0 8 z" />
      </marker>
      <marker
        :id="selectedEdgeArrowMarkerId"
        markerHeight="8"
        markerUnits="strokeWidth"
        markerWidth="8"
        orient="auto"
        refX="7"
        refY="4"
        viewBox="0 0 8 8"
      >
        <path class="edge-renderer__marker edge-renderer__marker--selected" d="M 0 0 L 8 4 L 0 8 z" />
      </marker>
    </defs>

    <template v-for="edge in edges" :key="edge.id">
      <g v-if="getPath(edge)" data-editor-edge :data-editor-edge-id="edge.id">
        <path
          class="edge-renderer__hit-path"
          :d="getPath(edge) ?? undefined"
          @click.stop="emit('select', edge.id)"
          @pointerdown.stop
          @pointerenter="hoveredEdgeId = edge.id"
          @pointerleave="hoveredEdgeId = hoveredEdgeId === edge.id ? null : hoveredEdgeId"
        />
        <path
          :class="getVisiblePathClass(edge)"
          :d="getPath(edge) ?? undefined"
          :marker-end="getMarkerEnd(edge)"
          :style="getVisiblePathStyle(edge)"
        />
      </g>
    </template>
  </svg>
</template>

<style scoped>
.edge-renderer {
  position: absolute;
  overflow: visible;
  pointer-events: none;
}

.edge-renderer__hit-path {
  fill: none;
  pointer-events: stroke;
  stroke: transparent;
  stroke-linecap: round;
  stroke-width: 16;
}

.edge-renderer__path {
  fill: none;
  pointer-events: none;
  stroke: var(--edge-stroke);
  stroke-dasharray: var(--edge-dasharray);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: var(--edge-width);
  transition:
    stroke 120ms ease,
    stroke-width 120ms ease;
}

.edge-renderer__path--active {
  filter: drop-shadow(0 0 2px rgb(15 23 42 / 18%));
}

.edge-renderer__path--selected {
  stroke-width: calc(var(--edge-width) + 1px);
}

.edge-renderer__marker {
  fill: context-stroke;
}

.edge-renderer__marker--selected {
  fill: context-stroke;
}
</style>
