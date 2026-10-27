import "server-only";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { DocBlock, DocModel } from "@/lib/documents/data";

/**
 * Draws a document model (src/lib/documents/data.ts: fields, tables, text,
 * a code, signature lines) as an A4 PDF. The same model is what the
 * screens show, so the PDF and the preview always agree.
 */

const ORANGE = rgb(0xf7 / 255, 0x94 / 255, 0x1d / 255);
const INK = rgb(0x05 / 255, 0x05 / 255, 0x05 / 255);
const SOFT = rgb(0x4b / 255, 0x55 / 255, 0x63 / 255);
const LINE = rgb(0xe5 / 255, 0xe7 / 255, 0xeb / 255);
const PAPER = rgb(0xf8 / 255, 0xf9 / 255, 0xfa / 255);

const W = 595.28;
const H = 841.89;
const M = 50;
const CW = W - 2 * M;
const BOTTOM = 70;

/** Standard PDF fonts cover Western European text (é, ç, ô...); anything else is reduced to plain letters, or "?". */
function encodable(font: PDFFont, text: string): string {
  let out = "";
  for (const ch of text) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      const plain = ch.normalize("NFKD").replace(/[̀-ͯ]/g, "");
      try {
        font.encodeText(plain);
        out += plain;
      } catch {
        out += "?";
      }
    }
  }
  return out;
}

function wrap(font: PDFFont, size: number, text: string, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width || !line) line = next;
      else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

export async function renderDocumentPdf(model: DocModel, images: { photo?: { bytes: Uint8Array; mimeType: string } } = {}): Promise<Uint8Array> {
  const fr = model.lang === "fr";
  const pdf = await PDFDocument.create();
  // The applicant's photo, top right of the first page. A file that won't decode is left out rather than failing the document.
  const photo = images.photo ? await (images.photo.mimeType === "image/png" ? pdf.embedPng(images.photo.bytes) : pdf.embedJpg(images.photo.bytes)).catch(() => null) : null;
  pdf.setTitle(`${model.title} ${model.number}`);
  pdf.setAuthor(model.issuer.name);
  pdf.setCreator("Cheeta Academia Online");
  pdf.setProducer("Cheeta AOSA Platform");
  pdf.setCreationDate(new Date(model.issuedAt));
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);

  let page!: PDFPage;
  let y = 0;
  const pages: PDFPage[] = [];

  const text = (s: string, x: number, at: number, o: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> } = {}) => {
    const font = o.font ?? regular;
    page.drawText(encodable(font, s), { x, y: at, font, size: o.size ?? 10, color: o.color ?? INK });
  };

  const newPage = (first = false) => {
    page = pdf.addPage([W, H]);
    pages.push(page);
    page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: ORANGE });
    y = H - 44;
    if (first) {
      text(model.issuer.name, M, y, { font: bold, size: 15 });
      y -= 15;
      for (const l of model.issuer.lines.filter(Boolean)) {
        text(l, M, y, { size: 8.5, color: SOFT });
        y -= 11;
      }
      y -= 8;
      page.drawLine({ start: { x: M, y }, end: { x: M + CW, y }, thickness: 0.75, color: LINE });
      y -= 24;
      text(model.title.toUpperCase(), M, y, { font: bold, size: 13, color: ORANGE });
      const ref = fr ? [`N° ${model.number}`, `Délivré le ${fmt(model.issuedAt, true)}`] : [`No. ${model.number}`, `Issued ${fmt(model.issuedAt)}`];
      ref.forEach((r, i) => {
        const w = regular.widthOfTextAtSize(encodable(regular, r), 8.5);
        text(r, M + CW - w, y + 4 - i * 11, { size: 8.5, color: SOFT });
      });
      y -= 28;
      let photoBottom = Infinity;
      if (photo) {
        const h = 84;
        photoBottom = y - h + 10;
        const w = Math.min(68, (photo.width / photo.height) * h);
        page.drawImage(photo, { x: M + CW - w, y: y - h + 10, width: w, height: h });
        page.drawRectangle({ x: M + CW - w, y: y - h + 10, width: w, height: h, borderColor: LINE, borderWidth: 0.75 });
      }
      if (model.recipient) {
        text(fr ? "À" : "To", M, y, { size: 8.5, color: SOFT });
        y -= 13;
        text(model.recipient.name, M, y, { font: bold, size: 10.5 });
        y -= 12;
        for (const l of model.recipient.lines.filter(Boolean)) {
          text(l, M, y, { size: 9, color: SOFT });
          y -= 11;
        }
        y -= 10;
      }
      // What follows starts below the photo.
      if (photoBottom !== Infinity) y = Math.min(y, photoBottom - 14);
    } else {
      text(`${model.title} · ${model.number}`, M, y, { size: 8.5, color: SOFT });
      y -= 24;
    }
  };

  /** Starts a new page if `need` points won't fit. */
  const room = (need: number) => {
    if (y - need < BOTTOM) newPage();
  };

  const heading = (t?: string) => {
    if (!t) return;
    room(40);
    text(t, M, y, { font: bold, size: 11 });
    y -= 16;
  };

  const block = (b: DocBlock) => {
    switch (b.kind) {
      case "text": {
        heading(b.title);
        for (const p of b.paragraphs) {
          for (const l of wrap(regular, 10, encodable(regular, p), CW)) {
            room(14);
            text(l, M, y);
            y -= 14;
          }
          y -= 6;
        }
        y -= 6;
        return;
      }
      case "fields": {
        heading(b.title);
        const labelW = 150;
        page.drawLine({ start: { x: M, y: y + 9 }, end: { x: M + CW, y: y + 9 }, thickness: 0.5, color: LINE });
        for (const f of b.fields) {
          const lines = wrap(bold, 9.5, encodable(bold, f.value || "—"), CW - labelW - 10);
          room(lines.length * 13 + 8);
          text(f.label, M + 4, y, { size: 9, color: SOFT });
          lines.forEach((l, i) => text(l, M + labelW, y - i * 13, { font: bold, size: 9.5 }));
          y -= lines.length * 13 + 4;
          page.drawLine({ start: { x: M, y: y + 9 }, end: { x: M + CW, y: y + 9 }, thickness: 0.5, color: LINE });
          y -= 4;
        }
        y -= 12;
        return;
      }
      case "table": {
        heading(b.title);
        const n = b.columns.length;
        // Column widths by content, within the page.
        const sample = [b.columns, ...b.rows, ...(b.foot ? [b.foot] : [])];
        const natural = b.columns.map((_, c) => Math.max(40, ...sample.map((r) => regular.widthOfTextAtSize(encodable(regular, r[c] ?? ""), 9) + 12)));
        const total = natural.reduce((s, w) => s + w, 0);
        const widths = natural.map((w) => (w / total) * CW);
        const cell = (row: string[], font: PDFFont, fill?: ReturnType<typeof rgb>) => {
          const wrapped = row.map((v, c) => wrap(font, 9, encodable(font, v ?? ""), widths[c] - 10));
          const h = Math.max(...wrapped.map((w) => w.length)) * 12 + 8;
          room(h + 4);
          if (fill) page.drawRectangle({ x: M, y: y - h + 12, width: CW, height: h, color: fill });
          let x = M;
          wrapped.forEach((lines, c) => {
            const right = b.numeric?.includes(c);
            lines.forEach((l, i) => {
              const w = font.widthOfTextAtSize(l, 9);
              text(l, right ? x + widths[c] - 5 - w : x + 5, y - i * 12, { font, size: 9 });
            });
            x += widths[c];
          });
          y -= h;
          page.drawLine({ start: { x: M, y: y + 12 }, end: { x: M + CW, y: y + 12 }, thickness: 0.5, color: LINE });
        };
        cell(b.columns, bold, PAPER);
        if (!b.rows.length) {
          room(20);
          text(b.empty ?? (fr ? "Aucun." : "None."), M + 5, y, { size: 9, color: SOFT });
          y -= 18;
        }
        for (const r of b.rows) cell(r.slice(0, n), regular);
        if (b.foot) cell(b.foot, bold);
        y -= 14;
        return;
      }
      case "code": {
        room(70);
        page.drawRectangle({ x: M, y: y - 42, width: CW, height: 58, borderColor: ORANGE, borderWidth: 1, color: rgb(1, 0.97, 0.92) });
        text(b.label.toUpperCase(), M + 14, y, { size: 8, color: SOFT });
        text(b.value, M + 14, y - 26, { font: mono, size: 20 });
        y -= 56;
        if (b.caption) {
          for (const l of wrap(regular, 9, encodable(regular, b.caption), CW)) {
            text(l, M, y, { size: 9, color: SOFT });
            y -= 12;
          }
        }
        y -= 14;
        return;
      }
      case "signatures": {
        room(70);
        y -= 30;
        const w = (CW - 30) / Math.max(1, b.lines.length);
        b.lines.forEach((s, i) => {
          const x = M + i * (w + 30);
          page.drawLine({ start: { x, y: y + 12 }, end: { x: x + w, y: y + 12 }, thickness: 0.75, color: INK });
          text(s.name, x, y, { font: bold, size: 9.5 });
          text(s.role, x, y - 12, { size: 8.5, color: SOFT });
        });
        y -= 34;
        return;
      }
    }
  };

  newPage(true);
  for (const b of model.blocks) block(b);

  // Footer on every page: where it came from, and the page number.
  pages.forEach((p, i) => {
    page = p;
    p.drawLine({ start: { x: M, y: 48 }, end: { x: M + CW, y: 48 }, thickness: 0.5, color: LINE });
    for (const [k, l] of wrap(regular, 7.5, encodable(regular, model.footnote), CW - 70).slice(0, 2).entries()) text(l, M, 36 - k * 10, { size: 7.5, color: SOFT });
    const label = fr ? `Page ${i + 1} sur ${pages.length}` : `Page ${i + 1} of ${pages.length}`;
    text(label, M + CW - regular.widthOfTextAtSize(label, 7.5), 36, { size: 7.5, color: SOFT });
  });
  return pdf.save();
}

function fmt(iso: string, fr = false) {
  return new Intl.DateTimeFormat(fr ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Douala" }).format(new Date(iso));
}
