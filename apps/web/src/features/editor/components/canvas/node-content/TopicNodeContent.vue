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
const localTitle = ref(props.node.data.title)
const editError = ref('')
const titleInputRef = ref<HTMLInputElement | null>(null)

const contentClass = computed(() => resolveTopicContentClass(props.node.contentStyle))

watch(
  () => props.node.data.title,
  (title) => {
    localTitle.value = title
  }
)

async function startEditing(): Promise<void> {
  if (editing.value) {
    return
  }

  editError.value = ''
  localTitle.value = props.node.data.title
  editing.value = true
  emit('inspect')
  await nextTick()
  titleInputRef.value?.focus()
  titleInputRef.value?.select()
}

function onInput(): void {
  const title = localTitle.value.trim()
  if (title.length === 0 || /[<>]/.test(title)) {
    editError.value = 'Use non-empty plain text.'
    return
  }

  editError.value = ''
  if (title !== props.node.data.title) {
    emit('commit', { title })
  }
}

function cancelEdit(): void {
  editError.value = ''
  editing.value = false
  localTitle.value = props.node.data.title
}
</script>

<template>
  <div class="topic-node__content" :class="contentClass" @click.stop="startEditing">
    <template v-if="editing">
      <input
        ref="titleInputRef"
        v-model="localTitle"
        :aria-invalid="editError.length > 0"
        class="topic-node__input"
        maxlength="120"
        @input="onInput"
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
