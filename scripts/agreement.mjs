import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Establish output location
const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "..", "public", "agreement.pdf");

// PDF and font setup
const pdfDoc = await PDFDocument.create();
const page = pdfDoc.addPage([612, 792]);
const form = pdfDoc.getForm();

const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

// --- Precise layout helpers for exact page placement ---
function drawLabel(text, x, y, font = bodyFont, size = 12) {
  page.drawText(text, {
    x,
    y,
    size,
    font,
    color: rgb(0, 0, 0),
    maxWidth: 450,
    lineHeight: 14,
  });
}

function addTextField(name, x, y, width, height, options = {}) {
  const field = form.createTextField(name);
  field.setText(options.defaultText ?? "");
  if (options.multiline) field.enableMultiline();
  field.addToPage(page, {
    x,
    y,
    width,
    height,
    borderWidth: 1,
    borderColor: rgb(0.3, 0.85, 0.79), // Light teal as in UI screenshot
    textColor: rgb(0, 0.2, 0.2),
    backgroundColor: rgb(0.98, 1, 1),
  });
  return field;
}

// --- Actual form layout as matching screenshot for "exact pace" ---
page.drawText("SERVICE AGREEMENT", {
  x: 160,
  y: 740,
  size: 20,
  font: titleFont,
  color: rgb(0, 0, 0),
});

// Line 1: Intro
drawLabel(
  "This Agreement is made on this day between the following parties:",
  80,
  715,
);

// Line 2: Party A
drawLabel("Party A (Company):", 80, 680);
addTextField("party_a_company", 219, 670, 301, 20);

// Line 3: Party B
drawLabel("Party B (Client):", 80, 650);
addTextField("party_b_client", 220, 640, 300, 20);

// Line 4: Date
drawLabel("Agreement Date:", 80, 620);
addTextField("agreement_date", 220, 610, 150, 20);

// Section 1: Scope
drawLabel("1. Scope of Work", 80, 582, titleFont, 14);
drawLabel(
  "The service provider agrees to perform the following services:",
  80,
  565,
);

addTextField("addr_line1", 80, 535, 450, 18);
addTextField("addr_line2", 80, 512, 450, 18);
addTextField("addr_line3", 80, 489, 450, 18);

// Section 2: Payment Terms
drawLabel("2. Payment Terms", 80, 470, titleFont, 14);

drawLabel("Total Amount:", 80, 445);
addTextField("total_amount", 200, 437, 150, 20);

drawLabel("Payment Due Date:", 80, 420);
addTextField("payment_due_date", 200, 412, 150, 20);

// Section 3: Duration
drawLabel("3. Duration", 80, 395, titleFont, 14);

drawLabel("Start Date:", 80, 374);
addTextField("start_date", 170, 365, 140, 20);

drawLabel("End Date:", 80, 350);
addTextField("end_date", 170, 342, 140, 20);

// Section 4: Terms and Conditions
drawLabel("4. Terms and Conditions", 80, 315, titleFont, 14);
drawLabel(
  "Both parties agree to the terms stated in this agreement. Additional conditions may be written below:",
  80,
  300,
  bodyFont,
  12,
);

addTextField("terms_notes", 80, 220, 450, 56, { multiline: true });

// Section: Signatures
drawLabel("Signatures", 80, 202, titleFont, 14);

// Party A Signature
drawLabel("Party A Signature:", 90, 175);
addTextField("party_a_signature", 90, 135, 200, 30);

// Party B Signature
drawLabel("Party B Signature:", 350, 175);
addTextField("party_b_signature", 350, 135, 200, 30);

drawLabel(
  "This Agreement is made with iZONE Technologies as demo",
  90,
  18,
  titleFont,
  14,
);
// Save and output
form.updateFieldAppearances(bodyFont);
const pdfBytes = await pdfDoc.save();
writeFileSync(outPath, pdfBytes);

console.log("Agreement PDF created with exact field placement:", outPath);
