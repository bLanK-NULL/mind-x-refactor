<script setup lang="ts">
import type { MindNode } from '@mind-x/shared'

type TaskNodeModel = Extract<MindNode, { type: 'task' }>

defineProps<{
  node: TaskNodeModel
}>()
</script>

<template>
  <div class="task-node__content" :class="`task-node__content--${node.contentStyle.density}`">
    <div v-for="item in node.data.items" :key="item.id" class="task-node__item">
      <input class="task-node__checkbox" :checked="item.done" disabled type="checkbox" />
      <span class="task-node__title" :class="{ 'task-node__title--done': item.done }">{{ item.title }}</span>
    </div>
  </div>
</template>

<style scoped>
.task-node__content {
  display: flex;
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}

.task-node__content--comfortable {
  gap: 7px;
}

.task-node__content--compact {
  gap: 4px;
}

.task-node__item {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.task-node__checkbox {
  flex: 0 0 auto;
}

.task-node__title {
  overflow: hidden;
  flex: 1;
  font-size: 13px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-node__title--done {
  color: color-mix(in srgb, currentColor 58%, transparent);
  text-decoration: line-through;
}
</style>
