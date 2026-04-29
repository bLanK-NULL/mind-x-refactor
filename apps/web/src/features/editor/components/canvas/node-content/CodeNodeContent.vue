<script setup lang="ts">
import type { MindNode } from '@mind-x/shared'
import { computed } from 'vue'
import { highlightCode } from '../../../utils/codeHighlight'

type CodeNodeModel = Extract<MindNode, { type: 'code' }>

const props = defineProps<{
  node: CodeNodeModel
}>()

const highlighted = computed(() => highlightCode(props.node.data.code))
const codeClass = computed(() => ['hljs', highlighted.value.language ? `language-${highlighted.value.language}` : ''])
const wrapClass = computed(() => ({ 'code-node__code--wrap': props.node.contentStyle.wrap }))
</script>

<template>
  <div class="code-node__content">
    <pre class="code-node__pre" :class="wrapClass"><code :class="codeClass" v-html="highlighted.html" /></pre>
  </div>
</template>

<style scoped>
.code-node__content {
  display: grid;
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
}

.code-node__pre {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 0;
  margin: 0;
  padding: 10px 12px;
  overflow-x: auto;
  overflow-y: auto;
  border-radius: 4px;
  background: #111827;
  color: #e5e7eb;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 12px;
  line-height: 1.45;
  scrollbar-gutter: stable;
  white-space: pre;
}

.code-node__code--wrap {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.hljs {
  display: block;
  color: #e5e7eb;
}

:deep(.hljs-keyword),
:deep(.hljs-built_in),
:deep(.hljs-title),
:deep(.hljs-title.function_),
:deep(.hljs-attr) {
  color: #93c5fd;
}

:deep(.hljs-string),
:deep(.hljs-number),
:deep(.hljs-literal) {
  color: #86efac;
}

:deep(.hljs-comment) {
  color: #9ca3af;
}
</style>
