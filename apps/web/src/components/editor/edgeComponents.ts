import { DEFAULT_EDGE_COMPONENT, type MindEdge, type MindEdgeComponent } from '@mind-x/shared'

export const EDGE_COMPONENT_OPTIONS: Array<{ label: string; value: MindEdgeComponent }> = [
  { label: 'Plain', value: 'plain' },
  { label: 'Dashed', value: 'dashed' },
  { label: 'Arrow', value: 'arrow' },
  { label: 'Dashed arrow', value: 'dashed-arrow' }
]

const EDGE_COMPONENT_SET = new Set<MindEdgeComponent>(EDGE_COMPONENT_OPTIONS.map((option) => option.value))

export function getEdgeComponent(edge: Pick<MindEdge, 'component'>): MindEdgeComponent {
  return edge.component && EDGE_COMPONENT_SET.has(edge.component) ? edge.component : DEFAULT_EDGE_COMPONENT
}

export function hasDash(component: MindEdgeComponent): boolean {
  return component === 'dashed' || component === 'dashed-arrow'
}

export function hasArrow(component: MindEdgeComponent): boolean {
  return component === 'arrow' || component === 'dashed-arrow'
}
