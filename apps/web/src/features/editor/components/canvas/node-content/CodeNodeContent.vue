<script setup lang="ts">
import type { MindNode } from '@mind-x/shared'
import { computed, nextTick, ref, watch } from 'vue'
import { highlightCode } from '../../../utils/codeHighlight'

type CodeNodeModel = Extract<MindNode, { type: 'code' }>

const props = defineProps<{
  editing: boolean
  node: CodeNodeModel
}>()

const emit = defineEmits<{
  cancel: []
  commit: [dataPatch: { code: string }]
}>()

const draftCode = ref(props.node.data.code)
const codeTextareaRef = ref<HTMLTextAreaElement | null>(null)

const highlighted = computed(() => highlightCode(props.node.data.code))
const codeClass = computed(() => ['hljs', highlighted.value.language ? `language-${highlighted.value.language}` : ''])
const wrapClass = computed(() => ({ 'code-node__code--wrap': props.node.contentStyle.wrap }))

watch(
  () => props.editing,
  async (editing) => {
    if (!editing) {
      return
    }

    draftCode.value = props.node.data.code
    await nextTick()
    codeTextareaRef.value?.focus()
  }
)

function commitEdit(): void {
  if (draftCode.value !== props.node.data.code) {
    emit('commit', { code: draftCode.value })
    return
  }

  emit('cancel')
}

function cancelEdit(): void {
  draftCode.value = props.node.data.code
  emit('cancel')
}
</script>

<template>
  <div class="code-node__content">
    <textarea
      v-if="editing"
      ref="codeTextareaRef"
      v-model="draftCode"
      class="code-node__textarea"
      spellcheck="false"
      @blur="commitEdit"
      @keydown.esc.prevent="cancelEdit"
      @pointerdown.stop
    />
    <pre v-else class="code-node__pre" :class="wrapClass"><code :class="codeClass" v-html="highlighted.html" /></pre>
  </div>
</template>

<style scoped>
.code-node__content {
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
}

.code-node__textarea,
.code-node__pre {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 0;
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 12px;
  line-height: 1.45;
}

.code-node__textarea {
  resize: none;
  border: 0;
  outline: 0;
  color: inherit;
}

.code-node__pre {
  overflow: hidden;
  white-space: pre;
}

.code-node__code--wrap {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.hljs {
  display: block;
  color: inherit;
  background: transparent;
}

:deep(.hljs-keyword),
:deep(.hljs-built_in),
:deep(.hljs-title),
:deep(.hljs-title.function_),
:deep(.hljs-attr) {
  color: var(--color-primary);
}

:deep(.hljs-string),
:deep(.hljs-number),
:deep(.hljs-literal) {
  color: var(--color-success);
}

:deep(.hljs-comment) {
  color: color-mix(in srgb, currentColor 58%, transparent);
}
</style>
