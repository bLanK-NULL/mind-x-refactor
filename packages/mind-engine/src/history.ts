import { applyPatches, type Patch } from 'immer'
import { type PatchResult, replaceWithPatchResult } from './patches.js'

export type HistoryEntry = {
  patches: Patch[]
  inversePatches: Patch[]
}

export type History<T extends object> = {
  current(): T
  push(result: PatchResult<T>): void
  undo(): T
  redo(): T
  canUndo(): boolean
  canRedo(): boolean
  replaceAll(transform: (document: T) => T): History<T>
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function cloneEntry(entry: HistoryEntry): HistoryEntry {
  return {
    patches: clone(entry.patches),
    inversePatches: clone(entry.inversePatches)
  }
}

export function createHistory<T extends object>(initial: T): History<T> {
  const base = clone(initial)
  let current = clone(initial)
  let entries: HistoryEntry[] = []
  let index = 0

  return {
    current() {
      return clone(current)
    },
    push(result) {
      if (result.patches.length === 0) {
        current = clone(result.document)
        return
      }

      entries = entries.slice(0, index)
      entries.push({
        patches: clone(result.patches),
        inversePatches: clone(result.inversePatches)
      })
      index = entries.length
      current = clone(result.document)
    },
    undo() {
      if (index > 0) {
        const entry = entries[index - 1]
        current = applyPatches(current, entry.inversePatches)
        index -= 1
      }
      return clone(current)
    },
    redo() {
      if (index < entries.length) {
        const entry = entries[index]
        current = applyPatches(current, entry.patches)
        index += 1
      }
      return clone(current)
    },
    canUndo() {
      return index > 0
    },
    canRedo() {
      return index < entries.length
    },
    replaceAll(transform) {
      const originalEntries = entries.map(cloneEntry)
      const originalIndex = index
      const states = [clone(base)]
      let replayed = clone(base)

      for (const entry of originalEntries) {
        replayed = applyPatches(replayed, entry.patches)
        states.push(clone(replayed))
      }

      const transformedStates = states.map((state) => transform(clone(state)))
      const nextHistory = createHistory(transformedStates[0])

      for (let stateIndex = 1; stateIndex < transformedStates.length; stateIndex += 1) {
        nextHistory.push(replaceWithPatchResult(transformedStates[stateIndex - 1], transformedStates[stateIndex]))
      }

      for (let stateIndex = transformedStates.length - 1; stateIndex > originalIndex; stateIndex -= 1) {
        nextHistory.undo()
      }

      return nextHistory
    }
  }
}
