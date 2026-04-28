import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from './documentFactory.js'
import { createHistory } from './history.js'
import { replaceWithPatchResult } from './patches.js'

describe('history', () => {
  it('undoes and redoes document patch entries', () => {
    const initial = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    const next = {
      ...initial,
      nodes: [{ id: 'root', type: 'topic' as const, position: { x: 0, y: 0 }, data: { title: 'Root' } }]
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
      nodes: [{ id: 'first', type: 'topic' as const, position: { x: 0, y: 0 }, data: { title: 'First' } }]
    }
    const replacement = {
      ...initial,
      nodes: [{ id: 'replacement', type: 'topic' as const, position: { x: 10, y: 20 }, data: { title: 'Replacement' } }]
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
      nodes: [{ id: 'root', type: 'topic' as const, position: { x: 0, y: 0 }, data: { title: 'Root' } }]
    }
    const second = {
      ...first,
      nodes: [{ id: 'root', type: 'topic' as const, position: { x: 0, y: 0 }, data: { title: 'Edited Root' } }]
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
})
