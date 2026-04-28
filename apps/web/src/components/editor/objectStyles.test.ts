import { DEFAULT_EDGE_STYLE, DEFAULT_TOPIC_STYLE } from '@mind-x/shared'
import { describe, expect, it } from 'vitest'
import {
  getEdgeMarkerEnd,
  resolveEdgeStyle,
  resolveTopicNodeClass,
  resolveTopicNodeStyle
} from './objectStyles'

describe('object style resolvers', () => {
  it('resolves default topic style to CSS variables and classes', () => {
    expect(resolveTopicNodeClass(DEFAULT_TOPIC_STYLE)).toEqual([
      'topic-node--tone-soft',
      'topic-node--shape-rounded',
      'topic-node--size-md',
      'topic-node--border-solid',
      'topic-node--shadow-sm',
      'topic-node--weight-medium'
    ])
    expect(resolveTopicNodeStyle(DEFAULT_TOPIC_STYLE)).toMatchObject({
      '--object-border': '#cbd5e1',
      '--object-fill': '#ffffff',
      '--object-text': '#111827'
    })
  })

  it('resolves solid purple topic styles', () => {
    expect(resolveTopicNodeStyle({ ...DEFAULT_TOPIC_STYLE, colorToken: 'purple', tone: 'solid' })).toMatchObject({
      '--object-border': '#7c3aed',
      '--object-fill': '#7c3aed',
      '--object-text': '#ffffff'
    })
  })

  it('resolves edge line style, dash arrays, width, routing, and marker behavior', () => {
    const resolved = resolveEdgeStyle({
      ...DEFAULT_EDGE_STYLE,
      arrow: 'end',
      colorToken: 'warning',
      linePattern: 'dotted',
      routing: 'straight',
      width: 'thick'
    })

    expect(resolved).toEqual({
      classNames: ['edge-renderer__path', 'edge-renderer__path--routing-straight'],
      style: {
        '--edge-dasharray': '2 7',
        '--edge-stroke': '#d97706',
        '--edge-width': '3'
      }
    })
    expect(getEdgeMarkerEnd({ ...DEFAULT_EDGE_STYLE, arrow: 'none' }, 'marker')).toBeUndefined()
    expect(getEdgeMarkerEnd({ ...DEFAULT_EDGE_STYLE, arrow: 'end' }, 'marker')).toBe('url(#marker)')
  })
})
