/** Split combined text across fields by measured width; remainder stays in the last field (may overflow visually). */
export function splitTextForFields(
  text: string,
  fieldWidthsPx: number[],
  font: string,
  horizontalPaddingPx = 8,
): string[] {
  if (fieldWidthsPx.length === 0) return []
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return fieldWidthsPx.map(() => '')
  ctx.font = font
  const available = fieldWidthsPx.map((w) =>
    Math.max(0, w - horizontalPaddingPx * 2),
  )
  const result: string[] = []
  let rest = text
  for (let i = 0; i < available.length; i++) {
    const maxW = available[i]
    const isLast = i === available.length - 1
    if (isLast) {
      result.push(rest)
      break
    }
    if (rest.length === 0) {
      result.push('')
      continue
    }
    if (maxW <= 0) {
      result.push('')
      continue
    }
    let lo = 0
    let hi = rest.length
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      if (ctx.measureText(rest.slice(0, mid)).width <= maxW) lo = mid
      else hi = mid - 1
    }
    const take = lo
    result.push(rest.slice(0, take))
    rest = rest.slice(take)
  }
  return result
}

/** Merge a single field edit into the combined string using previous segment lengths. */
export function mergeFieldEdit(
  combined: string,
  segments: string[],
  fieldIndex: number,
  newLocalValue: string,
): string {
  const start = segments
    .slice(0, fieldIndex)
    .reduce((sum, s) => sum + s.length, 0)
  const oldLen = segments[fieldIndex]?.length ?? 0
  return combined.slice(0, start) + newLocalValue + combined.slice(start + oldLen)
}
