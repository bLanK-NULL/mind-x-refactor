import { describe, expect, it } from 'vitest'
import { createThemeController, isThemeName } from '../useTheme'

class FakeThemeRoot {
  attributes = new Map<string, string>()

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value)
  }
}

class FakeThemeStorage {
  items = new Map<string, string>()
  failReads = false
  failWrites = false

  getItem(key: string): string | null {
    if (this.failReads) {
      throw new Error('read failed')
    }

    return this.items.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) {
      throw new Error('write failed')
    }

    this.items.set(key, value)
  }
}

describe('theme controller', () => {
  it('accepts only supported theme names', () => {
    expect(isThemeName('light')).toBe(true)
    expect(isThemeName('dark')).toBe(true)
    expect(isThemeName('colorful')).toBe(true)
    expect(isThemeName('vivid')).toBe(true)
    expect(isThemeName('night')).toBe(false)
    expect(isThemeName(null)).toBe(false)
  })

  it('sets colorful and vivid themes directly with matching Ant Design primary colors', () => {
    const root = new FakeThemeRoot()
    const storage = new FakeThemeStorage()
    const controller = createThemeController({ root, storage })

    controller.setTheme('colorful')

    expect(controller.currentTheme.value).toBe('colorful')
    expect(root.attributes.get('theme')).toBe('colorful')
    expect(storage.items.get('mind-x-theme')).toBe('colorful')
    expect(controller.antDesignTheme.value.token?.colorPrimary).toBe('#2563eb')

    controller.setTheme('vivid')

    expect(controller.currentTheme.value).toBe('vivid')
    expect(root.attributes.get('theme')).toBe('vivid')
    expect(storage.items.get('mind-x-theme')).toBe('vivid')
    expect(controller.antDesignTheme.value.token?.colorPrimary).toBe('#c026d3')
  })

  it('initializes from a stored dark theme and applies it to the root element', () => {
    const root = new FakeThemeRoot()
    const storage = new FakeThemeStorage()
    storage.items.set('mind-x-theme', 'dark')
    const controller = createThemeController({ root, storage })

    controller.initializeTheme()

    expect(controller.currentTheme.value).toBe('dark')
    expect(root.attributes.get('theme')).toBe('dark')
  })

  it('falls back to light when stored data is invalid', () => {
    const root = new FakeThemeRoot()
    const storage = new FakeThemeStorage()
    storage.items.set('mind-x-theme', 'high-contrast')
    const controller = createThemeController({ root, storage })

    controller.initializeTheme()

    expect(controller.currentTheme.value).toBe('light')
    expect(root.attributes.get('theme')).toBe('light')
  })

  it('toggles the current theme and persists the next value', () => {
    const root = new FakeThemeRoot()
    const storage = new FakeThemeStorage()
    const controller = createThemeController({ root, storage })
    controller.initializeTheme('light')

    const nextTheme = controller.toggleTheme()

    expect(nextTheme).toBe('dark')
    expect(controller.currentTheme.value).toBe('dark')
    expect(root.attributes.get('theme')).toBe('dark')
    expect(storage.items.get('mind-x-theme')).toBe('dark')
  })

  it('guards storage failures while still applying the theme', () => {
    const root = new FakeThemeRoot()
    const storage = new FakeThemeStorage()
    storage.failReads = true
    storage.failWrites = true
    const controller = createThemeController({ root, storage })

    expect(() => controller.initializeTheme()).not.toThrow()
    expect(() => controller.setTheme('dark')).not.toThrow()
    expect(controller.currentTheme.value).toBe('dark')
    expect(root.attributes.get('theme')).toBe('dark')
  })
})
