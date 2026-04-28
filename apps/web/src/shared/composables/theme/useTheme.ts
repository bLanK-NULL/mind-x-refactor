import type { ThemeName } from '@mind-x/shared'
import type { ThemeConfig } from 'ant-design-vue/es/config-provider/context'
import { theme as antTheme } from 'ant-design-vue'
import { computed, readonly, ref } from 'vue'

const THEME_STORAGE_KEY = 'mind-x-theme'

export const THEME_NAMES = ['light', 'dark', 'colorful', 'vivid'] as const satisfies readonly ThemeName[]

export const THEME_LABELS: Record<ThemeName, string> = {
  colorful: 'Colorful',
  dark: 'Dark',
  light: 'Light',
  vivid: 'Vivid'
}

const COLOR_PRIMARY_BY_THEME: Record<ThemeName, string> = {
  colorful: '#2563eb',
  dark: '#6aa7ff',
  light: '#1677ff',
  vivid: '#c026d3'
}

type ThemeRoot = Pick<HTMLElement, 'setAttribute'>
type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>

export type ThemeControllerOptions = {
  root?: ThemeRoot | null
  storage?: ThemeStorage | null
}

export type SetThemeOptions = {
  persist?: boolean
}

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === 'string' && (THEME_NAMES as readonly string[]).includes(value)
}

function getBrowserRoot(): ThemeRoot | null {
  if (typeof document === 'undefined') {
    return null
  }

  return document.documentElement
}

function getBrowserStorage(): ThemeStorage | null {
  try {
    if (typeof window === 'undefined') {
      return null
    }

    return window.localStorage
  } catch {
    return null
  }
}

export function createThemeController(options: ThemeControllerOptions = {}) {
  const currentTheme = ref<ThemeName>('light')
  const antDesignTheme = computed<ThemeConfig>(() => ({
    algorithm: currentTheme.value === 'dark' ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
    token: {
      borderRadius: 8,
      colorPrimary: COLOR_PRIMARY_BY_THEME[currentTheme.value]
    }
  }))

  function getRoot(): ThemeRoot | null {
    return options.root === undefined ? getBrowserRoot() : options.root
  }

  function getStorage(): ThemeStorage | null {
    return options.storage === undefined ? getBrowserStorage() : options.storage
  }

  function readStoredTheme(): ThemeName | null {
    try {
      const storedTheme = getStorage()?.getItem(THEME_STORAGE_KEY)
      return isThemeName(storedTheme) ? storedTheme : null
    } catch {
      return null
    }
  }

  function applyTheme(themeName: ThemeName): void {
    currentTheme.value = themeName
    getRoot()?.setAttribute('theme', themeName)
  }

  function persistTheme(themeName: ThemeName): void {
    try {
      getStorage()?.setItem(THEME_STORAGE_KEY, themeName)
    } catch {
      // Storage failures should never block the visible theme change.
    }
  }

  function setTheme(themeName: ThemeName, setThemeOptions: SetThemeOptions = {}): ThemeName {
    applyTheme(themeName)
    if (setThemeOptions.persist !== false) {
      persistTheme(themeName)
    }
    return themeName
  }

  function initializeTheme(initialTheme?: unknown): ThemeName {
    const themeName = isThemeName(initialTheme) ? initialTheme : readStoredTheme() ?? 'light'
    return setTheme(themeName, { persist: false })
  }

  function toggleTheme(): ThemeName {
    return setTheme(currentTheme.value === 'dark' ? 'light' : 'dark')
  }

  return {
    antDesignTheme,
    currentTheme: readonly(currentTheme),
    initializeTheme,
    setTheme,
    toggleTheme
  }
}

const themeController = createThemeController()

export function initializeTheme(initialTheme?: unknown): ThemeName {
  return themeController.initializeTheme(initialTheme)
}

export function useTheme() {
  return themeController
}
