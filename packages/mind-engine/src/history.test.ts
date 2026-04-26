import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from './documentFactory.js'
import { createHistory } from './history.js'

describe('history', () => {
  it('undoes and redoes document snapshots', () => {
    const initial = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    const next = {
      ...initial,
      nodes: [{ id: 'root', type: 'topic' as const, position: { x: 0, y: 0 }, data: { title: 'Root' } }]
    }
    const history = createHistory(initial)

    history.push(next)

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

    history.push(first)
    history.undo()
    history.push(replacement)

    expect(history.canRedo()).toBe(false)
    expect(history.redo().nodes.map((node) => node.id)).toEqual(['replacement'])
  })
})
