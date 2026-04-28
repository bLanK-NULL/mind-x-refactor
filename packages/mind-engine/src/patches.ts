import { castDraft, enablePatches, produceWithPatches, type Patch, type Producer } from 'immer'

enablePatches()

export type PatchResult<T extends object> = {
  document: T
  patches: Patch[]
  inversePatches: Patch[]
}

export function createPatchResult<T extends object>(
  document: T,
  recipe: Producer<T>
): PatchResult<T> {
  const [nextDocument, patches, inversePatches] = produceWithPatches(document, recipe)
  return {
    document: nextDocument,
    patches,
    inversePatches
  }
}

function isStructurallyEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true
  }

  if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) {
    return false
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false
    }

    return left.every((value, index) => isStructurallyEqual(value, right[index]))
  }

  if (!isPlainObject(left) || !isPlainObject(right)) {
    return false
  }

  const leftKeys = getEnumerableOwnKeys(left)
  const rightKeys = getEnumerableOwnKeys(right)

  if (leftKeys.length !== rightKeys.length) {
    return false
  }

  return leftKeys.every((key) => {
    if (!Object.prototype.hasOwnProperty.call(right, key)) {
      return false
    }

    return isStructurallyEqual(
      (left as Record<PropertyKey, unknown>)[key],
      (right as Record<PropertyKey, unknown>)[key]
    )
  })
}

function isPlainObject(value: object): value is Record<PropertyKey, unknown> {
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function getEnumerableOwnKeys(value: object): Array<string | symbol> {
  return [
    ...Object.keys(value),
    ...Object.getOwnPropertySymbols(value).filter((key) =>
      Object.prototype.propertyIsEnumerable.call(value, key)
    )
  ]
}

export function replaceWithPatchResult<T extends object>(previous: T, next: T): PatchResult<T> {
  const clonedNext = structuredClone(next)

  if (isStructurallyEqual(previous, clonedNext)) {
    return {
      document: clonedNext,
      patches: [],
      inversePatches: []
    }
  }

  return createPatchResult(previous, () => castDraft(clonedNext))
}
