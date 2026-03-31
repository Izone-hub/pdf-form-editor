import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = join(__dirname, '..', 'public', 'sample.pdf')

const pdfDoc = await PDFDocument.create()
const page = pdfDoc.addPage([612, 792])
const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
const form = pdfDoc.getForm()

page.drawText('Linked address fields (AcroForm)', {
  x: 50,
  y: 740,
  size: 14,
  font,
  color: rgb(0.15, 0.15, 0.2),
})

const fieldNames = ['addr_line1', 'addr_line2', 'addr_line3']
const widths = [480, 480, 480]
let y = 660
const height = 22
const x = 50

fieldNames.forEach((name, i) => {
  const field = form.createTextField(name)
  field.addToPage(page, {
    x,
    y: y - i * 36,
    width: widths[i],
    height,
    borderWidth: 1,
    borderColor: rgb(0.6, 0.6, 0.65),
    backgroundColor: rgb(1, 1, 1),
  })
})

page.drawText('Street / line 1', { x, y: y + 14, size: 9, font, color: rgb(0.4, 0.4, 0.45) })
page.drawText('Continued (linked)', { x, y: y - 36 + 14, size: 9, font, color: rgb(0.4, 0.4, 0.45) })
page.drawText('Continued (linked)', { x, y: y - 72 + 14, size: 9, font, color: rgb(0.4, 0.4, 0.45) })

const pdfBytes = await pdfDoc.save()
writeFileSync(outPath, pdfBytes)
console.log('Wrote', outPath)
