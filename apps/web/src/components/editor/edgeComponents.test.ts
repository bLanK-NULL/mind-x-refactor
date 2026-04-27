import { describe, expect, it } from 'vitest'
import { getEdgeComponent, hasArrow, hasDash } from './edgeComponents'

describe('edge component helpers', () => {
  it('falls back to plain for missing components', () => {
    expect(getEdgeComponent({})).toBe('plain')
  })

  it('falls back to plain for malformed runtime components', () => {
    expect(getEdgeComponent({ component: 'zigzag' as any })).toBe('plain')
  })

  it('detects dashed edge presets', () => {
    expect(hasDash('plain')).toBe(false)
    expect(hasDash('dashed')).toBe(true)
    expect(hasDash('arrow')).toBe(false)
    expect(hasDash('dashed-arrow')).toBe(true)
  })

  it('detects arrow edge presets', () => {
    expect(hasArrow('plain')).toBe(false)
    expect(hasArrow('dashed')).toBe(false)
    expect(hasArrow('arrow')).toBe(true)
    expect(hasArrow('dashed-arrow')).toBe(true)
  })
})
