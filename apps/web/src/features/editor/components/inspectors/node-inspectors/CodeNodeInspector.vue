<script setup lang="ts">
import { CODE_NODE_CODE_MAX_LENGTH, type MindNode } from '@mind-x/shared'
import { computed } from 'vue'
import { isValidCode } from '@mind-x/mind-engine'
import {
  CODE_THEME_OPTIONS,
  resolveCodeTheme
} from '../../../utils/codeThemes'
import StyleField from '../StyleField.vue'

type CodeNodeModel = Extract<MindNode, { type: 'code' }>

const props = defineProps<{
  node: CodeNodeModel
}>()

const emit = defineEmits<{
  contentChange: [dataPatch: Record<string, unknown>]
  contentStyleChange: [stylePatch: Record<string, unknown>]
}>()

function textValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement).value
}

function checkedValue(event: Event): boolean {
  return (event.target as HTMLInputElement).checked
}

function updateCode(event: Event): void {
  const code = textValue(event)
  if (isValidCode(code)) {
    emit('contentChange', { code })
  }
}

const selectedTheme = computed(() => resolveCodeTheme(props.node.contentStyle.theme))

function emitThemeChange(value: unknown): void {
  const theme = resolveCodeTheme(value)
  emit('contentStyleChange', { theme })
}
</script>

<template>
  <section class="code-node-inspector" aria-label="Code node inspector">
    <StyleField label="Code">
      <a-textarea
        :maxlength="CODE_NODE_CODE_MAX_LENGTH"
        :value="node.data.code"
        :auto-size="{ minRows: 5, maxRows: 8 }"
        size="small"
        @change="updateCode"
      />
    </StyleField>
    <StyleField label="Theme">
      <a-select
        :value="selectedTheme"
        size="small"
        class="code-node-inspector__theme-select"
        @change="emitThemeChange"
      >
        <a-select-option
          v-for="option in CODE_THEME_OPTIONS"
          :key="option.value"
          :value="option.value"
        >
          <span class="code-node-inspector__theme-option">
            <span>{{ option.label }}</span>
            <span class="code-node-inspector__theme-swatches" aria-hidden="true">
              <span
                v-for="swatch in option.swatches"
                :key="swatch.label"
                class="code-node-inspector__theme-swatch"
                :style="{ backgroundColor: swatch.color }"
              />
            </span>
          </span>
        </a-select-option>
      </a-select>
    </StyleField>
    <StyleField label="Wrap">
      <a-checkbox
        :checked="node.contentStyle.wrap"
        @change="(event: Event) => emit('contentStyleChange', { wrap: checkedValue(event) })"
      >
        Wrap long lines
      </a-checkbox>
    </StyleField>
  </section>
</template>

<style scoped>
.code-node-inspector {
  display: grid;
  gap: 10px;
}

.code-node-inspector__theme-select {
  width: 100%;
}

.code-node-inspector__theme-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.code-node-inspector__theme-swatches {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 2px;
}

.code-node-inspector__theme-swatch {
  width: 10px;
  height: 10px;
  border: 1px solid rgb(0 0 0 / 12%);
  border-radius: 2px;
}
</style>
