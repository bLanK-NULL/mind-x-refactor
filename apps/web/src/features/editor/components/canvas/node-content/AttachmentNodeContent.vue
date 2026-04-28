<script setup lang="ts">
import type { MindNode } from '@mind-x/shared'
import { nextTick, ref, watch } from 'vue'

type AttachmentNodeModel = Extract<MindNode, { type: 'attachment' }>

const props = defineProps<{
  editing: boolean
  node: AttachmentNodeModel
}>()

const emit = defineEmits<{
  cancel: []
  commit: [dataPatch: { fileName: string; url: string }]
}>()

const draftFileName = ref(props.node.data.fileName)
const draftUrl = ref(props.node.data.url)
const editError = ref('')
const fileNameInputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.editing,
  async (editing) => {
    if (!editing) {
      return
    }

    editError.value = ''
    draftFileName.value = props.node.data.fileName
    draftUrl.value = props.node.data.url
    await nextTick()
    fileNameInputRef.value?.focus()
    fileNameInputRef.value?.select()
  }
)

function isValidWebUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

async function commitEdit(): Promise<void> {
  const fileName = draftFileName.value.trim()
  const url = draftUrl.value.trim()
  if (fileName.length === 0 || /[<>]/.test(fileName)) {
    editError.value = 'Use non-empty plain text.'
    await nextTick()
    fileNameInputRef.value?.focus()
    return
  }
  if (!isValidWebUrl(url)) {
    editError.value = 'Use an http or https URL.'
    return
  }

  editError.value = ''
  if (fileName !== props.node.data.fileName || url !== props.node.data.url) {
    emit('commit', { fileName, url })
    return
  }

  emit('cancel')
}

function cancelEdit(): void {
  editError.value = ''
  draftFileName.value = props.node.data.fileName
  draftUrl.value = props.node.data.url
  emit('cancel')
}

function onFocusout(event: FocusEvent): void {
  const nextTarget = event.relatedTarget
  if (nextTarget instanceof Node && (event.currentTarget as HTMLElement).contains(nextTarget)) {
    return
  }

  void commitEdit()
}
</script>

<template>
  <div class="attachment-node__content" @focusout="onFocusout">
    <template v-if="editing">
      <input
        ref="fileNameInputRef"
        v-model="draftFileName"
        :aria-invalid="editError.length > 0"
        class="attachment-node__input attachment-node__input--name"
        maxlength="160"
        @input="editError = ''"
        @keydown.enter.prevent="commitEdit"
        @keydown.esc.prevent="cancelEdit"
        @pointerdown.stop
      />
      <input
        v-model="draftUrl"
        class="attachment-node__input"
        type="url"
        @input="editError = ''"
        @keydown.enter.prevent="commitEdit"
        @keydown.esc.prevent="cancelEdit"
        @pointerdown.stop
      />
      <span v-if="editError" class="attachment-node__error">{{ editError }}</span>
    </template>
    <a
      v-else
      class="attachment-node__link"
      :href="node.data.url"
      rel="noopener noreferrer"
      target="_blank"
    >
      <span aria-hidden="true" class="attachment-node__icon">FILE</span>
      <span class="attachment-node__meta">
        <span class="attachment-node__name">{{ node.data.fileName }}</span>
        <span v-if="node.data.fileSizeLabel" class="attachment-node__size">{{ node.data.fileSizeLabel }}</span>
      </span>
    </a>
  </div>
</template>

<style scoped>
.attachment-node__content {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.attachment-node__link {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  color: inherit;
  text-decoration: none;
}

.attachment-node__icon {
  flex: 0 0 auto;
  border-radius: 3px;
  color: color-mix(in srgb, currentColor 72%, transparent);
  font-size: 10px;
  font-weight: 750;
  line-height: 1;
}

.attachment-node__meta {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.attachment-node__name {
  overflow: hidden;
  font-size: 14px;
  font-weight: 650;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-node__size {
  color: color-mix(in srgb, currentColor 68%, transparent);
  font-size: 11px;
  line-height: 1.25;
}

.attachment-node__input {
  width: 100%;
  min-width: 0;
  padding: 2px 0;
  border: 0;
  outline: 0;
  color: inherit;
  font-size: 12px;
}

.attachment-node__input--name {
  font-size: 14px;
  font-weight: 650;
}

.attachment-node__error {
  overflow: hidden;
  color: var(--color-danger);
  font-size: 11px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
