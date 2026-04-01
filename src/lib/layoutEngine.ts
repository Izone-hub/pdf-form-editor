export type LinkedFieldBox = {
  fieldName: string
  width: number
  height: number
}

export type ReflowFieldSegment = {
  fieldName: string
  text: string
  start: number
  end: number
  maxLines: number
}

export type ReflowResult = {
  fullText: string
  fields: ReflowFieldSegment[]
  overflow: boolean
}

export type ReflowOptions = {
  paddingX?: number
  paddingY?: number
  lineHeightMultiplier?: number
  debug?: boolean
}

const DEFAULT_PADDING_X = 8
const DEFAULT_PADDING_Y = 6
const DEFAULT_LINE_HEIGHT_MULTIPLIER = 1.25

const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
const ctx = canvas?.getContext('2d') ?? null

const widthCache = new Map<string, number>()

function measureWidth(text: string, font: string): number {
  if (!ctx) return text.length * 7
  const key = `${font}|${text}`
  const cached = widthCache.get(key)
  if (cached !== undefined) return cached
  ctx.font = font
  const w = ctx.measureText(text).width
  widthCache.set(key, w)
  return w
}

function fitLineByWidth(text: string, start: number, maxWidth: number, font: string): number {
  if (start >= text.length) return start
  const newlineIdx = text.indexOf('\n', start)
  const hardLimit = newlineIdx === -1 ? text.length : newlineIdx
  if (hardLimit === start) return start + 1

  let lo = 1
  let hi = hardLimit - start
  let best = 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const piece = text.slice(start, start + mid)
    if (measureWidth(piece, font) <= maxWidth) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  let end = start + best
  if (end < hardLimit) {
    const slice = text.slice(start, end)
    const breakAt = Math.max(slice.lastIndexOf(' '), slice.lastIndexOf('\t'))
    if (breakAt > 0) end = start + breakAt + 1
  }
  return Math.max(start + 1, end)
}

function computeMaxLines(
  height: number,
  fontSizePx: number,
  paddingY: number,
  lineHeightMultiplier: number,
): number {
  const innerHeight = Math.max(0, height - paddingY * 2)
  const lineHeight = Math.max(1, Math.ceil(fontSizePx * lineHeightMultiplier))
  return Math.max(1, Math.floor(innerHeight / lineHeight))
}

function parseFontSizePx(font: string): number {
  const match = font.match(/(\d+(?:\.\d+)?)px/)
  return match ? Number(match[1]) : 14
}

export function reflowTextAcrossFields(
  fullText: string,
  fields: LinkedFieldBox[],
  font: string,
  options: ReflowOptions = {},
): ReflowResult {
  const paddingX = options.paddingX ?? DEFAULT_PADDING_X
  const paddingY = options.paddingY ?? DEFAULT_PADDING_Y
  const lineHeightMultiplier =
    options.lineHeightMultiplier ?? DEFAULT_LINE_HEIGHT_MULTIPLIER

  const fontSizePx = parseFontSizePx(font)
  const result: ReflowFieldSegment[] = []
  let cursor = 0

  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i]
    const isLast = i === fields.length - 1
    const maxWidth = Math.max(0, field.width - paddingX * 2)
    const maxLines = computeMaxLines(
      field.height,
      fontSizePx,
      paddingY,
      lineHeightMultiplier,
    )
    const start = cursor

    if (isLast) {
      cursor = fullText.length
      result.push({
        fieldName: field.fieldName,
        text: fullText.slice(start),
        start,
        end: cursor,
        maxLines,
      })
      continue
    }

    let linesUsed = 0
    while (cursor < fullText.length && linesUsed < maxLines) {
      const next = fitLineByWidth(fullText, cursor, maxWidth, font)
      cursor = next
      linesUsed += 1
      if (fullText[cursor - 1] === '\n') continue
      if (cursor >= fullText.length) break
    }

    result.push({
      fieldName: field.fieldName,
      text: fullText.slice(start, cursor),
      start,
      end: cursor,
      maxLines,
    })
  }

  if (options.debug) {
    // Debug output is intentionally concise for rapid tracing.
    console.debug('[layoutEngine] reflow', {
      chars: fullText.length,
      fields: result.map((r) => ({
        field: r.fieldName,
        range: [r.start, r.end],
        maxLines: r.maxLines,
      })),
    })
  }

  return {
    fullText,
    fields: result,
    overflow: result.at(-1)?.end !== fullText.length,
  }
}
