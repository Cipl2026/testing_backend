import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import PDFDocument from 'pdfkit';
import type { IInvoice } from '@/models/Invoice.js';

export const INVOICE_PDF_TEMPLATE_VERSION = 2;

const COLORS = {
  primary: '#1D4ED8',
  primaryLight: '#E8EEFB',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  border: '#E2E8F0',
  surface: '#FFFFFF',
  surfaceSecondary: '#F8FAFC',
};

const PAGE_MARGIN = 40;
const CONTENT_WIDTH = 515; // A4 width (595) minus margins

function resolveLogoPath(): string | null {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(moduleDir, '../../assets/ghaarfix-logo.png'),
    path.resolve(process.cwd(), 'dist/assets/ghaarfix-logo.png'),
    path.resolve(process.cwd(), 'src/assets/ghaarfix-logo.png'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function formatMoney(amount: number, currency = 'INR'): string {
  if (currency === 'INR') return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${currency} ${amount.toFixed(2)}`;
}

function formatDate(value?: Date | string | null): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function drawRoundedRect(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  fill?: string,
  stroke?: string,
) {
  doc.roundedRect(x, y, w, h, radius);
  if (fill) doc.fill(fill);
  if (stroke) {
    doc.roundedRect(x, y, w, h, radius);
    doc.stroke(stroke);
  }
}

function drawLabelValue(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
) {
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.textTertiary).text(label, x, y, { width });
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.textPrimary).text(value, x, y + 12, { width });
}

export async function generateInvoicePdf(invoice: IInvoice): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: PAGE_MARGIN, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = PAGE_MARGIN;
    let y = PAGE_MARGIN;

    // Outer paper border
    drawRoundedRect(doc, left - 4, y - 4, CONTENT_WIDTH + 8, 720, 12, COLORS.surface, COLORS.border);

    // ── Header ──────────────────────────────────────────────────────────────
    const logoPath = resolveLogoPath();
    if (logoPath) {
      doc.image(logoPath, left, y, { width: 88 });
    } else {
      doc.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.primary).text('Ghaarfix', left, y);
    }

    const headerRightX = left + CONTENT_WIDTH - 160;
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(COLORS.primary)
      .text('TAX INVOICE', headerRightX, y, { width: 160, align: 'right' });
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(COLORS.textPrimary)
      .text(invoice.invoiceNumber, headerRightX, y + 14, { width: 160, align: 'right' });
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.textTertiary)
      .text(`Issued ${formatDate(invoice.issuedAt)}`, headerRightX, y + 30, { width: 160, align: 'right' });

    y += logoPath ? 72 : 48;

    // ── Company block ───────────────────────────────────────────────────────
    const companyH = 52;
    drawRoundedRect(doc, left, y, CONTENT_WIDTH, companyH, 8, COLORS.surfaceSecondary);
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(COLORS.textPrimary)
      .text('Ghaarfix Home Services Pvt. Ltd.', left + 12, y + 10);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.textSecondary)
      .text('support@ghaarfix.com · www.ghaarfix.com', left + 12, y + 24);
    doc.text('GSTIN: 29AABCG1234F1Z5', left + 12, y + 36);

    y += companyH + 14;

    // ── Parties (Billed to / Service by) ────────────────────────────────────
    const partyW = (CONTENT_WIDTH - 12) / 2;
    drawLabelValue(doc, 'Billed to', invoice.snapshot.customerName, left, y, partyW);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.textSecondary)
      .text(invoice.snapshot.customerPhone, left, y + 28, { width: partyW });
    doc.text(invoice.snapshot.addressSummary, left, y + 40, { width: partyW });

    const providerX = left + partyW + 12;
    drawLabelValue(doc, 'Service by', invoice.snapshot.providerName, providerX, y, partyW);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.textSecondary)
      .text(formatDate(invoice.snapshot.serviceDate), providerX, y + 28, { width: partyW });

    y += 72;

    // ── Line items table ────────────────────────────────────────────────────
    const tableX = left;
    const descW = CONTENT_WIDTH - 90;
    const amtW = 80;
    const rowH = 36;
    const headH = 26;

    drawRoundedRect(doc, tableX, y, CONTENT_WIDTH, headH, 6, COLORS.primaryLight);
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(COLORS.textPrimary)
      .text('Description', tableX + 12, y + 8, { width: descW });
    doc.text('Amount', tableX + descW + 8, y + 8, { width: amtW - 8, align: 'right' });

    y += headH;

    for (const item of invoice.lineItems) {
      doc
        .moveTo(tableX, y)
        .lineTo(tableX + CONTENT_WIDTH, y)
        .strokeColor(COLORS.border)
        .lineWidth(0.5)
        .stroke();

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(COLORS.textPrimary)
        .text(item.description, tableX + 12, y + 8, { width: descW });
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(COLORS.textTertiary)
        .text(`Qty ${item.quantity}`, tableX + 12, y + 22, { width: descW });
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(COLORS.textPrimary)
        .text(formatMoney(item.amount, invoice.currency), tableX + descW + 8, y + 12, {
          width: amtW - 8,
          align: 'right',
        });

      y += rowH;
    }

    // Table bottom border
    doc
      .roundedRect(tableX, y - rowH * invoice.lineItems.length - headH, CONTENT_WIDTH, headH + rowH * invoice.lineItems.length, 6)
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .stroke();

    y += 16;

    // ── Totals ──────────────────────────────────────────────────────────────
    const totalsX = left + CONTENT_WIDTH - 220;
    const totalsW = 220;
    const labelW = 120;
    const valueW = 100;

    const drawTotalRow = (label: string, value: string, bold = false) => {
      doc
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(bold ? 11 : 8)
        .fillColor(bold ? COLORS.textPrimary : COLORS.textSecondary)
        .text(label, totalsX, y, { width: labelW });
      doc
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(bold ? 11 : 9)
        .fillColor(COLORS.textPrimary)
        .text(value, totalsX + labelW, y, { width: valueW, align: 'right' });
      y += bold ? 22 : 16;
    };

    drawTotalRow('Subtotal', formatMoney(invoice.subtotal, invoice.currency));
    if (invoice.urgentFee > 0) {
      drawTotalRow('Urgent fee', formatMoney(invoice.urgentFee, invoice.currency));
    }
    const platformItem = invoice.lineItems.find((item) =>
      item.description.toLowerCase().includes('platform'),
    );
    if (platformItem) {
      drawTotalRow('Platform fee', formatMoney(platformItem.amount, invoice.currency));
    }
    if (invoice.discount > 0) {
      drawTotalRow('Discount', `−${formatMoney(invoice.discount, invoice.currency)}`);
    }
    drawTotalRow('Tax (GST)', formatMoney(invoice.tax, invoice.currency));

    doc
      .moveTo(totalsX, y)
      .lineTo(totalsX + totalsW, y)
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .stroke();
    y += 10;

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(COLORS.textPrimary)
      .text('Total paid', totalsX, y, { width: labelW });
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor(COLORS.primary)
      .text(formatMoney(invoice.total, invoice.currency), totalsX + labelW, y - 2, {
        width: valueW,
        align: 'right',
      });
    y += 28;

    // ── Footer ──────────────────────────────────────────────────────────────
    const paymentLabel = invoice.paymentStatus.replace(/_/g, ' ');
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.textTertiary)
      .text(
        `Booking #${invoice.snapshot.bookingNumber} · Payment ${paymentLabel}`,
        left,
        y,
        { width: CONTENT_WIDTH, align: 'center' },
      );
    y += 14;
    doc.text(
      'Thank you for choosing Ghaarfix. We hope your home feels better already.',
      left,
      y,
      { width: CONTENT_WIDTH, align: 'center' },
    );

    doc.end();
  });
}
