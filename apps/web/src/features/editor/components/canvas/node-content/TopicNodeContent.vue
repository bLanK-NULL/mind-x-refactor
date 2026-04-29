<script setup lang="ts">
import type { MindNode } from '@mind-x/shared'
import { computed, nextTick, ref, watch } from 'vue'
import { resolveTopicContentClass } from '../../../utils/objectStyles'

type TopicNodeModel = Extract<MindNode, { type: 'topic' }>

const props = defineProps<{
  node: TopicNodeModel
}>()

const emit = defineEmits<{
  commit: [dataPatch: { title: string }]
  inspect: []
}>()

const editing = ref(false)
const draftTitle = ref(props.node.data.title)
const editError = ref('')
const titleInputRef = ref<HTMLInputElement | null>(null)

const contentClass = computed(() => resolveTopicContentClass(props.node.contentStyle))

watch(
  () => props.node.data.title,
  (title) => {
    if (!editing.value) {
      draftTitle.value = title
    }
  }
)

function validateTitle(title: string): string {
  if (title.length === 0 || /[<>]/.test(title)) {
    return 'Use non-empty plain text.'
  }
  return ''
}

async function startEditing(): Promise<void> {
  if (editing.value) {
    return
  }

  editError.value = ''
  draftTitle.value = props.node.data.title
  editing.value = true
  emit('inspect')
  await nextTick()
  titleInputRef.value?.focus()
  titleInputRef.value?.select()
}

async function commitEdit(): Promise<void> {
  const title = draftTitle.value.trim()
  const error = validateTitle(title)
  if (error) {
    editError.value = error
    await nextTick()
    titleInputRef.value?.focus()
    return
  }

  editError.value = ''
  editing.value = false
  if (title.length > 0 && title !== props.node.data.title) {
    emit('commit', { title })
  } else {
    draftTitle.value = props.node.data.title
  }
}

function cancelEdit(): void {
  editError.value = ''
  editing.value = false
  draftTitle.value = props.node.data.title
}
</script>

<template>
  <div class="topic-node__content" :class="contentClass" @dblclick.stop="startEditing">
    <template v-if="editing">
      <input
        ref="titleInputRef"
        v-model="draftTitle"
        :aria-invalid="editError.length > 0"
        class="topic-node__input"
        maxlength="120"
        @blur="commitEdit"
        @input="editError = ''"
        @keydown.enter.prevent="commitEdit"
        @keydown.esc.prevent="cancelEdit"
        @pointerdown.stop
      />
      <span v-if="editError" class="topic-node__error">{{ editError }}</span>
    </template>
    <span v-else class="topic-node__title">{{ node.data.title }}</span>
  </div>
</template>

<style scoped>
.topic-node__content {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.topic-node--weight-regular .topic-node__title,
.topic-node--weight-regular .topic-node__input {
  font-weight: 400;
}

.topic-node--weight-medium .topic-node__title,
.topic-node--weight-medium .topic-node__input {
  font-weight: 650;
}

.topic-node--weight-bold .topic-node__title,
.topic-node--weight-bold .topic-node__input {
  font-weight: 750;
}

.topic-node__title {
  display: block;
  width: 100%;
  overflow: hidden;
  font-size: 14px;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topic-node__input {
  width: 100%;
  min-width: 0;
  padding: 2px 0;
  border: 0;
  outline: 0;
  color: inherit;
  font-size: 14px;
}

.topic-node__error {
  align-self: stretch;
  overflow: hidden;
  color: var(--color-danger);
  font-size: 11px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
