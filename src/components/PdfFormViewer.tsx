import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  PDFDocumentProxy,
  PDFPageProxy,
  PageViewport,
} from 'pdfjs-dist'
import { pdfjsLib } from '../lib/pdf'
import { mergeFieldEdit, splitTextForFields } from '../lib/textFlow'
import type { FieldLayout, PdfTextWidgetAnnotation } from '../types/annotations'
import './PdfFormViewer.css'

const INPUT_FONT =
  '400 14px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

/** Ordered AcroForm field names that behave as one linked text flow. */
const LINKED_FIELD_ORDER = ['addr_line1', 'addr_line2', 'addr_line3'] as const

function extractTextWidgets(
  annotations: unknown[],
): Map<string, { rect: number[] }> {
  const map = new Map<string, { rect: number[] }>()
  for (const raw of annotations) {
    const a = raw as PdfTextWidgetAnnotation
    if (a.subtype !== 'Widget' || a.fieldType !== 'Tx') continue
    const name = a.fieldName
    if (!name || !Array.isArray(a.rect) || a.rect.length < 4) continue
    map.set(name, { rect: a.rect })
  }
  return map
}

function buildLayouts(
  fieldOrder: readonly string[],
  widgets: Map<string, { rect: number[] }>,
  viewport: PageViewport,
): FieldLayout[] {
  return fieldOrder.map((fieldName) => {
    const w = widgets.get(fieldName)
    if (!w) {
      throw new Error(`PDF is missing AcroForm text field "${fieldName}"`)
    }
    const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(w.rect)
    const left = Math.min(x1, x2)
    const top = Math.min(y1, y2)
    const width = Math.abs(x2 - x1)
    const height = Math.abs(y2 - y1)
    return { fieldName, left, top, width, height }
  })
}

type Props = {
  pdfUrl?: string
}

export function PdfFormViewer({ pdfUrl = '/sample.pdf' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [page, setPage] = useState<PDFPageProxy | null>(null)
  const [viewport, setViewport] = useState<PageViewport | null>(null)
  const [layouts, setLayouts] = useState<FieldLayout[] | null>(null)
  const [scale, setScale] = useState(1.35)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [combinedText, setCombinedText] = useState('')
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null)
  const formGroupId = useId()

  useEffect(() => {
    let cancelled = false
    setLoadError(null)
    ;(async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({ url: pdfUrl })
        const doc = await loadingTask.promise
        if (cancelled) {
          await doc.destroy().catch(() => {})
          return
        }
        setPdfDoc(doc)
        const p = await doc.getPage(1)
        if (cancelled) return
        setPage(p)
      } catch (e) {
        if (!cancelled) {
          setLoadError(
            e instanceof Error ? e.message : 'Failed to load PDF document',
          )
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pdfUrl])

  useEffect(() => {
    if (!page) return
    let cancelled = false
    const vp = page.getViewport({ scale })
    setViewport(vp)

    const annotations = page.getAnnotations({ intent: 'display' })
    annotations.then((ann) => {
      if (cancelled) return
      try {
        const widgets = extractTextWidgets(ann)
        const next = buildLayouts(LINKED_FIELD_ORDER, widgets, vp)
        setLayouts(next)
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : String(e))
      }
    })

    return () => {
      cancelled = true
    }
  }, [page, scale])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!page || !viewport || !canvas) return

    renderTaskRef.current?.cancel()
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = viewport.width
    canvas.height = viewport.height

    const task = page.render({
      canvas,
      canvasContext: ctx,
      viewport,
      annotationMode: pdfjsLib.AnnotationMode.ENABLE_FORMS,
    })
    renderTaskRef.current = task

    task.promise.catch(() => {})

    return () => {
      task.cancel()
    }
  }, [page, viewport])

  useEffect(() => {
    return () => {
      pdfDoc?.destroy().catch(() => {})
    }
  }, [pdfDoc])

  const fieldWidths = useMemo(
    () => (layouts ?? []).map((l) => l.width),
    [layouts],
  )

  const segments = useMemo(
    () => splitTextForFields(combinedText, fieldWidths, INPUT_FONT),
    [combinedText, fieldWidths],
  )

  const onFieldChange = useCallback(
    (index: number, newLocal: string) => {
      setCombinedText((prev) =>
        mergeFieldEdit(prev, splitTextForFields(prev, fieldWidths, INPUT_FONT), index, newLocal),
      )
    },
    [fieldWidths],
  )

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'ArrowDown' && e.key !== 'Enter') return
      const el = e.currentTarget
      const atEnd = el.selectionStart === el.value.length
      if (!atEnd) return
      if (index < LINKED_FIELD_ORDER.length - 1) {
        e.preventDefault()
        const next = containerRef.current?.querySelector<HTMLInputElement>(
          `input[data-linked-index="${index + 1}"]`,
        )
        next?.focus()
        requestAnimationFrame(() => {
          next?.setSelectionRange(next.value.length, next.value.length)
        })
      }
    },
    [],
  )

  if (loadError) {
    return (
      <div className="pdf-form-viewer pdf-form-viewer--error" role="alert">
        <p>{loadError}</p>
        <p className="pdf-form-viewer__hint">
          Ensure <code>public/sample.pdf</code> exists. Run{' '}
          <code>npm run generate-sample</code> to create it.
        </p>
      </div>
    )
  }

  return (
    <div className="pdf-form-viewer">
      <div className="pdf-form-viewer__toolbar">
        <label className="pdf-form-viewer__zoom">
          <span>Zoom</span>
          <input
            type="range"
            min={0.75}
            max={2}
            step={0.05}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
          />
          <output>{Math.round(scale * 100)}%</output>
        </label>
        <span className="pdf-form-viewer__badge">Linked fields</span>
      </div>

      <div
        ref={containerRef}
        className="pdf-form-viewer__stage"
        style={{
          width: viewport?.width,
          height: viewport?.height,
          position: 'relative',
        }}
      >
        <canvas ref={canvasRef} className="pdf-form-viewer__canvas" />
        {layouts?.map((layout, index) => (
          <div
            key={layout.fieldName}
            className="pdf-form-viewer__field-wrap"
            style={{
              left: layout.left,
              top: layout.top,
              width: layout.width,
              height: layout.height,
            }}
          >
            <span className="pdf-form-viewer__field-badge" aria-hidden="true">
              Part {index + 1} of {LINKED_FIELD_ORDER.length}
            </span>
            <input
              type="text"
              data-linked-index={index}
              className="pdf-form-viewer__input"
              style={{ font: INPUT_FONT }}
              value={segments[index] ?? ''}
              onChange={(e) => onFieldChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              aria-label={`${layout.fieldName}, part ${index + 1} of ${LINKED_FIELD_ORDER.length} in linked group`}
              aria-describedby={`${formGroupId}-desc`}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        ))}
      </div>
      <p id={`${formGroupId}-desc`} className="visually-hidden">
        These inputs share one continuous value. Text wraps to the next field when
        a line is full.
      </p>
    </div>
  )
}
