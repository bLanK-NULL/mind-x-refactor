<script setup lang="ts">
import type { MindNode, NodeShellStyle } from '@mind-x/shared'
import type { Component } from 'vue'
import NodeShellStyleInspector from './NodeShellStyleInspector.vue'
import AttachmentNodeInspector from './node-inspectors/AttachmentNodeInspector.vue'
import CodeNodeInspector from './node-inspectors/CodeNodeInspector.vue'
import ImageNodeInspector from './node-inspectors/ImageNodeInspector.vue'
import LinkNodeInspector from './node-inspectors/LinkNodeInspector.vue'
import TaskNodeInspector from './node-inspectors/TaskNodeInspector.vue'
import TopicNodeInspector from './node-inspectors/TopicNodeInspector.vue'

defineProps<{
  node: MindNode
}>()

const emit = defineEmits<{
  contentChange: [dataPatch: Record<string, unknown>]
  contentStyleChange: [stylePatch: Record<string, unknown>]
  shellStyleChange: [stylePatch: Partial<NodeShellStyle>]
}>()

const inspectorComponentByType = {
  attachment: AttachmentNodeInspector,
  code: CodeNodeInspector,
  image: ImageNodeInspector,
  link: LinkNodeInspector,
  task: TaskNodeInspector,
  topic: TopicNodeInspector
} satisfies Record<MindNode['type'], Component>

function getInspectorComponent(node: MindNode): Component {
  return inspectorComponentByType[node.type]
}
</script>

<template>
  <section class="node-inspector" aria-label="Node inspector">
    <NodeShellStyleInspector
      :style="node.shellStyle"
      @style-change="(stylePatch: Partial<NodeShellStyle>) => emit('shellStyleChange', stylePatch)"
    />
    <component
      :is="getInspectorComponent(node)"
      :node="node"
      @content-change="(dataPatch: Record<string, unknown>) => emit('contentChange', dataPatch)"
      @content-style-change="(stylePatch: Record<string, unknown>) => emit('contentStyleChange', stylePatch)"
    />
  </section>
</template>

<style scoped>
.node-inspector {
  display: grid;
  gap: 10px;
}
</style>
