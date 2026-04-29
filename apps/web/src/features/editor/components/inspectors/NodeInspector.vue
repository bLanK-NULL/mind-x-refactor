<script setup lang="ts">
import type { MindNode, NodeShellStyle } from '@mind-x/shared'
import type { Component } from 'vue'
import ColorTokenPicker from './ColorTokenPicker.vue'
import StyleField from './StyleField.vue'
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

function emitToneChange(tone: unknown): void {
  emit('shellStyleChange', { tone: tone as NodeShellStyle['tone'] })
}

function emitShapeChange(shape: unknown): void {
  emit('shellStyleChange', { shape: shape as NodeShellStyle['shape'] })
}

function emitBorderStyleChange(borderStyle: unknown): void {
  emit('shellStyleChange', { borderStyle: borderStyle as NodeShellStyle['borderStyle'] })
}

function emitShadowLevelChange(shadowLevel: unknown): void {
  emit('shellStyleChange', { shadowLevel: shadowLevel as NodeShellStyle['shadowLevel'] })
}
</script>

<template>
  <section class="node-inspector" aria-label="Node inspector">
    <StyleField label="Color">
      <ColorTokenPicker
        :value="node.shellStyle.colorToken"
        @change="(colorToken) => emit('shellStyleChange', { colorToken })"
      />
    </StyleField>
    <StyleField label="Tone">
      <a-segmented
        :options="['soft', 'solid', 'outline']"
        :value="node.shellStyle.tone"
        size="small"
        @change="emitToneChange"
      />
    </StyleField>
    <StyleField label="Shape">
      <a-select
        :value="node.shellStyle.shape"
        size="small"
        @change="emitShapeChange"
      >
        <a-select-option value="rounded">Rounded</a-select-option>
        <a-select-option value="rectangle">Rectangle</a-select-option>
        <a-select-option value="pill">Pill</a-select-option>
      </a-select>
    </StyleField>
    <StyleField label="Border">
      <a-select
        :value="node.shellStyle.borderStyle"
        size="small"
        @change="emitBorderStyleChange"
      >
        <a-select-option value="none">None</a-select-option>
        <a-select-option value="solid">Solid</a-select-option>
        <a-select-option value="dashed">Dashed</a-select-option>
      </a-select>
    </StyleField>
    <StyleField label="Shadow">
      <a-segmented
        :options="['none', 'sm', 'md']"
        :value="node.shellStyle.shadowLevel"
        size="small"
        @change="emitShadowLevelChange"
      />
    </StyleField>
    <a-divider class="node-inspector__divider" />
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

.node-inspector__divider {
  margin: 2px 0;
}
</style>
