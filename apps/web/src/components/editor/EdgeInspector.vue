<script setup lang="ts">
import { DeleteOutlined } from '@ant-design/icons-vue'
import type { MindEdgeComponent } from '@mind-x/shared'
import { EDGE_COMPONENT_OPTIONS } from './edgeComponents'

defineProps<{
  component: MindEdgeComponent
}>()

const emit = defineEmits<{
  componentChange: [component: MindEdgeComponent]
  delete: []
}>()

function onComponentChange(component: MindEdgeComponent): void {
  emit('componentChange', component)
}
</script>

<template>
  <section class="edge-inspector" aria-label="Edge inspector">
    <label id="edge-inspector-component-label" class="edge-inspector__label">Edge component</label>
    <a-radio-group
      class="edge-inspector__components"
      aria-labelledby="edge-inspector-component-label"
      :value="component"
      button-style="solid"
      size="small"
      @update:value="onComponentChange"
    >
      <a-radio-button v-for="option in EDGE_COMPONENT_OPTIONS" :key="option.value" :value="option.value">
        {{ option.label }}
      </a-radio-button>
    </a-radio-group>

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

.edge-inspector__label {
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 650;
  line-height: 1.2;
}

.edge-inspector__components {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.edge-inspector__components :deep(.ant-radio-button-wrapper) {
  width: 100%;
  border-inline-start-width: 1px;
  border-radius: 6px;
  text-align: center;
}

.edge-inspector__components :deep(.ant-radio-button-wrapper::before) {
  display: none;
}
</style>
