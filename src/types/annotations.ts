/** Subset of PDF.js annotation data we use for AcroForm text widgets. */
export type PdfTextWidgetAnnotation = {
  id?: string
  subtype?: string
  fieldType?: string | null
  fieldName?: string
  rect: number[]
}

export type FieldLayout = {
  fieldName: string
  left: number
  top: number
  width: number
  height: number
}
