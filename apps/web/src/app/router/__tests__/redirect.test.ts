import { describe, expect, it } from 'vitest'
import { sanitizeRedirect } from '../redirect'

describe('sanitizeRedirect', () => {
  it('falls back to projects for missing or non-string redirect values', () => {
    expect(sanitizeRedirect(undefined)).toBe('/projects')
    expect(sanitizeRedirect(null)).toBe('/projects')
    expect(sanitizeRedirect(['/projects/one'])).toBe('/projects')
  })

  it('allows only known internal project routes', () => {
    expect(sanitizeRedirect('/projects')).toBe('/projects')
    expect(sanitizeRedirect('/projects/alpha')).toBe('/projects/alpha')
    expect(sanitizeRedirect('/projects/alpha?view=editor#node-1')).toBe(
      '/projects/alpha?view=editor#node-1'
    )
  })

  it('rejects login loops, external paths, and malformed app paths', () => {
    expect(sanitizeRedirect('/login')).toBe('/projects')
    expect(sanitizeRedirect('/login?redirect=/projects')).toBe('/projects')
    expect(sanitizeRedirect('//example.com/projects')).toBe('/projects')
    expect(sanitizeRedirect('https://example.com/projects')).toBe('/projects')
    expect(sanitizeRedirect('/settings')).toBe('/projects')
    expect(sanitizeRedirect('/projects/alpha/nested')).toBe('/projects')
  })
})
