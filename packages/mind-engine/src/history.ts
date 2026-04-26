export type History<T> = {
  current(): T
  push(value: T): void
  undo(): T
  redo(): T
  canUndo(): boolean
  canRedo(): boolean
}

export function createHistory<T>(initial: T): History<T> {
  let stack = [structuredClone(initial)]
  let index = 0

  return {
    current() {
      return structuredClone(stack[index])
    },
    push(value) {
      stack = stack.slice(0, index + 1)
      stack.push(structuredClone(value))
      index = stack.length - 1
    },
    undo() {
      if (index > 0) {
        index -= 1
      }
      return structuredClone(stack[index])
    },
    redo() {
      if (index < stack.length - 1) {
        index += 1
      }
      return structuredClone(stack[index])
    },
    canUndo() {
      return index > 0
    },
    canRedo() {
      return index < stack.length - 1
    }
  }
}
