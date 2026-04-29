<script setup lang="ts">
import { PLAIN_TEXT_MAX_LENGTH, type ImageContentStyle, type MindNode } from '@mind-x/shared'
import { isValidOptionalPlainText, isValidWebUrl } from '@mind-x/mind-engine'
import StyleField from '../StyleField.vue'

type ImageNodeModel = Extract<MindNode, { type: 'image' }>

const props = defineProps<{
  node: ImageNodeModel
}>()

const emit = defineEmits<{
  contentChange: [dataPatch: Record<string, unknown>]
  contentStyleChange: [stylePatch: Record<string, unknown>]
}>()

function textValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement).value
}

function updateUrl(event: Event): void {
  const url = textValue(event).trim()
  if (isValidWebUrl(url)) {
    emit('contentChange', { url, alt: props.node.data.alt })
  }
}

function updateAlt(event: Event): void {
  const alt = textValue(event).trim()
  if (isValidOptionalPlainText(alt)) {
    emit('contentChange', { url: props.node.data.url, alt: alt || undefined })
  }
}

function emitObjectFitChange(objectFit: unknown): void {
  emit('contentStyleChange', { objectFit: objectFit as ImageContentStyle['objectFit'] })
}
</script>

<template>
  <section class="image-node-inspector" aria-label="Image node inspector">
    <StyleField label="URL">
      <a-input :value="node.data.url" size="small" type="url" @change="updateUrl" />
    </StyleField>
    <StyleField label="Alt">
      <a-input :maxlength="PLAIN_TEXT_MAX_LENGTH" :value="node.data.alt" size="small" @change="updateAlt" />
    </StyleField>
    <StyleField label="Fit">
      <a-segmented
        :options="['cover', 'contain']"
        :value="node.contentStyle.objectFit"
        size="small"
        @change="emitObjectFitChange"
      />
    </StyleField>
  </section>
</template>

<style scoped>
.image-node-inspector {
  display: grid;
  gap: 10px;
}
</style>
