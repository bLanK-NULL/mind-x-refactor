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

export function replaceWithPatchResult<T extends object>(previous: T, next: T): PatchResult<T> {
  const clonedNext = structuredClone(next)

  if (JSON.stringify(previous) === JSON.stringify(clonedNext)) {
    return {
      document: clonedNext,
      patches: [],
      inversePatches: []
    }
  }

  return createPatchResult(previous, () => castDraft(clonedNext))
}
