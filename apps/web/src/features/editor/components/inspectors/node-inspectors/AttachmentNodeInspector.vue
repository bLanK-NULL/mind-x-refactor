<script setup lang="ts">
import { PLAIN_TEXT_MAX_LENGTH, type MindNode } from '@mind-x/shared'
import { isValidPlainText, isValidWebUrl } from '@mind-x/mind-engine'
import StyleField from '../StyleField.vue'

type AttachmentNodeModel = Extract<MindNode, { type: 'attachment' }>

const props = defineProps<{
  node: AttachmentNodeModel
}>()

const emit = defineEmits<{
  contentChange: [dataPatch: Record<string, unknown>]
  contentStyleChange: [stylePatch: Record<string, unknown>]
}>()

function textValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement).value
}

function updateFileName(event: Event): void {
  const fileName = textValue(event).trim()
  if (isValidPlainText(fileName)) {
    emit('contentChange', { fileName, url: props.node.data.url })
  }
}

function updateUrl(event: Event): void {
  const url = textValue(event).trim()
  if (isValidWebUrl(url)) {
    emit('contentChange', { fileName: props.node.data.fileName, url })
  }
}
</script>

<template>
  <section class="attachment-node-inspector" aria-label="Attachment node inspector">
    <StyleField label="File">
      <a-input :maxlength="PLAIN_TEXT_MAX_LENGTH" :value="node.data.fileName" size="small" @change="updateFileName" />
    </StyleField>
    <StyleField label="URL">
      <a-input :value="node.data.url" size="small" type="url" @change="updateUrl" />
    </StyleField>
  </section>
</template>

<style scoped>
.attachment-node-inspector {
  display: grid;
  gap: 10px;
}
</style>
