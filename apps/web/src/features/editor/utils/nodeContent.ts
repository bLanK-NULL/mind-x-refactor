import type { MindNodeType } from '@mind-x/shared'

export const NODE_TYPE_OPTIONS = [
  { label: 'Topic', type: 'topic' },
  { label: 'Image', type: 'image' },
  { label: 'Link', type: 'link' },
  { label: 'Attachment', type: 'attachment' },
  { label: 'Code', type: 'code' },
  { label: 'Task', type: 'task' }
] as const satisfies readonly { label: string; type: MindNodeType }[]
