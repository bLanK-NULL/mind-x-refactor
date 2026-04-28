<script setup lang="ts">
defineProps<{
  canAddChild: boolean
  canDelete: boolean
  visible: boolean
  x: number
  y: number
}>()

const emit = defineEmits<{
  addChild: []
  close: []
  delete: []
}>()
</script>

<template>
  <div
    v-if="visible"
    class="editor-context-menu"
    :style="{ left: `${x}px`, top: `${y}px` }"
    @contextmenu.prevent
    @pointerdown.stop
  >
    <a-button :disabled="!canAddChild" block type="text" @click="emit('addChild')">Add child</a-button>
    <a-button :disabled="!canDelete" block danger type="text" @click="emit('delete')">Delete</a-button>
    <button class="editor-context-menu__scrim" aria-label="Close" type="button" @click="emit('close')" />
  </div>
</template>

<style scoped>
.editor-context-menu {
  position: absolute;
  z-index: 30;
  display: grid;
  min-width: 132px;
  padding: 4px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  box-shadow: var(--shadow-menu);
}

.editor-context-menu__scrim {
  position: fixed;
  z-index: -1;
  inset: 0;
  border: 0;
  background: transparent;
}
</style>
