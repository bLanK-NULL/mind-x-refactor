<script setup lang="ts">
import { DeleteOutlined } from '@ant-design/icons-vue'
import type { EdgeStyle } from '@mind-x/shared'
import ColorTokenPicker from './ColorTokenPicker.vue'
import StyleField from './StyleField.vue'

defineProps<{
  style: EdgeStyle
}>()

const emit = defineEmits<{
  styleChange: [stylePatch: Partial<EdgeStyle>]
  delete: []
}>()

function emitLinePatternChange(linePattern: unknown): void {
  emit('styleChange', { linePattern: linePattern as EdgeStyle['linePattern'] })
}

function emitArrowChange(arrow: unknown): void {
  emit('styleChange', { arrow: arrow as EdgeStyle['arrow'] })
}

function emitWidthChange(width: unknown): void {
  emit('styleChange', { width: width as EdgeStyle['width'] })
}

function emitRoutingChange(routing: unknown): void {
  emit('styleChange', { routing: routing as EdgeStyle['routing'] })
}
</script>

<template>
  <section class="edge-inspector" aria-label="Edge inspector">
    <StyleField label="Color">
      <ColorTokenPicker :value="style.colorToken" @change="(colorToken) => emit('styleChange', { colorToken })" />
    </StyleField>
    <StyleField label="Line">
      <a-select
        :value="style.linePattern"
        size="small"
        @change="emitLinePatternChange"
      >
        <a-select-option value="solid">Solid</a-select-option>
        <a-select-option value="dashed">Dashed</a-select-option>
        <a-select-option value="dotted">Dotted</a-select-option>
      </a-select>
    </StyleField>
    <StyleField label="Arrow">
      <a-segmented
        :options="['none', 'end']"
        :value="style.arrow"
        size="small"
        @change="emitArrowChange"
      />
    </StyleField>
    <StyleField label="Width">
      <a-segmented
        :options="['thin', 'regular', 'thick']"
        :value="style.width"
        size="small"
        @change="emitWidthChange"
      />
    </StyleField>
    <StyleField label="Routing">
      <a-select
        :value="style.routing"
        size="small"
        @change="emitRoutingChange"
      >
        <a-select-option value="curved">Curved</a-select-option>
        <a-select-option value="straight">Straight</a-select-option>
        <a-select-option value="elbow">Elbow</a-select-option>
      </a-select>
    </StyleField>

    <a-button block danger type="text" @click="emit('delete')">
      <template #icon>
        <DeleteOutlined />
      </template>
      Delete edge
    </a-button>
  </section>
</template>

<style scoped>
.edge-inspector {
  display: grid;
  gap: 10px;
}
</style>
