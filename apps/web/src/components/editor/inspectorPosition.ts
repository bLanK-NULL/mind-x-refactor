import type { Point } from '@mind-x/shared'

export const DEFAULT_INSPECTOR_POSITION: Point = { x: 24, y: 88 }
export const INSPECTOR_MIN_OFFSET = 8
export const INSPECTOR_POSITION_STORAGE_KEY = 'mind-x-inspector-position'

type InspectorPositionStorage = Pick<Storage, 'getItem' | 'setItem'>

function getBrowserSessionStorage(): InspectorPositionStorage | null {
  try {
    if (typeof window === 'undefined') {
      return null
    }

    return window.sessionStorage
  } catch {
    return null
  }
}

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function defaultInspectorPosition(): Point {
  return { ...DEFAULT_INSPECTOR_POSITION }
}

export function clampInspectorPosition(position: Point): Point {
  return {
    x: Math.max(INSPECTOR_MIN_OFFSET, position.x),
    y: Math.max(INSPECTOR_MIN_OFFSET, position.y)
  }
}

export function readStoredInspectorPosition(
  storage: InspectorPositionStorage | null = getBrowserSessionStorage()
): Point {
  if (!storage) {
    return defaultInspectorPosition()
  }

  try {
    const rawPosition = storage.getItem(INSPECTOR_POSITION_STORAGE_KEY)
    if (!rawPosition) {
      return defaultInspectorPosition()
    }

    const parsedPosition: unknown = JSON.parse(rawPosition)
    if (typeof parsedPosition !== 'object' || parsedPosition === null) {
      return defaultInspectorPosition()
    }

    const { x, y } = parsedPosition as { x?: unknown; y?: unknown }
    if (!isFiniteCoordinate(x) || !isFiniteCoordinate(y)) {
      return defaultInspectorPosition()
    }

    return clampInspectorPosition({ x, y })
  } catch {
    return defaultInspectorPosition()
  }
}

export function writeStoredInspectorPosition(
  position: Point,
  storage: InspectorPositionStorage | null = getBrowserSessionStorage()
): boolean {
  if (!storage) {
    return false
  }

  try {
    storage.setItem(INSPECTOR_POSITION_STORAGE_KEY, JSON.stringify(clampInspectorPosition(position)))
    return true
  } catch {
    return false
  }
}
