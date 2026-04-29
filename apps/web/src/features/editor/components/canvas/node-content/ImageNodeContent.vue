<script setup lang="ts">
import type { MindNode } from '@mind-x/shared'
import { computed, nextTick, ref, watch } from 'vue'

type ImageNodeModel = Extract<MindNode, { type: 'image' }>

const props = defineProps<{
  node: ImageNodeModel
  selected?: boolean
}>()

const objectFit = computed(() => props.node.contentStyle.objectFit)
const previewLabel = computed(() => {
  const label = props.node.data.alt?.trim() || 'image'
  return `Preview ${label}`
})
const previewOpen = ref(false)
const previewRootRef = ref<HTMLElement | null>(null)
const closeButtonRef = ref<HTMLButtonElement | null>(null)

watch(
  () => props.selected,
  async (selected) => {
    if (selected) {
      await nextTick()
      previewRootRef.value?.focus({ preventScroll: true })
    }
  }
)

watch(previewOpen, async (open) => {
  await nextTick()
  if (open) {
    closeButtonRef.value?.focus()
  } else if (props.selected) {
    previewRootRef.value?.focus({ preventScroll: true })
  }
})

function openPreview(): void {
  previewOpen.value = true
}

function closePreview(): void {
  previewOpen.value = false
}
</script>

<template>
  <div
    ref="previewRootRef"
    class="image-node__content"
    role="button"
    tabindex="0"
    :aria-label="previewLabel"
    @keydown.space.prevent.stop="openPreview"
  >
    <img
      class="image-node__image"
      :alt="node.data.alt ?? ''"
      draggable="false"
      :src="node.data.url"
      :style="{ objectFit }"
      @dragstart.prevent
    />
    <Teleport to="body">
      <div
        v-if="previewOpen"
        class="image-node-preview"
        role="dialog"
        aria-modal="true"
        :aria-label="previewLabel"
        @click.self="closePreview"
        @keydown.esc.prevent.stop="closePreview"
      >
        <button
          ref="closeButtonRef"
          aria-label="Close image preview"
          class="image-node-preview__close"
          data-editor-control
          type="button"
          @click="closePreview"
          @pointerdown.stop
        >
          Close
        </button>
        <img class="image-node-preview__image" :alt="node.data.alt ?? ''" :src="node.data.url" />
      </div>
    </Teleport>
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
  outline: 0;
}

.image-node__content:focus-visible {
  box-shadow: inset 0 0 0 2px var(--color-primary);
}

.image-node__image {
  width: 100%;
  height: 100%;
  min-height: 0;
  border-radius: 4px;
}

.image-node-preview {
  position: fixed;
  z-index: 1000;
  display: grid;
  place-items: center;
  inset: 0;
  padding: 40px;
  background: rgb(15 23 42 / 78%);
}

.image-node-preview__image {
  max-width: min(96vw, 1200px);
  max-height: 88vh;
  border-radius: 6px;
  box-shadow: 0 20px 60px rgb(0 0 0 / 34%);
  object-fit: contain;
}

.image-node-preview__close {
  position: fixed;
  top: 18px;
  right: 18px;
  padding: 7px 10px;
  border: 1px solid rgb(255 255 255 / 28%);
  border-radius: 4px;
  background: rgb(15 23 42 / 88%);
  color: #fff;
  cursor: pointer;
  font-size: 13px;
}
</style>
