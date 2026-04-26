const FALLBACK_ROUTE = '/projects'

export function sanitizeRedirect(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || !value.startsWith('/')) {
    return FALLBACK_ROUTE
  }

  if (value.startsWith('//')) {
    return FALLBACK_ROUTE
  }

  let url: URL
  try {
    url = new URL(value, 'http://mind-x.local')
  } catch {
    return FALLBACK_ROUTE
  }

  if (url.origin !== 'http://mind-x.local') {
    return FALLBACK_ROUTE
  }

  if (url.pathname === FALLBACK_ROUTE || /^\/projects\/[^/]+$/.test(url.pathname)) {
    return `${url.pathname}${url.search}${url.hash}`
  }

  return FALLBACK_ROUTE
}
