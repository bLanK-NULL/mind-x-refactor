import { describe, expect, it } from 'vitest'

import { replaceWithPatchResult } from './patches.js'

describe('patch utilities', () => {
  it('replaces array roots without leaving stale length', () => {
    const result = replaceWithPatchResult([1, 2, 3], [4])

    expect(result.document).toEqual([4])
    expect(result.document).toHaveLength(1)
    expect(result.patches).toEqual([{ op: 'replace', path: [], value: [4] }])
    expect(result.inversePatches).toEqual([{ op: 'replace', path: [], value: [1, 2, 3] }])
  })
})
