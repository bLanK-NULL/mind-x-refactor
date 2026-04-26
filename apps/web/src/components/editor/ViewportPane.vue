<script setup lang="ts">
import type { Viewport } from '@mind-x/shared'
import { select, type Selection } from 'd3-selection'
import { zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior } from 'd3-zoom'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { allowsViewportGesture } from './viewportGestureFilter'

const props = defineProps<{
  viewport: Viewport
}>()

const emit = defineEmits<{
  viewportChange: [viewport: Viewport]
}>()

const paneRef = ref<HTMLDivElement | null>(null)
const contentRef = ref<HTMLDivElement | null>(null)
let paneSelection: Selection<HTMLDivElement, unknown, null, undefined> | null = null
let zoomBehavior: ZoomBehavior<HTMLDivElement, unknown> | null = null
let applyingExternalTransform = false

const contentStyle = computed(() => ({
  transform: `translate(${props.viewport.x}px, ${props.viewport.y}px) scale(${props.viewport.zoom})`
}))

function applyViewport(viewport: Viewport): void {
  if (!paneSelection || !zoomBehavior) {
    return
  }

  applyingExternalTransform = true
  paneSelection.call(zoomBehavior.transform, zoomIdentity.translate(viewport.x, viewport.y).scale(viewport.zoom))
  applyingExternalTransform = false
}

function getExportRoot(): HTMLElement | null {
  return contentRef.value
}

defineExpose({ getExportRoot })

onMounted(() => {
  if (!paneRef.value) {
    return
  }

  paneSelection = select<HTMLDivElement, unknown>(paneRef.value)
  zoomBehavior = zoom<HTMLDivElement, unknown>()
    .scaleExtent([0.2, 3])
    .filter(allowsViewportGesture)
    .on('zoom', (event: D3ZoomEvent<HTMLDivElement, unknown>) => {
      if (applyingExternalTransform) {
        return
      }

      emit('viewportChange', {
        x: event.transform.x,
        y: event.transform.y,
        zoom: event.transform.k
      })
    })

  paneSelection.call(zoomBehavior)
  applyViewport(props.viewport)
})

watch(
  () => props.viewport,
  (viewport) => applyViewport(viewport),
  { deep: true }
)

onUnmounted(() => {
  paneSelection?.on('.zoom', null)
  paneSelection = null
  zoomBehavior = null
})
</script>

<template>
  <div ref="paneRef" class="viewport-pane">
    <div ref="contentRef" class="viewport-pane__content" :style="contentStyle">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.viewport-pane {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background:
    linear-gradient(#e8edf2 1px, transparent 1px),
    linear-gradient(90deg, #e8edf2 1px, transparent 1px),
    #f8fafc;
  background-size: 24px 24px;
  cursor: grab;
  touch-action: none;
}

.viewport-pane:active {
  cursor: grabbing;
}

.viewport-pane__content {
  position: absolute;
  top: 0;
  left: 0;
  width: 1px;
  height: 1px;
  transform-origin: 0 0;
}
</style>
