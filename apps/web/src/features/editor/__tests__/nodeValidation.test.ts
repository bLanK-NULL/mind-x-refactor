import { CODE_NODE_CODE_MAX_LENGTH, PLAIN_TEXT_MAX_LENGTH } from '@mind-x/shared'
import { describe, expect, it } from 'vitest'
import { isValidCode, isValidOptionalPlainText, isValidPlainText, isValidWebUrl } from '../utils/nodeValidation'

describe('nodeValidation', () => {
  it('rejects plain text values that strict document parsing would reject', () => {
    expect(isValidPlainText('Title')).toBe(true)
    expect(isValidPlainText('')).toBe(false)
    expect(isValidPlainText('<b>Title</b>')).toBe(false)
    expect(isValidPlainText('x'.repeat(PLAIN_TEXT_MAX_LENGTH + 1))).toBe(false)
  })

  it('allows empty optional text but still enforces syntax and max length', () => {
    expect(isValidOptionalPlainText('')).toBe(true)
    expect(isValidOptionalPlainText('Alt text')).toBe(true)
    expect(isValidOptionalPlainText('<alt>')).toBe(false)
    expect(isValidOptionalPlainText('x'.repeat(PLAIN_TEXT_MAX_LENGTH + 1))).toBe(false)
  })

  it('rejects oversized code edits before they reach the strict schema', () => {
    expect(isValidCode('const answer = 42')).toBe(true)
    expect(isValidCode('x'.repeat(CODE_NODE_CODE_MAX_LENGTH + 1))).toBe(false)
  })

  it('accepts only http and https URLs', () => {
    expect(isValidWebUrl('https://example.com')).toBe(true)
    expect(isValidWebUrl('http://example.com')).toBe(true)
    expect(isValidWebUrl('javascript:alert(1)')).toBe(false)
  })
})
