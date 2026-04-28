import { describe, expect, it } from 'vitest'
import { DEFAULT_NODE_SHELL_STYLE, DEFAULT_NODE_SIZE_BY_TYPE, DEFAULT_TOPIC_CONTENT_STYLE, type Point } from '@mind-x/shared'
import { createEmptyDocument } from '../documentFactory.js'
import { createHistory } from '../history.js'
import { replaceWithPatchResult } from '../patches.js'

function topicNode(id: string, title: string, position: Point) {
  return {
    id,
    type: 'topic' as const,
    position,
    size: DEFAULT_NODE_SIZE_BY_TYPE.topic,
    shellStyle: { ...DEFAULT_NODE_SHELL_STYLE },
    data: { title },
    contentStyle: { ...DEFAULT_TOPIC_CONTENT_STYLE }
  }
}

describe('history', () => {
  it('undoes and redoes document patch entries', () => {
    const initial = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    const next = {
      ...initial,
      nodes: [topicNode('root', 'Root', { x: 0, y: 0 })]
    }
    const history = createHistory(initial)

    history.push(replaceWithPatchResult(initial, next))

    expect(history.current().nodes).toHaveLength(1)
    expect(history.undo().nodes).toHaveLength(0)
    expect(history.redo().nodes).toHaveLength(1)
  })

  it('truncates redo history after pushing a new value following undo', () => {
    const initial = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    const first = {
      ...initial,
      nodes: [topicNode('first', 'First', { x: 0, y: 0 })]
    }
    const replacement = {
      ...initial,
      nodes: [topicNode('replacement', 'Replacement', { x: 10, y: 20 })]
    }
    const history = createHistory(initial)

    history.push(replaceWithPatchResult(initial, first))
    history.undo()
    history.push(replaceWithPatchResult(initial, replacement))

    expect(history.canRedo()).toBe(false)
    expect(history.redo().nodes.map((node) => node.id)).toEqual(['replacement'])
  })

  it('does not push empty patch results', () => {
    const initial = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    const history = createHistory(initial)

    history.push(replaceWithPatchResult(initial, structuredClone(initial)))

    expect(history.canUndo()).toBe(false)
    expect(history.current()).toEqual(initial)
  })

  it('returns cloned current documents', () => {
    const initial = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    const history = createHistory(initial)

    const current = history.current()
    current.meta.title = 'Mutated outside history'

    expect(history.current().meta.title).toBe('Doc')
  })

  it('keeps boundary undo and redo as no-op reads', () => {
    const initial = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    const history = createHistory(initial)

    expect(history.undo()).toEqual(initial)
    expect(history.redo()).toEqual(initial)
    expect(history.canUndo()).toBe(false)
    expect(history.canRedo()).toBe(false)
  })

  it('replaces all historical states while preserving current index and redo entries', () => {
    const initial = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    const first = {
      ...initial,
      nodes: [topicNode('root', 'Root', { x: 0, y: 0 })]
    }
    const second = {
      ...first,
      nodes: [topicNode('root', 'Edited Root', { x: 0, y: 0 })]
    }
    const history = createHistory(initial)
    history.push(replaceWithPatchResult(initial, first))
    history.push(replaceWithPatchResult(first, second))
    history.undo()

    const renamedHistory = history.replaceAll((document) => ({
      ...document,
      meta: {
        ...document.meta,
        title: 'Renamed Project'
      }
    }))

    expect(renamedHistory.current().meta.title).toBe('Renamed Project')
    expect(renamedHistory.current().nodes[0].data.title).toBe('Root')
    expect(renamedHistory.canUndo()).toBe(true)
    expect(renamedHistory.canRedo()).toBe(true)

    expect(renamedHistory.undo().meta.title).toBe('Renamed Project')
    expect(renamedHistory.current().nodes).toEqual([])

    expect(renamedHistory.redo().nodes[0].data.title).toBe('Root')
    expect(renamedHistory.redo().nodes[0].data.title).toBe('Edited Root')
    expect(renamedHistory.current().meta.title).toBe('Renamed Project')
  })

  it('preserves replaceAll boundaries when transformed adjacent states become identical', () => {
    const base = createEmptyDocument({ projectId: 'p1', title: 'Base', now: '2026-04-26T00:00:00.000Z' })
    const first = {
      ...base,
      meta: {
        ...base.meta,
        title: 'Same'
      }
    }
    const second = {
      ...first,
      meta: {
        ...first.meta,
        title: 'Other'
      }
    }
    const history = createHistory(base)
    history.push(replaceWithPatchResult(base, first))
    history.push(replaceWithPatchResult(first, second))
    history.undo()

    const renamedHistory = history.replaceAll((document) => ({
      ...document,
      meta: {
        ...document.meta,
        title: 'Same'
      }
    }))

    expect(renamedHistory.current().meta.title).toBe('Same')
    expect(renamedHistory.canUndo()).toBe(true)
    expect(renamedHistory.canRedo()).toBe(true)

    expect(renamedHistory.undo().meta.title).toBe('Same')
    expect(renamedHistory.canUndo()).toBe(false)
    expect(renamedHistory.canRedo()).toBe(true)

    expect(renamedHistory.redo().meta.title).toBe('Same')
    expect(renamedHistory.canRedo()).toBe(true)
    expect(renamedHistory.redo().meta.title).toBe('Same')
    expect(renamedHistory.canRedo()).toBe(false)
  })
})
