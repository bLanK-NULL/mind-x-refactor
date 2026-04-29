<script setup lang="ts">
import { PLAIN_TEXT_MAX_LENGTH, type MindNode } from '@mind-x/shared'
import { isValidPlainText, isValidWebUrl } from '../../../utils/nodeValidation'
import StyleField from '../StyleField.vue'

type LinkNodeModel = Extract<MindNode, { type: 'link' }>

const props = defineProps<{
  node: LinkNodeModel
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
    emit('contentChange', { title, url: props.node.data.url })
  }
}

function updateUrl(event: Event): void {
  const url = textValue(event).trim()
  if (isValidWebUrl(url)) {
    emit('contentChange', { title: props.node.data.title, url })
  }
}
</script>

<template>
  <section class="link-node-inspector" aria-label="Link node inspector">
    <StyleField label="Title">
      <a-input :maxlength="PLAIN_TEXT_MAX_LENGTH" :value="node.data.title" size="small" @change="updateTitle" />
    </StyleField>
    <StyleField label="URL">
      <a-input :value="node.data.url" size="small" type="url" @change="updateUrl" />
    </StyleField>
  </section>
</template>

<style scoped>
.link-node-inspector {
  display: grid;
  gap: 10px;
}
</style>
