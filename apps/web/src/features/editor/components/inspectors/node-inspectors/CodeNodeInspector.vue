<script setup lang="ts">
import { CODE_NODE_CODE_MAX_LENGTH, type MindNode } from '@mind-x/shared'
import { isValidCode } from '../../../utils/nodeValidation'
import StyleField from '../StyleField.vue'

type CodeNodeModel = Extract<MindNode, { type: 'code' }>

defineProps<{
  node: CodeNodeModel
}>()

const emit = defineEmits<{
  contentChange: [dataPatch: Record<string, unknown>]
  contentStyleChange: [stylePatch: Record<string, unknown>]
}>()

function textValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement).value
}

function checkedValue(event: Event): boolean {
  return (event.target as HTMLInputElement).checked
}

function updateCode(event: Event): void {
  const code = textValue(event)
  if (isValidCode(code)) {
    emit('contentChange', { code })
  }
}
</script>

<template>
  <section class="code-node-inspector" aria-label="Code node inspector">
    <StyleField label="Code">
      <a-textarea
        :maxlength="CODE_NODE_CODE_MAX_LENGTH"
        :value="node.data.code"
        :auto-size="{ minRows: 5, maxRows: 8 }"
        size="small"
        @change="updateCode"
      />
    </StyleField>
    <StyleField label="Wrap">
      <a-checkbox
        :checked="node.contentStyle.wrap"
        @change="(event: Event) => emit('contentStyleChange', { wrap: checkedValue(event) })"
      >
        Wrap long lines
      </a-checkbox>
    </StyleField>
  </section>
</template>

<style scoped>
.code-node-inspector {
  display: grid;
  gap: 10px;
}
</style>
