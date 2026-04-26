export type CrossTabEvent =
  | { type: 'projects:refresh' }
  | { name: string; projectId: string; type: 'project:renamed' }
  | { projectId: string; type: 'project:deleted' }

type CrossTabHandler = (event: CrossTabEvent) => void

const CHANNEL_NAME = 'mind-x'

let channel: BroadcastChannel | null | undefined

export function publishCrossTabEvent(event: CrossTabEvent): void {
  getChannel()?.postMessage(event)
}

export function subscribeCrossTabEvents(handler: CrossTabHandler): () => void {
  const activeChannel = getChannel()
  if (activeChannel === null) {
    return () => {}
  }

  const listener = (message: MessageEvent<CrossTabEvent>) => {
    handler(message.data)
  }

  activeChannel.addEventListener('message', listener)

  return () => {
    activeChannel.removeEventListener('message', listener)
  }
}

function getChannel(): BroadcastChannel | null {
  if (channel !== undefined) {
    return channel
  }

  if (typeof globalThis.BroadcastChannel === 'undefined') {
    return null
  }

  try {
    channel = new BroadcastChannel(CHANNEL_NAME)
  } catch {
    channel = null
  }

  return channel
}
