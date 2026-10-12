import "server-only";
import { z } from "zod";
import { and, asc, eq, ne } from "drizzle-orm";
import { BASE_CURRENCY } from "@/lib/admin/reference";
import { FEE_CATEGORIES, FEE_TYPES } from "@/lib/institution/fees";
import { UPLOAD_FILE_TYPES, documentTypeMaxKb, normaliseFileType, supportedFileTypes, validateRequirementLimits, type DocumentTypeOption } from "@/lib/institution/uploadRequirements";
import { PAYMENT_METHOD_DETAIL_FIELDS, PAYMENT_METHOD_TYPES, unusedDetailFields, validatePaymentMethodDetails, type PaymentMethodType } from "@/lib/institution/paymentMethods";
import type { Executor } from "@/server/db/client";
import { applicationDocuments, currencies, departments, faculties, feeConfigs, feePayments, institutionPaymentMethods, institutions, parameters, programs, tuitionPayments, uploadRequirements } from "@/server/db/schema";
import { env } from "@/server/config/env";
import { ConflictError, ValidationError } from "@/server/http/errors";
import { getRequestContext } from "@/server/logging/context";
import { quoteRate } from "@/server/modules/reference/conversion.service";
import { requiredText, text } from "@/server/http/validate";
import type { ResourceDef } from "@/server/modules/resource";

type Row = Record<string, unknown>;
import { assertBelongs, assertNoActiveChildren, assertParam, assertParamParent } from "@/server/modules/checks";

/**
 * Institutions and their structure, as resources (see ../resource.ts).
 * Admin routes use these platform-wide; institution routes use the same
 * definitions scoped to the caller's institution.
 */

const code = (max = 20) => requiredText(max).transform((v) => v.toUpperCase());
const email = z.union([z.email(), z.literal("")]).default("");

// ---------------------------------------------------------------------------
// Institutions
// ---------------------------------------------------------------------------

export const institutionResource: ResourceDef<z.ZodObject> = {
  name: "institution",
  table: institutions,
  idColumn: institutions.id,
  idPrefix: "inst",
  create: z.object({
    name: requiredText(200),
    typeId: requiredText(100),
    accreditationBodyId: requiredText(100),
    accreditationCode: requiredText(100),
    address: requiredText(300),
    location: text(200).default(""),
    regionId: requiredText(100),
    townId: requiredText(100),
    quarterId: text(100).nullable().optional(),
    contactName: requiredText(200),
    phone: requiredText(40),
    email: z.email(),
    website: text(200).default(""),
    // The institution's own web fee; null (or left out) uses the platform web fee.
    webFee: z.number({ error: "Enter a whole number." }).int().min(0).max(1_000_000).nullable().default(null),
  }),
  searchColumns: [institutions.name, institutions.accreditationCode, institutions.contactName, institutions.email],
  filters: { typeId: institutions.typeId, regionId: institutions.regionId, accreditationBodyId: institutions.accreditationBodyId },
  orderBy: [institutions.name],
  statusColumn: institutions.status,
  institutionColumn: institutions.id,
  unique: { institutions_accreditation_code_unique: "Another institution already uses this accreditation code." },
  async check(db, next) {
    await assertParam(db, "typeId", next.typeId, "institution-types");
    await assertParam(db, "accreditationBodyId", next.accreditationBodyId, "accreditation-bodies");
    await assertParam(db, "regionId", next.regionId, "regions");
    await assertParam(db, "townId", next.townId, "towns");
    await assertParam(db, "quarterId", next.quarterId, "quarters");
    await assertParamParent(db, "townId", next.townId, next.regionId, "This town isn't in the region chosen.");
    await assertParamParent(db, "quarterId", next.quarterId, next.townId, "This quarter isn't in the town chosen.");
  },
};

// ---------------------------------------------------------------------------
// Faculties, departments, programs
// ---------------------------------------------------------------------------

export const facultyResource: ResourceDef<z.ZodObject> = {
  name: "faculty",
  table: faculties,
  idColumn: faculties.id,
  idPrefix: "fac",
  create: z.object({
    institutionId: requiredText(100),
    name: requiredText(200),
    code: code(),
    dean: text(200).default(""),
    email,
    phone: text(40).default(""),
    address: text(300).default(""),
  }),
  searchColumns: [faculties.name, faculties.code, faculties.dean, faculties.email],
  filters: { institutionId: faculties.institutionId },
  orderBy: [faculties.institutionId, faculties.name],
  statusColumn: faculties.status,
  institutionColumn: faculties.institutionId,
  unique: { faculties_institution_code_unique: "Another faculty at this institution already uses this code." },
  async check(db, next, existing) {
    await assertBelongs(db, institutions, "institutionId", next.institutionId, [], "Choose an institution from the list.");
    await assertNoActiveChildren(db, next, existing, departments, departments.facultyId, "Deactivate this faculty's departments first.");
  },
};

export const departmentResource: ResourceDef<z.ZodObject> = {
  name: "department",
  table: departments,
  idColumn: departments.id,
  idPrefix: "dep",
  create: z.object({
    institutionId: requiredText(100),
    facultyId: requiredText(100),
    name: requiredText(200),
    code: code(),
    head: text(200).default(""),
    email,
    phone: text(40).default(""),
  }),
  searchColumns: [departments.name, departments.code, departments.head, departments.email],
  filters: { institutionId: departments.institutionId, facultyId: departments.facultyId },
  orderBy: [departments.institutionId, departments.name],
  statusColumn: departments.status,
  institutionColumn: departments.institutionId,
  unique: { departments_institution_code_unique: "Another department at this institution already uses this code." },
  async check(db, next, existing) {
    await assertBelongs(db, faculties, "facultyId", next.facultyId, [{ column: faculties.institutionId, value: next.institutionId }], "Choose a faculty of this institution.");
    await assertNoActiveChildren(db, next, existing, programs, programs.departmentId, "Deactivate this department's programs first.");
  },
};

export const programResource: ResourceDef<z.ZodObject> = {
  name: "program",
  table: programs,
  idColumn: programs.id,
  idPrefix: "prog",
  create: z.object({
    institutionId: requiredText(100),
    facultyId: requiredText(100),
    departmentId: requiredText(100),
    name: requiredText(200),
    code: code(40),
    qualificationId: requiredText(100),
    durationYears: z.number().min(0.5).max(8),
    studyMode: z.enum(["FULL_TIME", "PART_TIME", "DISTANCE"]),
    language: z.enum(["EN", "FR", "BILINGUAL"]),
    availableSpaces: z.number().int().min(0).max(100_000),
  }),
  searchColumns: [programs.name, programs.code],
  filters: { institutionId: programs.institutionId, facultyId: programs.facultyId, departmentId: programs.departmentId, qualificationId: programs.qualificationId },
  orderBy: [programs.institutionId, programs.name],
  statusColumn: programs.status,
  institutionColumn: programs.institutionId,
  unique: { programs_institution_code_unique: "Another program at this institution already uses this code." },
  async check(db, next) {
    await assertBelongs(db, faculties, "facultyId", next.facultyId, [{ column: faculties.institutionId, value: next.institutionId }], "Choose a faculty of this institution.");
    await assertBelongs(db, departments, "departmentId", next.departmentId, [{ column: departments.facultyId, value: next.facultyId }], "Choose a department of this faculty.");
    await assertParam(db, "qualificationId", next.qualificationId, "qualification-types");
  },
};

// ---------------------------------------------------------------------------
// Payment methods
// ---------------------------------------------------------------------------

/**
 * How an institution takes payment: bank account deposit, money transfer,
 * mobile operator transfer or debit wallet. What each detail field means,
 * and which are required, depends on the kind
 * (src/lib/institution/paymentMethods.ts); the same rules are applied
 * here whoever is saving.
 *
 * Applicants are only ever shown a method that is active AND verified by
 * Cheeta administration, so verification is the control on where
 * applicants' money is sent:
 *
 * - an institution can't verify its own method, and any change it makes
 *   to where the money goes sends the method back to be checked;
 * - the administrator verifies or rejects, with a note the institution
 *   can read, and who decided and when is kept.
 *
 * A method that a payment has been recorded against can't be deleted,
 * only deactivated.
 */
const paymentMethodFields = {
  institutionId: requiredText(100),
  type: z.enum(PAYMENT_METHOD_TYPES, { error: "Choose the kind of payment method." }),
  label: requiredText(120),
  // Which of these must be filled in depends on the kind, so that is checked across the record (below), field by field.
  provider: text(120).default(""),
  branch: text(120).default(""),
  accountName: text(200).default(""),
  accountNumber: text(80).default(""),
  swift: text(20)
    .default("")
    .transform((v) => v.toUpperCase().replace(/\s+/g, "")),
  instructions: text(1000).default(""),
  acceptsTuition: z.boolean().default(false),
};

/** A change to any of these changes where the money goes. */
const ACCOUNT_FIELDS = ["type", ...PAYMENT_METHOD_DETAIL_FIELDS];

/** Empties the fields this kind of method doesn't use, so nothing from a previous kind is left behind. */
function tidyDetails(next: Row): Row {
  const cleared = Object.fromEntries(unusedDetailFields(next.type as PaymentMethodType).map((f) => [f, ""]));
  return { ...next, ...cleared };
}

async function checkPaymentMethod(db: Executor, next: Row, existing: Row | null) {
  await assertBelongs(db, institutions, "institutionId", next.institutionId, [], "Choose an institution from the list.");
  // Details are checked when the method is created or its details change; switching an older record on or off doesn't re-open them.
  if (existing && !ACCOUNT_FIELDS.some((k) => next[k] !== existing[k])) return;
  ValidationError.assert(validatePaymentMethodDetails(next as Parameters<typeof validatePaymentMethodDetails>[0]));
}

async function refuseIfPaidInto(db: Executor, row: Row) {
  const id = String(row.id);
  const [[fee], [tuition]] = await Promise.all([
    db.select({ id: feePayments.id }).from(feePayments).where(eq(feePayments.paymentMethodId, id)).limit(1),
    db.select({ id: tuitionPayments.id }).from(tuitionPayments).where(eq(tuitionPayments.paymentMethodId, id)).limit(1),
  ]);
  if (fee || tuition) throw new ConflictError("Payments have been recorded against this method, so it can't be deleted. Deactivate it instead.");
}

const paymentMethodBase = {
  name: "payment method",
  table: institutionPaymentMethods,
  idColumn: institutionPaymentMethods.id,
  idPrefix: "pm",
  searchColumns: [institutionPaymentMethods.label, institutionPaymentMethods.provider, institutionPaymentMethods.accountName, institutionPaymentMethods.accountNumber],
  filters: { institutionId: institutionPaymentMethods.institutionId, type: institutionPaymentMethods.type, verification: institutionPaymentMethods.verification },
  orderBy: [institutionPaymentMethods.institutionId, institutionPaymentMethods.type, institutionPaymentMethods.label],
  statusColumn: institutionPaymentMethods.status,
  institutionColumn: institutionPaymentMethods.institutionId,
  check: checkPaymentMethod,
  remove: refuseIfPaidInto,
  // Who verified it is kept for the audit trail, not sent to screens.
  present: ({ verifiedBy: _verifiedBy, ...row }: Row) => row,
} satisfies Partial<ResourceDef<z.ZodObject>>;

/** Cheeta administration's view: every institution's methods, and the only place one is verified or rejected. */
export const adminPaymentMethodResource: ResourceDef<z.ZodObject> = {
  ...paymentMethodBase,
  create: z.object({
    ...paymentMethodFields,
    verification: z.enum(["VERIFIED", "PENDING", "REJECTED"]).default("PENDING"),
    verificationNote: text(500).default(""),
  }),
  prepare(next, existing) {
    const record = tidyDetails(next);
    // A decision (or its withdrawal) is stamped with who made it and when.
    if (record.verification === (existing?.verification ?? "PENDING")) return record;
    const decided = record.verification !== "PENDING";
    return {
      ...record,
      verifiedAt: decided ? new Date() : null,
      verifiedBy: decided ? (getRequestContext()?.userId ?? null) : null,
      // The note explains a rejection; it doesn't outlive one.
      verificationNote: record.verification === "REJECTED" ? record.verificationNote : "",
    };
  },
};

/** An institution's view of its own methods: any change to where money goes needs AOSA to check it again. */
export const institutionPaymentMethodResource: ResourceDef<z.ZodObject> = {
  ...paymentMethodBase,
  create: z.object(paymentMethodFields),
  prepare(next, existing) {
    const record = tidyDetails(next);
    const toCheck = { ...record, verification: "PENDING", verificationNote: "", verifiedAt: null, verifiedBy: null };
    if (!existing) return toCheck;
    return ACCOUNT_FIELDS.some((k) => record[k] !== existing[k]) ? toCheck : record;
  },
};

// ---------------------------------------------------------------------------
// Upload requirements
// ---------------------------------------------------------------------------

/** The platform's own upload limit, in KB: no requirement can ask for more than the server will accept. */
export const platformMaxUploadKb = () => Math.floor(env.STORAGE_MAX_UPLOAD_MB * 1024);

/** A document type from the "Upload types" list, with the limits it sets on a requirement. */
async function documentTypeFor(db: Executor, id: unknown) {
  const [row] = typeof id === "string" && id ? await db.select().from(parameters).where(and(eq(parameters.id, id), eq(parameters.category, "upload-types"))).limit(1) : [];
  if (!row) return null;
  return {
    id: row.id,
    label: row.label,
    active: row.status === "ACTIVE",
    fileTypes: supportedFileTypes(row.attrs?.formats),
    maxSizeKb: documentTypeMaxKb(row.attrs?.maxSizeMb, platformMaxUploadKb()),
    certified: row.attrs?.certified === true,
  };
}

/**
 * The document types an institution can ask for: the active "Upload
 * types" that have at least one format uploads can be checked against,
 * each marked if this institution already asks for it.
 */
export async function documentTypeOptions(db: Executor, institutionId: string): Promise<DocumentTypeOption[]> {
  const [types, used] = await Promise.all([
    db
      .select()
      .from(parameters)
      .where(and(eq(parameters.category, "upload-types"), eq(parameters.status, "ACTIVE")))
      .orderBy(asc(parameters.sortOrder), asc(parameters.label)),
    db.select({ documentTypeId: uploadRequirements.documentTypeId }).from(uploadRequirements).where(eq(uploadRequirements.institutionId, institutionId)),
  ]);
  const inUse = new Set(used.map((u) => u.documentTypeId));
  return types
    .map((t) => ({
      id: t.id,
      label: t.label,
      fileTypes: supportedFileTypes(t.attrs?.formats),
      maxSizeKb: documentTypeMaxKb(t.attrs?.maxSizeMb, platformMaxUploadKb()),
      certified: t.attrs?.certified === true,
      inUse: inUse.has(t.id),
    }))
    .filter((t) => t.fileTypes.length > 0);
}

/**
 * Each institution's own list of the documents it asks applicants for.
 * Served to an institution it is confined to that institution's rows
 * (see `scope` in ../resource.ts), so one institution can neither see nor
 * change another's requirements.
 */
export const uploadRequirementResource: ResourceDef<z.ZodObject> = {
  name: "upload requirement",
  table: uploadRequirements,
  idColumn: uploadRequirements.id,
  idPrefix: "req",
  create: z.object({
    institutionId: requiredText(100),
    documentTypeId: z.string({ error: "Choose the document type." }).trim().min(1, "Choose the document type.").max(200),
    description: text(1000).default(""),
    required: z.boolean({ error: "Say whether the document is required or optional." }).default(true),
    fileTypes: z
      .array(z.string().trim().max(10).transform(normaliseFileType), { error: "Choose at least one file type." })
      .min(1, "Choose at least one file type.")
      .max(10)
      .transform((types) => [...new Set(types)]),
    maxSizeKb: z.number({ error: "Enter the maximum size in KB." }).int("Enter a whole number of KB."),
  }),
  searchColumns: [uploadRequirements.name, uploadRequirements.description],
  filters: { institutionId: uploadRequirements.institutionId, documentTypeId: uploadRequirements.documentTypeId },
  orderBy: [uploadRequirements.institutionId, uploadRequirements.name],
  statusColumn: uploadRequirements.status,
  institutionColumn: uploadRequirements.institutionId,
  unique: { upload_requirements_institution_type_unique: "This document is already on the list. Edit that requirement instead." },
  async check(db, next, existing) {
    const changedType = !existing || next.documentTypeId !== existing.documentTypeId;
    // The limits are checked when they are set or changed. Switching a requirement on or off, or rewording it,
    // is never refused because the platform has since tightened the document type's limits.
    const changedLimits = changedType || JSON.stringify(next.fileTypes) !== JSON.stringify(existing?.fileTypes) || next.maxSizeKb !== existing?.maxSizeKb;
    const limits = next as { fileTypes: string[]; maxSizeKb: number };
    const type = await documentTypeFor(db, next.documentTypeId);
    if (!type) {
      // A requirement from before document types were chosen from the list keeps working until
      // someone gives it one; until then it is held to the platform's own limits.
      if (existing && !existing.documentTypeId && !next.documentTypeId) {
        const errors = changedLimits ? validateRequirementLimits(limits, { label: String(next.name), fileTypes: [...UPLOAD_FILE_TYPES], maxSizeKb: platformMaxUploadKb() }) : {};
        if (Object.keys(errors).length) throw new ValidationError(errors);
        return;
      }
      throw new ValidationError({ documentTypeId: "Choose a document type from the list." });
    }
    if (changedType) {
      if (!type.active) throw new ValidationError({ documentTypeId: "This document type is no longer offered. Choose another." });
      if (type.fileTypes.length === 0) throw new ValidationError({ documentTypeId: "This document type has no file format that can be uploaded here." });
      const [other] = await db
        .select({ id: uploadRequirements.id })
        .from(uploadRequirements)
        .where(and(eq(uploadRequirements.institutionId, String(next.institutionId)), eq(uploadRequirements.documentTypeId, type.id), existing ? ne(uploadRequirements.id, String(existing.id)) : undefined))
        .limit(1);
      if (other) throw new ValidationError({ documentTypeId: "This document is already on your list. Edit that requirement instead." });
    }
    const errors = changedLimits ? validateRequirementLimits(limits, type) : {};
    if (Object.keys(errors).length) throw new ValidationError(errors);
  },
  // Applicants see the document called what the platform calls it, the same at every institution.
  async derive(db, next) {
    const type = await documentTypeFor(db, next.documentTypeId);
    return type ? { name: type.label } : {};
  },
  // Deleting is for a requirement added by mistake. Once an applicant has uploaded against it, it is part of their record.
  async remove(db, row) {
    const [used] = await db.select({ id: applicationDocuments.id }).from(applicationDocuments).where(eq(applicationDocuments.requirementId, String(row.id))).limit(1);
    if (used) throw new ConflictError("Applicants have already uploaded this document, so the requirement can't be deleted. Deactivate it instead: applicants will no longer be asked for it.");
  },
};

// ---------------------------------------------------------------------------
// Billing: an institution's fee schedule
// ---------------------------------------------------------------------------

const isoDate = (message: string) => z.iso.date({ error: message });

/**
 * What an institution charges: application fees and its other fees, for
 * national or international applicants, each with its currency, amount
 * and the period it applies to.
 *
 * The web fee is not part of this schedule. It is the platform's own
 * charge, set by the Cheeta administrator under Payment configuration, so
 * an entry of type "web" can't be created here, and any left over from
 * earlier data is not shown.
 *
 * Which entry applies on a given day: the active one of that type and
 * category whose period contains the day; if more than one does, the one
 * that started most recently.
 */
export const feeResource: ResourceDef<z.ZodObject> = {
  name: "fee",
  table: feeConfigs,
  idColumn: feeConfigs.id,
  idPrefix: "fee",
  create: z.object({
    institutionId: requiredText(100),
    name: requiredText(120),
    type: z.enum(FEE_TYPES, { error: "Choose a fee type." }),
    category: z.enum(FEE_CATEGORIES, { error: "Choose national or international." }),
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Choose a currency.").default("XAF"),
    amount: z.number({ error: "Enter the amount as a whole number." }).int("Enter the amount as a whole number.").min(0, "The amount can't be negative.").max(1_000_000_000),
    effectiveDate: isoDate("Enter the date the fee starts to apply."),
    effectiveTo: isoDate("Enter a valid end date, or leave it empty.").nullable().default(null),
    notes: text(500).default(""),
  }),
  searchColumns: [feeConfigs.name, feeConfigs.notes],
  filters: { institutionId: feeConfigs.institutionId, type: feeConfigs.type, category: feeConfigs.category, currency: feeConfigs.currency },
  orderBy: [feeConfigs.institutionId, feeConfigs.type, feeConfigs.category, feeConfigs.effectiveDate],
  statusColumn: feeConfigs.status,
  institutionColumn: feeConfigs.institutionId,
  where: ne(feeConfigs.type, "web"),
  present(row) {
    const today = new Date().toISOString().slice(0, 10);
    const started = String(row.effectiveDate) <= today;
    const ended = row.effectiveTo !== null && String(row.effectiveTo) < today;
    return { ...row, period: !started ? "UPCOMING" : ended ? "ENDED" : "CURRENT" };
  },
  async check(db, next, existing) {
    await assertBelongs(db, institutions, "institutionId", next.institutionId, [], "Choose an institution from the list.");
    const [currency] = await db
      .select({ code: currencies.code })
      .from(currencies)
      .where(and(eq(currencies.code, String(next.currency)), eq(currencies.status, "ACTIVE")))
      .limit(1);
    if (!currency) throw new ValidationError({ currency: "Choose one of the platform's active currencies." });
    // A fee in another currency is converted to the base currency when it is charged, so it needs a rate to convert at.
    if (next.currency !== BASE_CURRENCY && next.currency !== existing?.currency && !(await quoteRate(db, String(next.currency), BASE_CURRENCY))) {
      throw new ValidationError({ currency: `There is no exchange rate for ${next.currency} yet, so a fee in it couldn't be charged. Ask Cheeta administration to add one first.` });
    }
    if (next.effectiveTo && String(next.effectiveTo) < String(next.effectiveDate)) throw new ValidationError({ effectiveTo: "The end date can't be before the start date." });
  },
};
