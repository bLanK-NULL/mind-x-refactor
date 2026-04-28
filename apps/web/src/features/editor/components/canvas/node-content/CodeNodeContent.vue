<script setup lang="ts">
import { CODE_NODE_CODE_MAX_LENGTH, type MindNode } from '@mind-x/shared'
import { computed, nextTick, ref, watch } from 'vue'
import { highlightCode } from '../../../utils/codeHighlight'
import { isValidCode } from '../../../utils/nodeValidation'

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
const editError = ref('')
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
    editError.value = ''
    await nextTick()
    codeTextareaRef.value?.focus()
  }
)

async function commitEdit(): Promise<void> {
  if (!isValidCode(draftCode.value)) {
    editError.value = `Keep code under ${CODE_NODE_CODE_MAX_LENGTH.toLocaleString()} characters.`
    await nextTick()
    codeTextareaRef.value?.focus()
    return
  }

  editError.value = ''
  if (draftCode.value !== props.node.data.code) {
    emit('commit', { code: draftCode.value })
    return
  }

  emit('cancel')
}

function cancelEdit(): void {
  draftCode.value = props.node.data.code
  editError.value = ''
  emit('cancel')
}

function clearEditErrorIfValid(): void {
  if (isValidCode(draftCode.value)) {
    editError.value = ''
  }
}
</script>

<template>
  <div class="code-node__content">
    <template v-if="editing">
      <textarea
        ref="codeTextareaRef"
        v-model="draftCode"
        :aria-invalid="editError.length > 0"
        class="code-node__textarea"
        :maxlength="CODE_NODE_CODE_MAX_LENGTH"
        spellcheck="false"
        @blur="commitEdit"
        @input="clearEditErrorIfValid"
        @keydown.esc.prevent="cancelEdit"
        @pointerdown.stop
      />
      <span v-if="editError" class="code-node__error">{{ editError }}</span>
    </template>
    <pre v-else class="code-node__pre" :class="wrapClass"><code :class="codeClass" v-html="highlighted.html" /></pre>
  </div>
</template>

<style scoped>
.code-node__content {
  display: grid;
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  grid-template-rows: minmax(0, 1fr) auto;
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

.code-node__error {
  overflow: hidden;
  color: var(--color-danger);
  font-size: 11px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
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
