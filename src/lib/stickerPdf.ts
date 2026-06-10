/**
 * Sticker pack PDF generator.
 *
 * Produces a print-ready A4 PDF with a grid of BASEUSDP tip stickers
 * (QR code + @handle + branding). Default: 8 stickers per page in a
 * 2-column × 4-row layout, sized for easy cutting (~95×69mm each).
 *
 * Runs entirely in the browser — qrcode generates the QR image data
 * URLs, jsPDF assembles the PDF, the browser triggers the download.
 * Nothing hits the server.
 */

import { jsPDF } from "jspdf";
import QRCode from "qrcode";

interface GenerateOpts {
  handle: string;        // e.g. "GeorgesK"
  tipUrl: string;        // e.g. https://baseusdp.com/tip/@GeorgesK
  pages?: number;        // default 1
  perPage?: number;      // currently only supports 8 (2×4)
  filename?: string;
}

const PAGE_W = 210;      // A4 width mm
const PAGE_H = 297;      // A4 height mm
const MARGIN = 8;        // outer margin mm
const COLS = 2;
const ROWS = 4;
const STICKER_W = (PAGE_W - MARGIN * 2) / COLS; // ~97mm
const STICKER_H = (PAGE_H - MARGIN * 2) / ROWS; // ~70.25mm

function drawCutGuide(
  pdf: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  pdf.setDrawColor(180, 180, 180);
  pdf.setLineDashPattern([1.5, 1.5], 0);
  pdf.setLineWidth(0.2);
  pdf.rect(x, y, w, h);
  pdf.setLineDashPattern([], 0);
}

function drawSticker(
  pdf: jsPDF,
  x: number,
  y: number,
  qrDataUrl: string,
  handle: string,
) {
  // Faint dotted cut-guide rectangle around the whole sticker.
  drawCutGuide(pdf, x, y, STICKER_W, STICKER_H);

  // Header: BASEUSDP wordmark
  pdf.setTextColor(20, 20, 20);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("BASEUSDP", x + STICKER_W / 2, y + 6, { align: "center" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(110, 110, 110);
  pdf.text("Tip me in USDC on Base", x + STICKER_W / 2, y + 10, { align: "center" });

  // QR centered. Leave room for header (12mm) and footer text (~14mm).
  const qrAvail = Math.min(STICKER_W - 16, STICKER_H - 32);
  const qrSize = Math.max(28, qrAvail);
  const qrX = x + (STICKER_W - qrSize) / 2;
  const qrY = y + 13;
  pdf.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

  // Handle below QR
  pdf.setTextColor(20, 20, 20);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text(`@${handle}`, x + STICKER_W / 2, qrY + qrSize + 6, {
    align: "center",
  });

  // Footer URL
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(110, 110, 110);
  pdf.text(`baseusdp.com/tip/@${handle}`, x + STICKER_W / 2, qrY + qrSize + 11, {
    align: "center",
  });
}

export async function generateStickerPdf({
  handle,
  tipUrl,
  pages = 1,
  perPage: _ = 8,
  filename,
}: GenerateOpts): Promise<void> {
  if (!handle) throw new Error("handle is required");
  if (!tipUrl) throw new Error("tipUrl is required");

  // Pre-render the QR once — same image is used for every sticker on
  // every page. Keep it crisp at 600px so it scales cleanly at print DPI.
  const qrDataUrl = await QRCode.toDataURL(tipUrl, {
    width: 600,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#FFFFFF" },
  });

  const pdf = new jsPDF({ unit: "mm", format: "a4" });

  const totalPages = Math.max(1, Math.min(20, Math.floor(pages)));

  for (let p = 0; p < totalPages; p++) {
    if (p > 0) pdf.addPage();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = MARGIN + c * STICKER_W;
        const y = MARGIN + r * STICKER_H;
        drawSticker(pdf, x, y, qrDataUrl, handle);
      }
    }
  }

  pdf.save(filename ?? `baseusdp-stickers-${handle}.pdf`);
}
