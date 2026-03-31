import type { ReflowFieldSegment } from './layoutEngine'

export type GlobalCursor = {
  start: number
  end: number
  direction: 'forward' | 'backward' | 'none'
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export function localToGlobalCursor(
  fieldIndex: number,
  localStart: number,
  localEnd: number,
  segments: ReflowFieldSegment[],
  fullLength: number,
): GlobalCursor {
  const seg = segments[fieldIndex]
  const base = seg?.start ?? 0
  return {
    start: clamp(base + localStart, 0, fullLength),
    end: clamp(base + localEnd, 0, fullLength),
    direction: localStart <= localEnd ? 'forward' : 'backward',
  }
}

export function globalToLocalCursor(
  global: GlobalCursor,
  segments: ReflowFieldSegment[],
): { fieldIndex: number; localStart: number; localEnd: number; direction: GlobalCursor['direction'] } {
  const first = segments[0]
  if (!first) {
    return { fieldIndex: 0, localStart: 0, localEnd: 0, direction: global.direction }
  }

  let index = segments.length - 1
  for (let i = 0; i < segments.length; i += 1) {
    const s = segments[i]
    if (global.start >= s.start && global.start <= s.end) {
      index = i
      break
    }
  }

  const seg = segments[index]
  const localStart = clamp(global.start - seg.start, 0, seg.text.length)
  const localEnd = clamp(global.end - seg.start, 0, seg.text.length)
  return {
    fieldIndex: index,
    localStart,
    localEnd,
    direction: global.direction,
  }
}
