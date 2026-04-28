import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectSummaryDto } from '@mind-x/shared'
import { publishCrossTabEvent, resetCrossTabChannelForTests, subscribeCrossTabEvents, type CrossTabEvent } from '../services/crossTab'

type Listener = (message: MessageEvent<CrossTabEvent>) => void

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = []

  listeners = new Set<Listener>()
  name: string
  postedMessages: CrossTabEvent[] = []

  constructor(name: string) {
    this.name = name
    FakeBroadcastChannel.instances.push(this)
  }

  addEventListener(eventName: string, listener: Listener): void {
    if (eventName === 'message') {
      this.listeners.add(listener)
    }
  }

  removeEventListener(eventName: string, listener: Listener): void {
    if (eventName === 'message') {
      this.listeners.delete(listener)
    }
  }

  close(): void {
    this.listeners.clear()
  }

  postMessage(message: CrossTabEvent): void {
    this.postedMessages.push(message)
  }

  emit(message: CrossTabEvent): void {
    const event = { data: message } as MessageEvent<CrossTabEvent>
    for (const listener of this.listeners) {
      listener(event)
    }
  }
}

describe('cross-tab project events', () => {
  beforeEach(() => {
    resetCrossTabChannelForTests()
    FakeBroadcastChannel.instances = []
  })

  afterEach(() => {
    resetCrossTabChannelForTests()
    vi.unstubAllGlobals()
  })

  it('falls back to no-ops when BroadcastChannel is unavailable', () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    const handler = vi.fn()

    const unsubscribe = subscribeCrossTabEvents(handler)

    expect(() => publishCrossTabEvent({ type: 'projects:refresh' })).not.toThrow()
    expect(() => unsubscribe()).not.toThrow()
    expect(handler).not.toHaveBeenCalled()
  })

  it('publishes, subscribes, and unsubscribes with BroadcastChannel', () => {
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
    const handler = vi.fn()
    const renamedProject: ProjectSummaryDto = {
      createdAt: '2026-01-01T00:00:00.000Z',
      id: 'project-1',
      name: 'Renamed',
      updatedAt: '2026-01-03T00:00:00.000Z'
    }

    const unsubscribe = subscribeCrossTabEvents(handler)
    publishCrossTabEvent({ project: renamedProject, type: 'project:renamed' })

    const channel = FakeBroadcastChannel.instances[0]
    expect(channel.name).toBe('mind-x')
    expect(channel.postedMessages).toEqual([{ project: renamedProject, type: 'project:renamed' }])

    channel.emit({ projectId: 'project-1', type: 'project:deleted' })
    expect(handler).toHaveBeenCalledWith({ projectId: 'project-1', type: 'project:deleted' })

    unsubscribe()
    channel.emit({ type: 'projects:refresh' })
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
