<script setup lang="ts">
import type { MindNode } from '@mind-x/shared'
import { ExportOutlined, LinkOutlined } from '@ant-design/icons-vue'
import { computed, ref, watch } from 'vue'

type LinkNodeModel = Extract<MindNode, { type: 'link' }>

const props = defineProps<{
  node: LinkNodeModel
}>()

const faviconFailed = ref(false)

const faviconUrl = computed(() => resolveFaviconUrl(props.node.data.url))
const safeHref = computed(() => resolveWebUrl(props.node.data.url))

watch(
  () => props.node.data.url,
  () => {
    faviconFailed.value = false
  }
)

function resolveWebUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : undefined
  } catch {
    return undefined
  }
}

function resolveFaviconUrl(url: string): string {
  try {
    return `${new URL(url).origin}/favicon.ico`
  } catch {
    return ''
  }
}
</script>

<template>
  <div class="link-node__content">
    <a
      class="link-node__anchor"
      draggable="false"
      :href="safeHref"
      rel="noopener noreferrer"
      target="_blank"
      @dragstart.prevent
      @pointerdown.stop
    >
      <span class="link-node__title-row">
        <img
          v-if="faviconUrl && !faviconFailed"
          class="link-node__favicon"
          :alt="`${node.data.title} favicon`"
          draggable="false"
          :src="faviconUrl"
          @dragstart.prevent
          @error="faviconFailed = true"
        />
        <span v-else class="link-node__favicon-fallback" aria-hidden="true">
          <LinkOutlined />
        </span>
        <span class="link-node__title">{{ node.data.title }}</span>
        <ExportOutlined class="link-node__external" aria-hidden="true" />
      </span>
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
  display: inline-flex;
  max-width: 100%;
  min-width: 0;
  flex-direction: column;
  align-self: stretch;
  color: inherit;
  text-decoration: none;
}

.link-node__anchor:hover .link-node__title {
  text-decoration: underline;
}

.link-node__anchor:hover .link-node__external {
  opacity: 1;
  transform: translate(1px, -1px);
}

.link-node__title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.link-node__favicon,
.link-node__favicon-fallback {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  border-radius: 3px;
}

.link-node__favicon-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-subtle);
}

.link-node__title {
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 650;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.link-node__external {
  flex: 0 0 auto;
  opacity: 0.55;
  font-size: 12px;
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.link-node__url {
  overflow: hidden;
  padding-left: 22px;
  color: var(--color-text-subtle);
  font-size: 11px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
