<script setup lang="ts">
import type { TopicNodeStyle } from '@mind-x/shared'
import ColorTokenPicker from './ColorTokenPicker.vue'
import StyleField from './StyleField.vue'

defineProps<{
  style: TopicNodeStyle
}>()

const emit = defineEmits<{
  styleChange: [stylePatch: Partial<TopicNodeStyle>]
}>()

function emitToneChange(tone: unknown): void {
  emit('styleChange', { tone: tone as TopicNodeStyle['tone'] })
}

function emitShapeChange(shape: unknown): void {
  emit('styleChange', { shape: shape as TopicNodeStyle['shape'] })
}

function emitSizeChange(size: unknown): void {
  emit('styleChange', { size: size as TopicNodeStyle['size'] })
}

function emitBorderStyleChange(borderStyle: unknown): void {
  emit('styleChange', { borderStyle: borderStyle as TopicNodeStyle['borderStyle'] })
}

function emitShadowLevelChange(shadowLevel: unknown): void {
  emit('styleChange', { shadowLevel: shadowLevel as TopicNodeStyle['shadowLevel'] })
}

function emitTextWeightChange(textWeight: unknown): void {
  emit('styleChange', { textWeight: textWeight as TopicNodeStyle['textWeight'] })
}
</script>

<template>
  <section class="node-inspector" aria-label="Node inspector">
    <StyleField label="Color">
      <ColorTokenPicker :value="style.colorToken" @change="(colorToken) => emit('styleChange', { colorToken })" />
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
    <StyleField label="Size">
      <a-segmented
        :options="['sm', 'md', 'lg']"
        :value="style.size"
        size="small"
        @change="emitSizeChange"
      />
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
    <StyleField label="Text">
      <a-select
        :value="style.textWeight"
        size="small"
        @change="emitTextWeightChange"
      >
        <a-select-option value="regular">Regular</a-select-option>
        <a-select-option value="medium">Medium</a-select-option>
        <a-select-option value="bold">Bold</a-select-option>
      </a-select>
    </StyleField>
  </section>
</template>

<style scoped>
.node-inspector {
  display: grid;
  gap: 10px;
}
</style>
