<script setup lang="ts">
import type { MindNode } from '@mind-x/shared'
import { isValidCode } from '@mind-x/mind-engine'
import { Codemirror } from 'vue-codemirror'
import { computed, ref, watch } from 'vue'
import { createCodeEditorExtensions } from '../../../utils/codeEditor'

type CodeNodeModel = Extract<MindNode, { type: 'code' }>

const props = defineProps<{
  node: CodeNodeModel
}>()

const emit = defineEmits<{
  commit: [dataPatch: { code: string }]
}>()

const editorCode = ref(props.node.data.code)

const extensions = computed(() =>
  createCodeEditorExtensions({
    language: props.node.data.language,
    theme: props.node.contentStyle.theme,
    wrap: props.node.contentStyle.wrap
  })
)

watch(
  () => props.node.data.code,
  (code) => {
    if (code !== editorCode.value) {
      editorCode.value = code
    }
  }
)

function commitCode(): void {
  if (editorCode.value === props.node.data.code) {
    return
  }

  if (!isValidCode(editorCode.value)) {
    editorCode.value = props.node.data.code
    return
  }

  emit('commit', { code: editorCode.value })
}

function cancelCode(): void {
  editorCode.value = props.node.data.code
}
</script>

<template>
  <div class="code-node__content" @dblclick.stop @pointerdown.stop>
    <Codemirror
      v-model="editorCode"
      class="code-node__editor"
      :autofocus="false"
      :auto-destroy="true"
      :disabled="false"
      :extensions="extensions"
      :indent-with-tab="true"
      :style="{ height: '100%', width: '100%' }"
      :tab-size="2"
      data-editor-control
      @blur="commitCode"
      @keydown.esc.prevent.stop="cancelCode"
    />
  </div>
</template>

<style scoped>
.code-node__content {
  display: grid;
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.code-node__editor {
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

:deep(.cm-editor) {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

:deep(.cm-scroller) {
  overflow: auto !important;
}
</style>
