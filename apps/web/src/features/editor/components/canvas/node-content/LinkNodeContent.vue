<script setup lang="ts">
import type { MindNode } from '@mind-x/shared'
import { nextTick, ref, watch } from 'vue'

type LinkNodeModel = Extract<MindNode, { type: 'link' }>

const props = defineProps<{
  editing: boolean
  node: LinkNodeModel
}>()

const emit = defineEmits<{
  cancel: []
  commit: [dataPatch: { title: string; url: string }]
}>()

const draftTitle = ref(props.node.data.title)
const draftUrl = ref(props.node.data.url)
const editError = ref('')
const titleInputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.editing,
  async (editing) => {
    if (!editing) {
      return
    }

    editError.value = ''
    draftTitle.value = props.node.data.title
    draftUrl.value = props.node.data.url
    await nextTick()
    titleInputRef.value?.focus()
    titleInputRef.value?.select()
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
  const title = draftTitle.value.trim()
  const url = draftUrl.value.trim()
  if (title.length === 0 || /[<>]/.test(title)) {
    editError.value = 'Use non-empty plain text.'
    await nextTick()
    titleInputRef.value?.focus()
    return
  }
  if (!isValidWebUrl(url)) {
    editError.value = 'Use an http or https URL.'
    return
  }

  editError.value = ''
  if (title !== props.node.data.title || url !== props.node.data.url) {
    emit('commit', { title, url })
    return
  }

  emit('cancel')
}

function cancelEdit(): void {
  editError.value = ''
  draftTitle.value = props.node.data.title
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
  <div class="link-node__content" @focusout="onFocusout">
    <template v-if="editing">
      <input
        ref="titleInputRef"
        v-model="draftTitle"
        :aria-invalid="editError.length > 0"
        class="link-node__input link-node__input--title"
        maxlength="120"
        @input="editError = ''"
        @keydown.enter.prevent="commitEdit"
        @keydown.esc.prevent="cancelEdit"
        @pointerdown.stop
      />
      <input
        v-model="draftUrl"
        class="link-node__input"
        type="url"
        @input="editError = ''"
        @keydown.enter.prevent="commitEdit"
        @keydown.esc.prevent="cancelEdit"
        @pointerdown.stop
      />
      <span v-if="editError" class="link-node__error">{{ editError }}</span>
    </template>
    <a
      v-else
      class="link-node__anchor"
      :href="node.data.url"
      rel="noopener noreferrer"
      target="_blank"
    >
      <span class="link-node__title">{{ node.data.title }}</span>
      <span class="link-node__url">{{ node.data.url }}</span>
    </a>
  </div>
</template>

<style scoped>
.link-node__content {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.link-node__anchor {
  display: flex;
  min-width: 0;
  flex-direction: column;
  color: inherit;
  text-decoration: none;
}

.link-node__title {
  overflow: hidden;
  font-size: 14px;
  font-weight: 650;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.link-node__url {
  overflow: hidden;
  color: color-mix(in srgb, currentColor 68%, transparent);
  font-size: 11px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.link-node__input {
  width: 100%;
  min-width: 0;
  padding: 2px 0;
  border: 0;
  outline: 0;
  color: inherit;
  font-size: 12px;
}

.link-node__input--title {
  font-size: 14px;
  font-weight: 650;
}

.link-node__error {
  overflow: hidden;
  color: var(--color-danger);
  font-size: 11px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
