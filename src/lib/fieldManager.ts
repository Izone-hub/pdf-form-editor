import type { GlobalCursor } from './cursorManager'
import { globalToLocalCursor, localToGlobalCursor } from './cursorManager'
import type { LinkedFieldBox, ReflowResult } from './layoutEngine'
import { reflowTextAcrossFields } from './layoutEngine'

export type LinkedFieldState = {
  fullText: string
  fields: string[]
}

export type LinkedFieldManagerConfig = {
  fieldOrder: string[]
  font: string
  debounceMs?: number
  debug?: boolean
}

export type ReflowContext = {
  layout: LinkedFieldBox[]
  previous: ReflowResult | null
  activeFieldIndex: number
  localSelectionStart: number
  localSelectionEnd: number
}

export type ReflowOutcome = {
  state: LinkedFieldState
  reflow: ReflowResult
  cursor: GlobalCursor
}

export class LinkedFieldManager {
  private readonly config: Required<LinkedFieldManagerConfig>

  private debouncedHandle: number | null = null

  private snapshot: LinkedFieldState = { fullText: '', fields: [] }

  constructor(config: LinkedFieldManagerConfig) {
    this.config = {
      debounceMs: config.debounceMs ?? 16,
      debug: config.debug ?? false,
      ...config,
    }
  }

  getState(): LinkedFieldState {
    return this.snapshot
  }

  setFullText(text: string) {
    this.snapshot = { ...this.snapshot, fullText: text }
  }

  clear() {
    this.snapshot = { fullText: '', fields: this.config.fieldOrder.map(() => '') }
  }

  schedule(fn: () => void) {
    if (this.config.debounceMs <= 0) {
      fn()
      return
    }
    if (this.debouncedHandle !== null) window.clearTimeout(this.debouncedHandle)
    this.debouncedHandle = window.setTimeout(fn, this.config.debounceMs)
  }

  cancelScheduled() {
    if (this.debouncedHandle !== null) window.clearTimeout(this.debouncedHandle)
    this.debouncedHandle = null
  }

  reflow(layout: LinkedFieldBox[]): ReflowResult {
    const reflow = reflowTextAcrossFields(this.snapshot.fullText, layout, this.config.font, {
      debug: this.config.debug,
    })
    this.snapshot = {
      fullText: reflow.fullText,
      fields: reflow.fields.map((f) => f.text),
    }
    return reflow
  }

  applyDomInput(values: string[], context: ReflowContext): ReflowOutcome {
    const anchoredIndex = Math.max(0, Math.min(context.activeFieldIndex, values.length - 1))
    const prefixValues = values.slice(0, anchoredIndex)
    const anchoredValues = values.slice(anchoredIndex)
    const prefixLength = prefixValues.reduce((sum, text) => sum + text.length, 0)
    const anchoredText = anchoredValues.join('')
    const fullText = prefixValues.join('') + anchoredText
    const old = context.previous
    const cursor = old
      ? localToGlobalCursor(
          anchoredIndex,
          context.localSelectionStart,
          context.localSelectionEnd,
          old.fields,
          fullText.length,
        )
      : {
          start: prefixLength + context.localSelectionStart,
          end: prefixLength + context.localSelectionEnd,
          direction: 'none' as const,
        }

    const anchoredLayout = context.layout.slice(anchoredIndex)
    const anchoredReflow = reflowTextAcrossFields(anchoredText, anchoredLayout, this.config.font, {
      debug: this.config.debug,
    })
    const fields = [] as ReflowResult['fields']
    let running = 0

    for (let i = 0; i < prefixValues.length; i += 1) {
      const text = prefixValues[i]
      fields.push({
        fieldName: context.layout[i]?.fieldName ?? this.config.fieldOrder[i] ?? `field_${i}`,
        text,
        start: running,
        end: running + text.length,
        maxLines: 1,
      })
      running += text.length
    }

    for (let i = 0; i < anchoredReflow.fields.length; i += 1) {
      const segment = anchoredReflow.fields[i]
      fields.push({
        ...segment,
        start: running + segment.start,
        end: running + segment.end,
      })
    }

    const reflow: ReflowResult = {
      fullText,
      fields,
      overflow: anchoredReflow.overflow,
    }
    this.snapshot = {
      fullText,
      fields: reflow.fields.map((f) => f.text),
    }
    return {
      state: this.snapshot,
      reflow,
      cursor,
    }
  }

  resolveLocalCursor(cursor: GlobalCursor, reflow: ReflowResult) {
    return globalToLocalCursor(cursor, reflow.fields)
  }
}
