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
})
