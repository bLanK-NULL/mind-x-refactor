<script setup lang="ts">
import type { MindNode } from '@mind-x/shared'
import { computed } from 'vue'

const props = defineProps<{
  nodes: MindNode[]
  selectedNodeIds: string[]
}>()

const selectedNodes = computed(() => {
  const selected = new Set(props.selectedNodeIds)
  return props.nodes.filter((node) => selected.has(node.id))
})

function selectionStyle(node: MindNode) {
  return {
    height: `${(node.size?.height ?? 56) + 8}px`,
    transform: `translate(${node.position.x - 4}px, ${node.position.y - 4}px)`,
    width: `${(node.size?.width ?? 180) + 8}px`
  }
}
</script>

<template>
  <div class="selection-layer" aria-hidden="true" data-html2canvas-ignore="true">
    <div v-for="node in selectedNodes" :key="node.id" class="selection-layer__box" :style="selectionStyle(node)" />
  </div>
</template>

<style scoped>
.selection-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.selection-layer__box {
  position: absolute;
  border: 1px dashed var(--color-primary);
  border-radius: 8px;
}
</style>
