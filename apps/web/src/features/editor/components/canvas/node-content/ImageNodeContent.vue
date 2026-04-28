<script setup lang="ts">
import type { MindNode } from '@mind-x/shared'
import { computed, nextTick, ref, watch } from 'vue'

type ImageNodeModel = Extract<MindNode, { type: 'image' }>

const props = defineProps<{
  editing: boolean
  node: ImageNodeModel
}>()

const emit = defineEmits<{
  cancel: []
  commit: [dataPatch: { alt?: string; url: string }]
}>()

const draftUrl = ref(props.node.data.url)
const draftAlt = ref(props.node.data.alt ?? '')
const editError = ref('')
const urlInputRef = ref<HTMLInputElement | null>(null)

const objectFit = computed(() => props.node.contentStyle.objectFit)

watch(
  () => props.editing,
  async (editing) => {
    if (!editing) {
      return
    }

    editError.value = ''
    draftUrl.value = props.node.data.url
    draftAlt.value = props.node.data.alt ?? ''
    await nextTick()
    urlInputRef.value?.focus()
    urlInputRef.value?.select()
  }
)

watch(
  () => props.node.data.url,
  (url) => {
    if (!props.editing) {
      draftUrl.value = url
    }
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
  const url = draftUrl.value.trim()
  const alt = draftAlt.value.trim()
  if (!isValidWebUrl(url)) {
    editError.value = 'Use an http or https URL.'
    await nextTick()
    urlInputRef.value?.focus()
    return
  }

  editError.value = ''
  if (url !== props.node.data.url || alt !== (props.node.data.alt ?? '')) {
    emit('commit', { alt: alt.length > 0 ? alt : undefined, url })
    return
  }

  emit('cancel')
}

function cancelEdit(): void {
  editError.value = ''
  draftUrl.value = props.node.data.url
  draftAlt.value = props.node.data.alt ?? ''
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
  <div class="image-node__content" @focusout="onFocusout">
    <template v-if="editing">
      <input
        ref="urlInputRef"
        v-model="draftUrl"
        :aria-invalid="editError.length > 0"
        class="image-node__input"
        placeholder="Image URL"
        type="url"
        @input="editError = ''"
        @keydown.enter.prevent="commitEdit"
        @keydown.esc.prevent="cancelEdit"
        @pointerdown.stop
      />
      <input
        v-model="draftAlt"
        class="image-node__input"
        maxlength="120"
        placeholder="Alt text"
        @keydown.enter.prevent="commitEdit"
        @keydown.esc.prevent="cancelEdit"
        @pointerdown.stop
      />
      <span v-if="editError" class="image-node__error">{{ editError }}</span>
    </template>
    <img
      v-else
      class="image-node__image"
      :alt="node.data.alt ?? ''"
      :src="node.data.url"
      :style="{ objectFit }"
    />
  </div>
</template>

<style scoped>
.image-node__content {
  display: flex;
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
}

.image-node__image {
  width: 100%;
  height: 100%;
  min-height: 0;
  border-radius: 4px;
}

.image-node__input {
  width: 100%;
  min-width: 0;
  padding: 3px 0;
  border: 0;
  outline: 0;
  color: inherit;
  font-size: 12px;
}

.image-node__error {
  overflow: hidden;
  color: var(--color-danger);
  font-size: 11px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
