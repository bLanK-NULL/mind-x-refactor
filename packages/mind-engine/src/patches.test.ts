import { describe, expect, it } from 'vitest'

import { replaceWithPatchResult } from './patches.js'

describe('patch utilities', () => {
  it('returns empty patches for unchanged roots', () => {
    const result = replaceWithPatchResult({ title: 'Root', tags: ['mind'] }, { title: 'Root', tags: ['mind'] })

    expect(result.document).toEqual({ title: 'Root', tags: ['mind'] })
    expect(result.patches).toEqual([])
    expect(result.inversePatches).toEqual([])
  })

  it('patches removal of undefined-valued object keys', () => {
    const result = replaceWithPatchResult<{ a?: undefined }>({ a: undefined }, {})

    expect(result.document).toEqual({})
    expect(result.patches).not.toEqual([])
    expect(result.inversePatches).not.toEqual([])
  })

  it('does not throw when equal values include BigInt', () => {
    expect(() => replaceWithPatchResult({ count: 1n }, { count: 1n })).not.toThrow()

    const result = replaceWithPatchResult({ count: 1n }, { count: 1n })

    expect(result.patches).toEqual([])
    expect(result.inversePatches).toEqual([])
  })

  it('replaces array roots without leaving stale length', () => {
    const result = replaceWithPatchResult([1, 2, 3], [4])

    expect(result.document).toEqual([4])
    expect(result.document).toHaveLength(1)
    expect(result.patches).toEqual([{ op: 'replace', path: [], value: [4] }])
    expect(result.inversePatches).toEqual([{ op: 'replace', path: [], value: [1, 2, 3] }])
  })
})
