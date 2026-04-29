<script setup lang="ts">
import type { NodeShellStyle } from '@mind-x/shared'
import ColorTokenPicker from './ColorTokenPicker.vue'
import StyleField from './StyleField.vue'

defineProps<{
  style: NodeShellStyle
}>()

const emit = defineEmits<{
  styleChange: [stylePatch: Partial<NodeShellStyle>]
}>()

function emitToneChange(tone: unknown): void {
  emit('styleChange', { tone: tone as NodeShellStyle['tone'] })
}

function emitShapeChange(shape: unknown): void {
  emit('styleChange', { shape: shape as NodeShellStyle['shape'] })
}

function emitBorderStyleChange(borderStyle: unknown): void {
  emit('styleChange', { borderStyle: borderStyle as NodeShellStyle['borderStyle'] })
}

function emitShadowLevelChange(shadowLevel: unknown): void {
  emit('styleChange', { shadowLevel: shadowLevel as NodeShellStyle['shadowLevel'] })
}
</script>

<template>
  <section class="node-shell-style-inspector" aria-label="Node shell style inspector">
    <StyleField label="Color">
      <ColorTokenPicker
        :value="style.colorToken"
        @change="(colorToken) => emit('styleChange', { colorToken })"
      />
    </StyleField>
    <StyleField label="Tone">
      <a-segmented
        :options="['soft', 'solid', 'outline']"
        :value="style.tone"
        size="small"
        @change="emitToneChange"
      />
    </StyleField>
    <StyleField label="Shape">
      <a-select
        :value="style.shape"
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
        :value="style.borderStyle"
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
        :value="style.shadowLevel"
        size="small"
        @change="emitShadowLevelChange"
      />
    </StyleField>
  </section>
</template>

<style scoped>
.node-shell-style-inspector {
  display: grid;
  gap: 10px;
}
</style>
