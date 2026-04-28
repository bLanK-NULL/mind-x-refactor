import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearStoredToken, readStoredToken, writeStoredToken } from '../client'

function stubStorage(storage: Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>): void {
  vi.stubGlobal('window', {
    localStorage: storage
  })
}

describe('auth token storage helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null when reading from localStorage throws', () => {
    stubStorage({
      getItem: () => {
        throw new DOMException('Blocked', 'SecurityError')
      },
      removeItem: vi.fn(),
      setItem: vi.fn()
    })

    expect(readStoredToken()).toBeNull()
  })

  it('reports whether writing and clearing localStorage succeeded', () => {
    const workingStorage = {
      getItem: vi.fn(),
      removeItem: vi.fn(),
      setItem: vi.fn()
    }
    stubStorage(workingStorage)

    expect(writeStoredToken('token')).toBe(true)
    expect(clearStoredToken()).toBe(true)
    expect(workingStorage.setItem).toHaveBeenCalledWith('mind-x-token', 'token')
    expect(workingStorage.removeItem).toHaveBeenCalledWith('mind-x-token')
  })

  it('returns false when writing or clearing localStorage throws', () => {
    stubStorage({
      getItem: vi.fn(),
      removeItem: () => {
        throw new DOMException('Blocked', 'SecurityError')
      },
      setItem: () => {
        throw new DOMException('Blocked', 'SecurityError')
      }
    })

    expect(writeStoredToken('token')).toBe(false)
    expect(clearStoredToken()).toBe(false)
  })
})
