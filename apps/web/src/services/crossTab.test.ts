import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { publishCrossTabEvent, subscribeCrossTabEvents, type CrossTabEvent } from './crossTab'

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
    FakeBroadcastChannel.instances = []
  })

  afterEach(() => {
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

    const unsubscribe = subscribeCrossTabEvents(handler)
    publishCrossTabEvent({ projectId: 'project-1', name: 'Renamed', type: 'project:renamed' })

    const channel = FakeBroadcastChannel.instances[0]
    expect(channel.name).toBe('mind-x')
    expect(channel.postedMessages).toEqual([{ projectId: 'project-1', name: 'Renamed', type: 'project:renamed' }])

    channel.emit({ projectId: 'project-1', type: 'project:deleted' })
    expect(handler).toHaveBeenCalledWith({ projectId: 'project-1', type: 'project:deleted' })

    unsubscribe()
    channel.emit({ type: 'projects:refresh' })
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
