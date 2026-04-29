<script setup lang="ts">
import { PLAIN_TEXT_MAX_LENGTH, type MindNode } from '@mind-x/shared'
import { isValidPlainText } from '@mind-x/mind-engine'
import StyleField from '../StyleField.vue'

type TopicNodeModel = Extract<MindNode, { type: 'topic' }>

defineProps<{
  node: TopicNodeModel
}>()

const emit = defineEmits<{
  contentChange: [dataPatch: Record<string, unknown>]
  contentStyleChange: [stylePatch: Record<string, unknown>]
}>()

function textValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement).value
}

function updateTitle(event: Event): void {
  const title = textValue(event).trim()
  if (isValidPlainText(title)) {
    emit('contentChange', { title })
  }
}

function emitTextWeightChange(textWeight: unknown): void {
  emit('contentStyleChange', { textWeight })
}
</script>

<template>
  <section class="topic-node-inspector" aria-label="Topic node inspector">
    <StyleField label="Title">
      <a-input :maxlength="PLAIN_TEXT_MAX_LENGTH" :value="node.data.title" size="small" @change="updateTitle" />
    </StyleField>
    <StyleField label="Text">
      <a-select
        :value="node.contentStyle.textWeight"
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
.topic-node-inspector {
  display: grid;
  gap: 10px;
}
</style>
