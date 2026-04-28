import type { EdgeStyle, NodeShellStyle, ObjectColorToken, TopicContentStyle } from '@mind-x/shared'
import type { CSSProperties } from 'vue'

type TopicPalette = {
  border: string
  softFill: string
  solidFill: string
  text: string
}

const TOPIC_PALETTE: Record<ObjectColorToken, TopicPalette> = {
  danger: { border: '#dc2626', softFill: '#fef2f2', solidFill: '#dc2626', text: '#7f1d1d' },
  default: { border: '#cbd5e1', softFill: '#ffffff', solidFill: '#334155', text: '#111827' },
  info: { border: '#0891b2', softFill: '#ecfeff', solidFill: '#0891b2', text: '#164e63' },
  primary: { border: '#2563eb', softFill: '#eff6ff', solidFill: '#2563eb', text: '#1e3a8a' },
  purple: { border: '#7c3aed', softFill: '#f5f3ff', solidFill: '#7c3aed', text: '#4c1d95' },
  success: { border: '#16a34a', softFill: '#f0fdf4', solidFill: '#16a34a', text: '#14532d' },
  warning: { border: '#d97706', softFill: '#fffbeb', solidFill: '#d97706', text: '#78350f' }
}

const EDGE_STROKE: Record<ObjectColorToken, string> = {
  danger: '#dc2626',
  default: '#64748b',
  info: '#0891b2',
  primary: '#2563eb',
  purple: '#7c3aed',
  success: '#16a34a',
  warning: '#d97706'
}

const EDGE_DASHARRAY: Record<EdgeStyle['linePattern'], string> = {
  dashed: '8 8',
  dotted: '2 7',
  solid: 'none'
}

const EDGE_WIDTH: Record<EdgeStyle['width'], string> = {
  regular: '2px',
  thick: '3px',
  thin: '1.5px'
}

export type CssVariableStyle = CSSProperties & Record<`--${string}`, string>

export type EdgePathInput = {
  endX: number
  endY: number
  forward?: boolean
  routing: EdgeStyle['routing']
  startX: number
  startY: number
}

export function resolveNodeShellClass(style: NodeShellStyle): string[] {
  return [
    `topic-node--tone-${style.tone}`,
    `topic-node--shape-${style.shape}`,
    `topic-node--border-${style.borderStyle}`,
    `topic-node--shadow-${style.shadowLevel}`
  ]
}

export function resolveNodeShellStyle(style: NodeShellStyle): CssVariableStyle {
  const palette = TOPIC_PALETTE[style.colorToken]
  const solid = style.tone === 'solid'

  return {
    '--object-border': palette.border,
    '--object-fill': solid ? palette.solidFill : palette.softFill,
    '--object-text': solid ? '#ffffff' : palette.text
  }
}

export function resolveTopicContentClass(style: TopicContentStyle): string[] {
  return [`topic-node--weight-${style.textWeight}`]
}

export const resolveTopicNodeClass = resolveNodeShellClass
export const resolveTopicNodeStyle = resolveNodeShellStyle

export function resolveEdgeStyle(style: EdgeStyle): { classNames: string[]; style: CssVariableStyle } {
  return {
    classNames: ['edge-renderer__path', `edge-renderer__path--routing-${style.routing}`],
    style: {
      '--edge-dasharray': EDGE_DASHARRAY[style.linePattern],
      '--edge-stroke': EDGE_STROKE[style.colorToken],
      '--edge-width': EDGE_WIDTH[style.width]
    }
  }
}

export function getEdgeMarkerEnd(style: EdgeStyle, markerId: string): string | undefined {
  return style.arrow === 'end' ? `url(#${markerId})` : undefined
}

export function createEdgePath({ endX, endY, forward, routing, startX, startY }: EdgePathInput): string {
  if (routing === 'straight') {
    return `M ${startX} ${startY} L ${endX} ${endY}`
  }

  if (routing === 'elbow') {
    const midX = startX + (endX - startX) / 2
    return `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`
  }

  const curveForward = forward ?? endX >= startX
  const curve = Math.max(64, Math.abs(endX - startX) * 0.45)
  const c1x = startX + (curveForward ? curve : -curve)
  const c2x = endX + (curveForward ? -curve : curve)
  return `M ${startX} ${startY} C ${c1x} ${startY}, ${c2x} ${endY}, ${endX} ${endY}`
}
