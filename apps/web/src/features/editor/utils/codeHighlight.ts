import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import go from 'highlight.js/lib/languages/go'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import python from 'highlight.js/lib/languages/python'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'

const REGISTERED_LANGUAGES = {
  bash,
  css,
  go,
  java,
  javascript,
  json,
  markdown,
  python,
  typescript,
  xml
} as const

let registered = false

function registerLanguages(): void {
  if (registered) {
    return
  }

  for (const [language, definition] of Object.entries(REGISTERED_LANGUAGES)) {
    hljs.registerLanguage(language, definition)
  }
  registered = true
}

export function highlightCode(code: string): { html: string; language: string | null } {
  if (code.length === 0) {
    return { html: '', language: null }
  }

  registerLanguages()
  const result = hljs.highlightAuto(code, Object.keys(REGISTERED_LANGUAGES))

  return {
    html: result.value,
    language: result.language ?? null
  }
}
