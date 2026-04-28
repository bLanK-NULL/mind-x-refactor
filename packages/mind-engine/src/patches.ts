import { enablePatches, produceWithPatches, type Draft, type Patch } from 'immer'

enablePatches()

export type PatchResult<T extends object> = {
  document: T
  patches: Patch[]
  inversePatches: Patch[]
}

export function createPatchResult<T extends object>(
  document: T,
  recipe: (draft: Draft<T>) => void
): PatchResult<T> {
  const [nextDocument, patches, inversePatches] = produceWithPatches(document, recipe)
  return {
    document: nextDocument,
    patches,
    inversePatches
  }
}

export function replaceWithPatchResult<T extends object>(previous: T, next: T): PatchResult<T> {
  const clonedNext = structuredClone(next)

  if (JSON.stringify(previous) === JSON.stringify(clonedNext)) {
    return {
      document: clonedNext,
      patches: [],
      inversePatches: []
    }
  }

  return createPatchResult(previous, (draft) => {
    const target = draft as unknown as Record<string, unknown>
    for (const key of Object.keys(target)) {
      delete target[key]
    }
    Object.assign(target, clonedNext)
  })
}
