import { useEffect, useId, useMemo, useRef, useState } from "react";
import * as Slider from "@radix-ui/react-slider";
import type { PDFDocumentProxy, PDFPageProxy, PageViewport } from "pdfjs-dist";
import { PDFDocument as PDFLibDocument } from "pdf-lib";
import { reflowTextAcrossFields, type LinkedFieldBox } from "../lib/layoutEngine";
import { pdfjsLib } from "../lib/pdf";
import type {
  FieldLayout,
  PdfTextWidgetAnnotation,
} from "../types/annotations";

const FALLBACK_FONT =
  '400 14px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

type AnnotationWithAppearance = PdfTextWidgetAnnotation & {
  defaultAppearanceData?: {
    fontName?: string;
    fontSize?: number;
  };
};

type Props = {
  pdfUrl?: string;
};

function extractTextWidgets(
  annotations: unknown[],
): AnnotationWithAppearance[] {
  return annotations
    .map((raw) => raw as AnnotationWithAppearance)
    .filter(
      (a) =>
        a.subtype === "Widget" &&
        a.fieldType === "Tx" &&
        !!a.fieldName &&
        Array.isArray(a.rect) &&
        a.rect.length >= 4,
    );
}

function sortWidgetsByVisualOrder(
  widgets: AnnotationWithAppearance[],
): AnnotationWithAppearance[] {
  return [...widgets].sort((a, b) => {
    const aTop = Math.max(a.rect[1] ?? 0, a.rect[3] ?? 0);
    const bTop = Math.max(b.rect[1] ?? 0, b.rect[3] ?? 0);
    if (Math.abs(aTop - bTop) > 4) return bTop - aTop;

    const aLeft = Math.min(a.rect[0] ?? 0, a.rect[2] ?? 0);
    const bLeft = Math.min(b.rect[0] ?? 0, b.rect[2] ?? 0);
    return aLeft - bLeft;
  });
}

function fontFromAnnotation(a?: AnnotationWithAppearance): string {
  const size = Math.max(
    10,
    Math.round(a?.defaultAppearanceData?.fontSize ?? 14),
  );
  return `400 ${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
}

function scaleFontSpec(font: string, scale: number): string {
  return font.replace(/(\d+(?:\.\d+)?)px/, (_, px: string) => {
    const next = Math.max(8, Number(px) * scale);
    return `${next}px`;
  });
}

function buildLayouts(
  fieldOrder: string[],
  widgets: Map<string, AnnotationWithAppearance>,
  viewport: PageViewport,
): FieldLayout[] {
  return fieldOrder
    .map((fieldName) => {
      const widget = widgets.get(fieldName);
      if (!widget) return null;
      const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(widget.rect);
      return {
        fieldName,
        left: Math.min(x1, x2),
        top: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
      };
    })
    .filter((v): v is FieldLayout => v !== null);
}

export function PdfFormViewer({ pdfUrl = "/agreement.pdf" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const formGroupId = useId();

  const [sourceUrl, setSourceUrl] = useState(pdfUrl);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.35);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [viewport, setViewport] = useState<PageViewport | null>(null);
  const [allFieldNames, setAllFieldNames] = useState<string[]>([]);
  const [layouts, setLayouts] = useState<FieldLayout[]>([]);
  const [fontSpec, setFontSpec] = useState(FALLBACK_FONT);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const zoomFontSpec = useMemo(
    () => scaleFontSpec(fontSpec, scale),
    [fontSpec, scale],
  );

  useEffect(() => {
    setSourceUrl(pdfUrl);
  }, [pdfUrl]);

  useEffect(() => {
    return () => {
      if (sourceUrl.startsWith("blob:")) URL.revokeObjectURL(sourceUrl);
    };
  }, [sourceUrl]);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    setLayouts([]);
    (async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({ url: sourceUrl });
        const doc = await loadingTask.promise;
        const firstPage = await doc.getPage(1);
        const annotations = await firstPage.getAnnotations({
          intent: "display",
        });
        if (cancelled) {
          await doc.destroy().catch(() => {});
          return;
        }

        const widgets = sortWidgetsByVisualOrder(
          extractTextWidgets(annotations),
        );
        const allNames = widgets.map((w) => w.fieldName ?? "");
        setAllFieldNames(allNames);
        setFontSpec(fontFromAnnotation(widgets[0]));
        setPdfDoc(doc);
        setPage(firstPage);
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Failed to load PDF document.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sourceUrl]);

  useEffect(() => {
    if (!page) return;
    let cancelled = false;
    const nextViewport = page.getViewport({ scale });
    setViewport(nextViewport);
    page.getAnnotations({ intent: "display" }).then((annotations) => {
      if (cancelled) return;
      const widgetsByName = new Map<string, AnnotationWithAppearance>();
      for (const widget of extractTextWidgets(annotations)) {
        if (!widget.fieldName) continue;
        widgetsByName.set(widget.fieldName, widget);
      }
      setLayouts(buildLayouts(allFieldNames, widgetsByName, nextViewport));
    });
    return () => {
      cancelled = true;
    };
  }, [allFieldNames, page, scale]);

  useEffect(() => {
    return () => {
      pdfDoc?.destroy().catch(() => {});
    };
  }, [pdfDoc]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !page || !viewport) return;
    renderTaskRef.current?.cancel();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const task = page.render({
      canvas,
      canvasContext: ctx,
      viewport,
      annotationMode: pdfjsLib.AnnotationMode.ENABLE_FORMS,
    });
    renderTaskRef.current = task;
    task.promise.catch(() => {});
    return () => {
      task.cancel();
    };
  }, [page, viewport]);

  const onFieldInput = (
    index: number,
    value: string,
    el: HTMLTextAreaElement,
  ) => {
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? start;
    const atTail = start === end && end >= value.length;

    setFieldValues((prev) => {
      const next = { ...prev };
      let carry = value;
      let shouldFocusNext = false;

      for (let i = index; i < layouts.length; i += 1) {
        const layout = layouts[i];
        const box: LinkedFieldBox = {
          fieldName: layout.fieldName,
          width: layout.width,
          height: layout.height,
        };
        const existing = i === index ? "" : next[layout.fieldName] ?? "";
        const combined = `${carry}${existing}`;
        const split = reflowTextAcrossFields(
          combined,
          [
            box,
            // Sentinel "tail" box to capture overflow.
            { fieldName: "__overflow__", width: 1200, height: 1200 },
          ],
          zoomFontSpec,
        );
        const fits = split.fields[0]?.text ?? "";
        const overflow = split.fields[1]?.text ?? "";
        next[layout.fieldName] = fits;
        if (i === index && atTail && overflow.length > 0) shouldFocusNext = true;
        carry = overflow;
        if (!carry) break;
      }

      if (shouldFocusNext && index + 1 < layouts.length) {
        const nextIndex = index + 1;
        queueMicrotask(() => {
          const nextField = fieldRefs.current[nextIndex];
          if (!nextField) return;
          nextField.focus();
          const pos = nextField.value.length;
          nextField.setSelectionRange(pos, pos, "forward");
        });
      }

      return next;
    });
  };

  const onDownload = async () => {
    try {
      setIsDownloading(true);
      setDownloadError(null);

      const response = await fetch(sourceUrl);
      if (!response.ok) throw new Error("Could not read source PDF.");
      const bytes = await response.arrayBuffer();
      const doc = await PDFLibDocument.load(bytes);
      const form = doc.getForm();

      Object.entries(fieldValues).forEach(([fieldName, value]) => {
        try {
          form.getTextField(fieldName).setText(value);
        } catch {
          // Ignore non-text/unknown fields safely.
        }
      });

      const outBytes = await doc.save();
      const outputBytes = new Uint8Array(outBytes.byteLength);
      outputBytes.set(outBytes);
      const blob = new Blob([outputBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const baseName = sourceUrl.split("/").pop() || "edited.pdf";
      const downloadName = baseName.endsWith(".pdf")
        ? baseName.replace(/\.pdf$/i, "-edited.pdf")
        : `${baseName}-edited.pdf`;

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = downloadName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error.message : "Failed to download edited PDF.",
      );
    } finally {
      setIsDownloading(false);
    }
  };

  if (loadError) {
    return (
      <div
        className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700"
        role="alert"
      >
        <p className="m-0 text-sm font-medium">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="max-w-56 truncate text-xs text-slate-500">
            {sourceUrl.replace("/", "")}
          </span>

          <div className="flex min-w-64 items-center gap-3 text-xs text-slate-600">
            <button
              type="button"
              onClick={onDownload}
              disabled={isDownloading}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDownloading ? "Preparing..." : "Download PDF"}
            </button>
            <span>Zoom</span>
            <Slider.Root
              className="relative flex h-5 w-44 touch-none select-none items-center"
              min={0.8}
              max={2}
              step={0.05}
              value={[scale]}
              onValueChange={(value) => setScale(value[0] ?? 1.35)}
            >
              <Slider.Track className="relative h-1 grow rounded-full bg-slate-200">
                <Slider.Range className="absolute h-full rounded-full bg-indigo-500" />
              </Slider.Track>
              <Slider.Thumb className="block h-4 w-4 rounded-full border border-indigo-700 bg-white shadow" />
            </Slider.Root>
            <span className="min-w-10 text-right tabular-nums">
              {Math.round(scale * 100)}%
            </span>
          </div>
        </div>
      </div>

      <div
        className="relative mx-auto rounded-lg bg-[#525659] p-2 shadow-2xl"
        style={{ width: viewport?.width ? viewport.width + 16 : undefined }}
      >
        <div
          className="relative overflow-hidden rounded-lg bg-white"
          style={{ width: viewport?.width, height: viewport?.height }}
        >
          <canvas ref={canvasRef} className="block align-top" />
          {layouts.map((layout, index) => {
            return (
              <div
                key={layout.fieldName}
                className="absolute z-20 rounded-md border-2 border-emerald-400/65 bg-white/95 shadow-sm transition-colors focus-within:border-indigo-500"
                style={{
                  left: layout.left,
                  top: layout.top,
                  width: layout.width,
                  height: layout.height,
                  boxSizing: "border-box",
                }}
              >
                <textarea
                  ref={(el) => {
                    fieldRefs.current[index] = el;
                  }}
                  value={fieldValues[layout.fieldName] ?? ""}
                  onChange={(event) =>
                    onFieldInput(
                      index,
                      event.currentTarget.value,
                      event.currentTarget,
                    )
                  }
                  className="h-full w-full resize-none overflow-hidden rounded-md border-none bg-transparent px-2 py-1 text-slate-900 outline-none"
                style={{ font: zoomFontSpec, lineHeight: 1.25 }}
                  rows={1}
                  spellCheck={false}
                  aria-label={`${layout.fieldName}, text field`}
                  aria-describedby={`${formGroupId}-desc`}
                />
              </div>
            );
          })}
        </div>
      </div>

      <p id={`${formGroupId}-desc`} className="sr-only">
        PDF text fields are editable independently.
      </p>
      {downloadError ? (
        <p className="m-0 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {downloadError}
        </p>
      ) : null}
    </div>
  );
}
