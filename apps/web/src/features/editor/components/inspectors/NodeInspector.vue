<script setup lang="ts">
import type { MindNode, NodeShellStyle } from '@mind-x/shared'
import ColorTokenPicker from './ColorTokenPicker.vue'
import StyleField from './StyleField.vue'

type TaskNodeModel = Extract<MindNode, { type: 'task' }>
type TaskItem = TaskNodeModel['data']['items'][number]

const props = defineProps<{
  node: MindNode
}>()

const emit = defineEmits<{
  contentChange: [dataPatch: Record<string, unknown>]
  contentStyleChange: [stylePatch: Record<string, unknown>]
  shellStyleChange: [stylePatch: Partial<NodeShellStyle>]
}>()

function emitToneChange(tone: unknown): void {
  emit('shellStyleChange', { tone: tone as NodeShellStyle['tone'] })
}

function emitShapeChange(shape: unknown): void {
  emit('shellStyleChange', { shape: shape as NodeShellStyle['shape'] })
}

function emitBorderStyleChange(borderStyle: unknown): void {
  emit('shellStyleChange', { borderStyle: borderStyle as NodeShellStyle['borderStyle'] })
}

function emitShadowLevelChange(shadowLevel: unknown): void {
  emit('shellStyleChange', { shadowLevel: shadowLevel as NodeShellStyle['shadowLevel'] })
}

function emitTextWeightChange(textWeight: unknown): void {
  emit('contentStyleChange', { textWeight })
}

function textValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement).value
}

function checkedValue(event: Event): boolean {
  return (event.target as HTMLInputElement).checked
}

function isPlainTextNonEmpty(value: string): boolean {
  return value.trim().length > 0 && !/[<>]/.test(value)
}

function isOptionalPlainText(value: string): boolean {
  return value.trim().length === 0 || !/[<>]/.test(value)
}

function isValidWebUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function updateTopicTitle(event: Event): void {
  const title = textValue(event).trim()
  if (isPlainTextNonEmpty(title)) {
    emit('contentChange', { title })
  }
}

function updateImageUrl(event: Event): void {
  const url = textValue(event).trim()
  if (isValidWebUrl(url)) {
    emit('contentChange', { url, alt: props.node.type === 'image' ? props.node.data.alt : undefined })
  }
}

function updateImageAlt(event: Event): void {
  const alt = textValue(event).trim()
  if (props.node.type === 'image' && isOptionalPlainText(alt)) {
    emit('contentChange', { url: props.node.data.url, alt: alt || undefined })
  }
}

function updateLinkTitle(event: Event): void {
  const title = textValue(event).trim()
  if (props.node.type === 'link' && isPlainTextNonEmpty(title)) {
    emit('contentChange', { title, url: props.node.data.url })
  }
}

function updateLinkUrl(event: Event): void {
  const url = textValue(event).trim()
  if (props.node.type === 'link' && isValidWebUrl(url)) {
    const title = props.node.data.title
    emit('contentChange', { title, url })
  }
}

function updateAttachmentFileName(event: Event): void {
  const fileName = textValue(event).trim()
  if (props.node.type === 'attachment' && isPlainTextNonEmpty(fileName)) {
    emit('contentChange', { fileName, url: props.node.data.url })
  }
}

function updateAttachmentUrl(event: Event): void {
  const url = textValue(event).trim()
  if (props.node.type === 'attachment' && isValidWebUrl(url)) {
    const fileName = props.node.data.fileName
    emit('contentChange', { fileName, url })
  }
}

function updateCode(event: Event): void {
  const code = textValue(event)
  emit('contentChange', { code })
}

function replaceTaskItem(index: number, patch: Partial<TaskItem>): void {
  if (props.node.type !== 'task') {
    return
  }

  const items = props.node.data.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : { ...item }))
  if (items.every((item) => isPlainTextNonEmpty(item.title))) {
    emit('contentChange', { items })
  }
}
</script>

<template>
  <section class="node-inspector" aria-label="Node inspector">
    <StyleField label="Color">
      <ColorTokenPicker
        :value="node.shellStyle.colorToken"
        @change="(colorToken) => emit('shellStyleChange', { colorToken })"
      />
    </StyleField>
    <StyleField label="Tone">
      <a-segmented
        :options="['soft', 'solid', 'outline']"
        :value="node.shellStyle.tone"
        size="small"
        @change="emitToneChange"
      />
    </StyleField>
    <StyleField label="Shape">
      <a-select
        :value="node.shellStyle.shape"
        size="small"
        @change="emitShapeChange"
      >
        <a-select-option value="rounded">Rounded</a-select-option>
        <a-select-option value="rectangle">Rectangle</a-select-option>
        <a-select-option value="pill">Pill</a-select-option>
      </a-select>
    </StyleField>
    <StyleField label="Border">
      <a-select
        :value="node.shellStyle.borderStyle"
        size="small"
        @change="emitBorderStyleChange"
      >
        <a-select-option value="none">None</a-select-option>
        <a-select-option value="solid">Solid</a-select-option>
        <a-select-option value="dashed">Dashed</a-select-option>
      </a-select>
    </StyleField>
    <StyleField label="Shadow">
      <a-segmented
        :options="['none', 'sm', 'md']"
        :value="node.shellStyle.shadowLevel"
        size="small"
        @change="emitShadowLevelChange"
      />
    </StyleField>

    <template v-if="node.type === 'topic'">
      <StyleField label="Title">
        <a-input :value="node.data.title" size="small" @change="updateTopicTitle" />
      </StyleField>
      <StyleField label="Text">
        <a-select
          :value="node.contentStyle.textWeight"
          size="small"
          @change="emitTextWeightChange"
        >
          <a-select-option value="regular">Regular</a-select-option>
          <a-select-option value="medium">Medium</a-select-option>
          <a-select-option value="bold">Bold</a-select-option>
        </a-select>
      </StyleField>
    </template>

    <template v-else-if="node.type === 'image'">
      <StyleField label="URL">
        <a-input :value="node.data.url" size="small" type="url" @change="updateImageUrl" />
      </StyleField>
      <StyleField label="Alt">
        <a-input :value="node.data.alt" size="small" @change="updateImageAlt" />
      </StyleField>
    </template>

    <template v-else-if="node.type === 'link'">
      <StyleField label="Title">
        <a-input :value="node.data.title" size="small" @change="updateLinkTitle" />
      </StyleField>
      <StyleField label="URL">
        <a-input :value="node.data.url" size="small" type="url" @change="updateLinkUrl" />
      </StyleField>
    </template>

    <template v-else-if="node.type === 'attachment'">
      <StyleField label="File">
        <a-input :value="node.data.fileName" size="small" @change="updateAttachmentFileName" />
      </StyleField>
      <StyleField label="URL">
        <a-input :value="node.data.url" size="small" type="url" @change="updateAttachmentUrl" />
      </StyleField>
    </template>

    <template v-else-if="node.type === 'code'">
      <StyleField label="Code">
        <a-textarea :value="node.data.code" :auto-size="{ minRows: 5, maxRows: 8 }" size="small" @change="updateCode" />
      </StyleField>
    </template>

    <template v-else-if="node.type === 'task'">
      <StyleField label="Tasks">
        <div class="node-inspector__tasks">
          <label v-for="(item, index) in node.data.items" :key="item.id" class="node-inspector__task">
            <a-checkbox
              :checked="item.done"
              @change="(event: Event) => replaceTaskItem(index, { done: checkedValue(event) })"
            />
            <a-input
              :value="item.title"
              size="small"
              @change="(event: Event) => replaceTaskItem(index, { title: textValue(event).trim() })"
            />
          </label>
        </div>
      </StyleField>
    </template>
  </section>
</template>

<style scoped>
.node-inspector {
  display: grid;
  gap: 10px;
}

.node-inspector__tasks {
  display: grid;
  gap: 6px;
}

.node-inspector__task {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 6px;
}
</style>
