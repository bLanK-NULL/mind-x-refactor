<script setup lang="ts">
import type { MindNode } from '@mind-x/shared'
import { computed } from 'vue'
import { highlightCode } from '../../../utils/codeHighlight'
import { resolveCodeThemeStyle } from '../../../utils/codeThemes'

type CodeNodeModel = Extract<MindNode, { type: 'code' }>

const props = defineProps<{
  node: CodeNodeModel
}>()

const highlighted = computed(() => highlightCode(props.node.data.code))
const codeClass = computed(() => ['hljs', highlighted.value.language ? `language-${highlighted.value.language}` : ''])
const themeStyle = computed(() => resolveCodeThemeStyle(props.node.contentStyle.theme))
const wrapClass = computed(() => ({ 'code-node__code--wrap': props.node.contentStyle.wrap }))
</script>

<template>
  <div class="code-node__content">
    <pre class="code-node__pre" :class="wrapClass" :style="themeStyle"><code :class="codeClass" v-html="highlighted.html" /></pre>
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
  background: var(--code-bg);
  color: var(--code-text);
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
  color: var(--code-text);
}

:deep(.hljs-keyword),
:deep(.hljs-selector-tag),
:deep(.hljs-built_in) {
  color: var(--code-keyword);
}

:deep(.hljs-string),
:deep(.hljs-symbol),
:deep(.hljs-bullet) {
  color: var(--code-string);
}

:deep(.hljs-number) {
  color: var(--code-number);
}

:deep(.hljs-literal) {
  color: var(--code-literal);
}

:deep(.hljs-title),
:deep(.hljs-title.function_),
:deep(.hljs-section) {
  color: var(--code-title);
}

:deep(.hljs-attr),
:deep(.hljs-attribute),
:deep(.hljs-name) {
  color: var(--code-attr);
}

:deep(.hljs-comment),
:deep(.hljs-quote) {
  color: var(--code-comment);
}
</style>
