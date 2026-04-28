function styleValueEquals(currentValue: unknown, nextValue: unknown): boolean {
  if (Object.is(currentValue, nextValue)) {
    return true
  }

  if (Array.isArray(currentValue) || Array.isArray(nextValue)) {
    return (
      Array.isArray(currentValue) &&
      Array.isArray(nextValue) &&
      currentValue.length === nextValue.length &&
      currentValue.every((value, index) => styleValueEquals(value, nextValue[index]))
    )
  }

  if (
    typeof currentValue !== 'object' ||
    currentValue === null ||
    typeof nextValue !== 'object' ||
    nextValue === null
  ) {
    return false
  }

  const currentRecord = currentValue as Record<string, unknown>
  const nextRecord = nextValue as Record<string, unknown>
  const currentKeys = Object.keys(currentRecord)
  const nextKeys = Object.keys(nextRecord)

  return (
    currentKeys.length === nextKeys.length &&
    currentKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(nextRecord, key) && styleValueEquals(currentRecord[key], nextRecord[key])
    )
  )
}

export function isStylePatchNoop<TStyle extends object>(style: TStyle, stylePatch: Partial<TStyle>): boolean {
  return (Object.entries(stylePatch) as Array<[keyof TStyle, TStyle[keyof TStyle]]>).every(([key, value]) =>
    styleValueEquals(style[key], value)
  )
}
