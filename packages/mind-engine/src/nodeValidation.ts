import { CODE_NODE_CODE_MAX_LENGTH, PLAIN_TEXT_MAX_LENGTH } from '@mind-x/shared'

export function isValidPlainText(value: string): boolean {
  const text = value.trim()
  return text.length > 0 && text.length <= PLAIN_TEXT_MAX_LENGTH && !/[<>]/.test(text)
}

export function isValidOptionalPlainText(value: string): boolean {
  const text = value.trim()
  return text.length === 0 || (text.length <= PLAIN_TEXT_MAX_LENGTH && !/[<>]/.test(text))
}

export function isValidCode(value: string): boolean {
  return value.length <= CODE_NODE_CODE_MAX_LENGTH
}

export function isValidWebUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
