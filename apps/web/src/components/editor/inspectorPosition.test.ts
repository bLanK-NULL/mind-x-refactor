import { describe, expect, it } from 'vitest'
import {
  DEFAULT_INSPECTOR_POSITION,
  INSPECTOR_MIN_OFFSET,
  INSPECTOR_POSITION_STORAGE_KEY,
  clampInspectorPosition,
  readStoredInspectorPosition,
  writeStoredInspectorPosition
} from './inspectorPosition'

class FakeInspectorPositionStorage {
  items = new Map<string, string>()
  failReads = false
  failWrites = false

  getItem(key: string): string | null {
    if (this.failReads) {
      throw new Error('read failed')
    }

    return this.items.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) {
      throw new Error('write failed')
    }

    this.items.set(key, value)
  }
}

describe('inspector position persistence', () => {
  it('returns the default position when storage has no value', () => {
    const storage = new FakeInspectorPositionStorage()

    expect(readStoredInspectorPosition(storage)).toEqual(DEFAULT_INSPECTOR_POSITION)
  })

  it('reads a valid stored position', () => {
    const storage = new FakeInspectorPositionStorage()
    storage.items.set(INSPECTOR_POSITION_STORAGE_KEY, JSON.stringify({ x: 180, y: 220 }))

    expect(readStoredInspectorPosition(storage)).toEqual({ x: 180, y: 220 })
  })

  it.each([
    ['malformed json', '{'],
    ['null', 'null'],
    ['missing x', '{"y": 20}'],
    ['missing y', '{"x": 20}'],
    ['string x', '{"x": "20", "y": 30}'],
    ['string y', '{"x": 20, "y": "30"}'],
    ['null x', '{"x": null, "y": 30}'],
    ['null y', '{"x": 20, "y": null}']
  ])('falls back to default for %s', (_label, storedValue) => {
    const storage = new FakeInspectorPositionStorage()
    storage.items.set(INSPECTOR_POSITION_STORAGE_KEY, storedValue)

    expect(readStoredInspectorPosition(storage)).toEqual(DEFAULT_INSPECTOR_POSITION)
  })

  it('clamps loaded positions to the minimum top-left offset', () => {
    const storage = new FakeInspectorPositionStorage()
    storage.items.set(INSPECTOR_POSITION_STORAGE_KEY, JSON.stringify({ x: -100, y: 2 }))

    expect(readStoredInspectorPosition(storage)).toEqual({
      x: INSPECTOR_MIN_OFFSET,
      y: INSPECTOR_MIN_OFFSET
    })
  })

  it('clamps arbitrary inspector positions', () => {
    expect(clampInspectorPosition({ x: 4, y: 320 })).toEqual({ x: INSPECTOR_MIN_OFFSET, y: 320 })
  })

  it('writes clamped positions to storage', () => {
    const storage = new FakeInspectorPositionStorage()

    expect(writeStoredInspectorPosition({ x: 64, y: -9 }, storage)).toBe(true)
    expect(storage.items.get(INSPECTOR_POSITION_STORAGE_KEY)).toBe(
      JSON.stringify({ x: 64, y: INSPECTOR_MIN_OFFSET })
    )
  })

  it('handles storage read and write failures without throwing', () => {
    const storage = new FakeInspectorPositionStorage()
    storage.failReads = true
    storage.failWrites = true

    expect(() => readStoredInspectorPosition(storage)).not.toThrow()
    expect(readStoredInspectorPosition(storage)).toEqual(DEFAULT_INSPECTOR_POSITION)
    expect(() => writeStoredInspectorPosition({ x: 64, y: 96 }, storage)).not.toThrow()
    expect(writeStoredInspectorPosition({ x: 64, y: 96 }, storage)).toBe(false)
  })

  it('returns false when no storage object is available for writes', () => {
    expect(writeStoredInspectorPosition({ x: 64, y: 96 }, null)).toBe(false)
  })
})
