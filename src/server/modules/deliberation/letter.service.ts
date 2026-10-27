import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq, isNull, or } from "drizzle-orm";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { PublicUser } from "@/lib/auth/users";
import { letterText, type AdmissionLetterContent } from "@/lib/admissions/letter";
import { LANGUAGE_LABELS, STUDY_MODE_LABELS } from "@/lib/institution/types";
import { getDb, type Executor } from "@/server/db/client";
import { admissions, applicationInstitutions, applications, deliberationRuns, departments, faculties, institutions, parameters, programs, users } from "@/server/db/schema";
import { audit } from "@/server/audit/audit";
import { assertPermission } from "@/server/auth/access";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/http/errors";
import { logger } from "@/server/logging/logger";
import { discardBytes, openFileFor, storeGenerated, type StoredFile } from "@/server/storage/files.service";
import { alias } from "drizzle-orm/pg-core";

/**
 * Admission letters.
 *
 * A letter exists only for an admission, and an admission only comes from a
 * published deliberation run, so a letter can't be had any other way.
 *
 * The letter is issued once, as a PDF stored with the other files, the first
 * time anyone asks for it (the applicant or the institution): issuing it at
 * publication would mean making hundreds of PDFs inside that one request.
 * After that it is the same document every time, whatever changes later. The
 * institution can reissue it (if the applicant's name was corrected, say);
 * the earlier one is kept, attached to nothing.
 */

const town = alias(parameters, "town");
const qualification = alias(parameters, "qualification");

export async function letterContent(db: Executor, admissionId: string): Promise<AdmissionLetterContent & { letterFileId: string | null; applicantId: string; institutionId: string }> {
  const [r] = await db
    .select({
      a: admissions,
      applicantId: applications.applicantId,
      applicant: users.fullName,
      email: users.email,
      language: users.language,
      applicationNumber: applicationInstitutions.applicationNumber,
      reference: applicationInstitutions.reference,
      institutionId: applicationInstitutions.institutionId,
      inst: { name: institutions.name, address: institutions.address, phone: institutions.phone, email: institutions.email, website: institutions.website },
      town: town.label,
      program: { name: programs.name, code: programs.code, durationYears: programs.durationYears, studyMode: programs.studyMode, language: programs.language },
      qualification: qualification.label,
      faculty: faculties.name,
      department: departments.name,
      runNumber: deliberationRuns.runNumber,
    })
    .from(admissions)
    .innerJoin(applicationInstitutions, eq(applicationInstitutions.id, admissions.applicationInstitutionId))
    .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
    .innerJoin(users, eq(users.id, applications.applicantId))
    .innerJoin(institutions, eq(institutions.id, applicationInstitutions.institutionId))
    .leftJoin(town, eq(town.id, institutions.townId))
    .innerJoin(programs, eq(programs.id, admissions.programId))
    .leftJoin(qualification, eq(qualification.id, programs.qualificationId))
    .innerJoin(faculties, eq(faculties.id, programs.facultyId))
    .innerJoin(departments, eq(departments.id, programs.departmentId))
    .leftJoin(deliberationRuns, eq(deliberationRuns.id, admissions.deliberationRunId))
    .where(eq(admissions.id, admissionId))
    .limit(1);
  if (!r) throw new NotFoundError("Admission");
  return {
    admissionId: r.a.id,
    admissionNumber: r.a.admissionNumber ?? r.a.id,
    status: r.a.status,
    admissionDate: (r.a.offeredAt ?? r.a.createdAt).toISOString(),
    issuedAt: r.a.letterIssuedAt?.toISOString() ?? null,
    institution: { ...r.inst, town: r.town ?? "" },
    applicant: { name: r.applicant, email: r.email },
    applicationNumber: r.applicationNumber ?? r.reference,
    program: {
      name: r.program.name,
      code: r.program.code,
      faculty: r.faculty,
      department: r.department,
      qualification: r.qualification ?? "",
      durationYears: r.program.durationYears,
      studyMode: STUDY_MODE_LABELS[r.program.studyMode],
      language: LANGUAGE_LABELS[r.program.language],
    },
    choice: r.a.choice,
    runNumber: r.runNumber ?? null,
    language: r.language === "fr" ? "fr" : "en",
    provisional: r.a.type === "PROVISIONAL" ? { conditions: r.a.conditions ?? "", deadline: r.a.conditionsDeadline?.toISOString() ?? null } : null,
    letterFileId: r.a.letterFileId,
    applicantId: r.applicantId,
    institutionId: r.institutionId,
  };
}

// ---------------------------------------------------------------------------
// The PDF
// ---------------------------------------------------------------------------

const ORANGE = rgb(0xf7 / 255, 0x94 / 255, 0x1d / 255);
const INK = rgb(0x05 / 255, 0x05 / 255, 0x05 / 255);
const SOFT = rgb(0x4b / 255, 0x55 / 255, 0x63 / 255);
const LINE = rgb(0xe5 / 255, 0xe7 / 255, 0xeb / 255);

let logoBytes: Promise<Uint8Array | null> | null = null;
function logo() {
  // The brand mark, if the deployment has it on disk; the letter is complete without it.
  logoBytes ??= readFile(path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "logo.png")).then(
    (b) => new Uint8Array(b),
    () => null
  );
  return logoBytes;
}

/** The standard PDF fonts cover Western European text (é, ç, ô...). Anything else is reduced to its plain letters, or "?". */
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
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderLetterPdf(c: AdmissionLetterContent): Promise<Uint8Array> {
  const t = letterText(c);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${t.title} ${c.admissionNumber}`);
  pdf.setAuthor(c.institution.name);
  pdf.setSubject(t.subject);
  pdf.setCreator("Cheeta Academia Online");
  pdf.setProducer("Cheeta AOSA Platform");
  pdf.setCreationDate(new Date());
  const page: PDFPage = pdf.addPage([595.28, 841.89]); // A4
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const M = 56;
  const W = page.getWidth() - 2 * M;
  let y = page.getHeight() - 56;

  const text = (s: string, x: number, at: number, o: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> } = {}) => {
    const font = o.font ?? regular;
    page.drawText(encodable(font, s), { x, y: at, font, size: o.size ?? 10.5, color: o.color ?? INK });
  };
  const para = (s: string, o: { font?: PDFFont; size?: number; indent?: number; gap?: number; color?: ReturnType<typeof rgb> } = {}) => {
    const font = o.font ?? regular;
    const size = o.size ?? 10.5;
    for (const l of wrap(font, size, encodable(font, s), W - (o.indent ?? 0))) {
      text(l, M + (o.indent ?? 0), y, { font, size, color: o.color });
      y -= size * 1.45;
    }
    y -= o.gap ?? 6;
  };

  // Brand bar and letterhead.
  page.drawRectangle({ x: 0, y: page.getHeight() - 8, width: page.getWidth(), height: 8, color: ORANGE });
  let x = M;
  const mark = await logo();
  if (mark) {
    try {
      const img = await pdf.embedPng(mark);
      page.drawImage(img, { x: M, y: y - 26, width: 40, height: (40 * img.height) / img.width });
      x = M + 52;
    } catch (err) {
      logger.warn("Could not place the logo on an admission letter", { err });
    }
  }
  text(c.institution.name, x, y - 2, { font: bold, size: 16 });
  const contact = [c.institution.address, c.institution.town].filter(Boolean).join(", ");
  const reach = [c.institution.phone, c.institution.email, c.institution.website].filter(Boolean).join("  ·  ");
  text(contact, x, y - 18, { size: 9, color: SOFT });
  text(reach, x, y - 30, { size: 9, color: SOFT });
  y -= 52;
  page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.75, color: LINE });
  y -= 26;

  // Title and references.
  text(t.title.toUpperCase(), M, y, { font: bold, size: 13, color: ORANGE });
  let ry = y;
  for (const [label, value] of t.reference) {
    const lw = regular.widthOfTextAtSize(`${label}: `, 9);
    const vw = bold.widthOfTextAtSize(encodable(bold, value), 9);
    text(`${label}: `, M + W - lw - vw, ry, { size: 9, color: SOFT });
    text(value, M + W - vw, ry, { font: bold, size: 9 });
    ry -= 13;
  }
  y = Math.min(y - 22, ry - 10);

  text(c.language === "fr" ? "À" : "To", M, y, { size: 9, color: SOFT });
  y -= 14;
  text(c.applicant.name, M, y, { font: bold });
  y -= 14;
  text(c.applicant.email, M, y, { size: 9.5, color: SOFT });
  y -= 28;

  para(t.subject, { font: bold, size: 11.5, gap: 10 });
  para(t.greeting, { gap: 8 });
  for (const p of t.opening) para(p, { gap: 12 });

  // The program, as a two-column table.
  const labelW = 150;
  page.drawLine({ start: { x: M, y: y + 8 }, end: { x: M + W, y: y + 8 }, thickness: 0.75, color: LINE });
  for (const [label, value] of t.details) {
    if (!value) continue;
    const lines = wrap(bold, 10, encodable(bold, value), W - labelW - 12);
    y -= 8;
    text(label, M + 8, y, { size: 9.5, color: SOFT });
    for (const [i, l] of lines.entries()) text(l, M + labelW, y - i * 14, { font: bold, size: 10 });
    y -= 14 * (lines.length - 1) + 10;
    page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.5, color: LINE });
  }
  y -= 22;

  para(t.stepsTitle, { font: bold, size: 11, gap: 4 });
  t.steps.forEach((s, i) => {
    text(`${i + 1}.`, M + 4, y);
    para(s, { indent: 20, gap: 2 });
  });
  y -= 8;
  para(t.conditions, { size: 9.5, color: SOFT, gap: 18 });

  for (const [i, l] of t.closing.entries()) para(l, { font: i === 1 ? bold : regular, gap: i === 0 ? 26 : 0 });

  // Footer.
  page.drawLine({ start: { x: M, y: 50 }, end: { x: M + W, y: 50 }, thickness: 0.5, color: LINE });
  text(t.footer, M, 36, { size: 8, color: SOFT });
  return pdf.save();
}

// ---------------------------------------------------------------------------
// Issuing
// ---------------------------------------------------------------------------

/**
 * Issues the admission's letter, or with `reissue` a new one in place of the
 * current one. Two requests at once issue one letter: the second finds the
 * admission already pointing at a file and uses it.
 */
async function issue(admissionId: string, actorId: string, opts: { reissue?: boolean } = {}): Promise<string> {
  const db = getDb();
  const content = await letterContent(db, admissionId);
  if (content.letterFileId && !opts.reissue) return content.letterFileId;
  const bytes = await renderLetterPdf({ ...content, issuedAt: new Date().toISOString() });
  let stored: StoredFile | null = null;
  try {
    return await db.transaction(async (tx) => {
      stored = await storeGenerated(tx, { ownerUserId: content.applicantId, institutionId: content.institutionId, purpose: "admission-letter", name: letterText(content).fileName, ext: "pdf", bytes });
      const [won] = await tx
        .update(admissions)
        .set({ letterFileId: stored.id, letterIssuedAt: new Date() })
        .where(and(eq(admissions.id, admissionId), content.letterFileId ? eq(admissions.letterFileId, content.letterFileId) : isNull(admissions.letterFileId)))
        .returning({ id: admissions.id });
      if (!won) throw new LostRace();
      await audit(tx, {
        action: opts.reissue ? "reissue-letter" : "issue-letter",
        entityType: "admission",
        entityId: admissionId,
        institutionId: content.institutionId,
        before: content.letterFileId ? { letterFileId: content.letterFileId } : undefined,
        after: { letterFileId: stored.id, admissionNumber: content.admissionNumber },
      });
      return stored.id;
    });
  } catch (err) {
    if (stored) await discardBytes([stored]);
    if (err instanceof LostRace) {
      if (opts.reissue) throw new ConflictError("The letter was reissued by someone else just now. Reload to see it.");
      const [now] = await db.select({ f: admissions.letterFileId }).from(admissions).where(eq(admissions.id, admissionId)).limit(1);
      if (now?.f) return now.f;
    }
    throw err;
  }
}

class LostRace extends Error {}

async function institutionAdmission(user: PublicUser, id: string) {
  if (!user.institutionId) throw new ForbiddenError("This account isn't linked to an institution.");
  const db = getDb();
  await assertPermission(db, user, "DELIBERATION", "Admission letters need the \"Deliberation List\" permission.");
  const [row] = await db
    .select({ id: admissions.id })
    .from(admissions)
    .innerJoin(applicationInstitutions, eq(applicationInstitutions.id, admissions.applicationInstitutionId))
    .where(and(eq(admissions.id, id), eq(applicationInstitutions.institutionId, user.institutionId)))
    .limit(1);
  if (!row) throw new NotFoundError("Admission");
  return row.id;
}

/** The letter's content and where to open it, for the institution's letter screen. Doesn't issue it. */
export async function letterForInstitution(user: PublicUser, id: string) {
  const admissionId = await institutionAdmission(user, id);
  const { letterFileId, applicantId: _a, institutionId: _i, ...content } = await letterContent(getDb(), admissionId);
  void _a;
  void _i;
  return { ...content, text: letterText(content), issued: !!letterFileId, pdfUrl: `/api/institution/admissions/${encodeURIComponent(admissionId)}/letter/pdf` };
}

/** The letter PDF, issuing it if this is the first time. */
export async function openInstitutionLetter(user: PublicUser, id: string) {
  const admissionId = await institutionAdmission(user, id);
  return openFileFor(user, await issue(admissionId, user.id));
}

/** Issues a new letter in place of the current one. */
export async function reissueLetter(user: PublicUser, id: string) {
  const admissionId = await institutionAdmission(user, id);
  await issue(admissionId, user.id, { reissue: true });
  return letterForInstitution(user, admissionId);
}

/** The applicant's letter for one of their applications, issuing it if this is the first time. */
export async function openStudentLetter(user: PublicUser, applicationInstitutionId: string) {
  const db = getDb();
  const [row] = await db
    .select({ id: admissions.id })
    .from(admissions)
    .innerJoin(applicationInstitutions, eq(applicationInstitutions.id, admissions.applicationInstitutionId))
    .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
    .where(and(eq(admissions.applicationInstitutionId, applicationInstitutionId), eq(applications.applicantId, user.id), or(eq(admissions.status, "OFFERED"), eq(admissions.status, "ACCEPTED"), eq(admissions.status, "REJECTED"))))
    .limit(1);
  if (!row) throw new NotFoundError("Admission letter");
  return openFileFor(user, await issue(row.id, user.id));
}


/** Cheeta administration: the letter PDF for any admission, issuing it if this is the first time. */
export async function openLetterAsAdmin(user: PublicUser, admissionId: string) {
  if (user.role !== "AOSA_ADMIN") throw new ForbiddenError();
  return openFileFor(user, await issue(admissionId, user.id));
}
