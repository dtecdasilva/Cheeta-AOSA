import "server-only";
import { z } from "zod";
import { departments, faculties, institutionPaymentMethods, institutions, programs, uploadRequirements } from "@/server/db/schema";
import { requiredText, text } from "@/server/http/validate";
import type { ResourceDef } from "@/server/modules/resource";
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
    webFee: z.number().int().min(0).max(1_000_000),
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
    dean: requiredText(200),
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
    head: requiredText(200),
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

const paymentMethodFields = {
  institutionId: requiredText(100),
  type: z.enum(["bank", "money_transfer", "mobile_operator", "debit_wallet"]),
  label: requiredText(120),
  provider: requiredText(120),
  accountName: requiredText(200),
  accountNumber: requiredText(80),
  swift: text(20).default(""),
  instructions: text(1000).default(""),
  acceptsTuition: z.boolean().default(false),
};

const ACCOUNT_FIELDS = ["type", "provider", "accountName", "accountNumber", "swift"];
const paymentMethodBase = {
  name: "payment method",
  table: institutionPaymentMethods,
  idColumn: institutionPaymentMethods.id,
  idPrefix: "pm",
  searchColumns: [institutionPaymentMethods.label, institutionPaymentMethods.provider, institutionPaymentMethods.accountName, institutionPaymentMethods.accountNumber],
  filters: { institutionId: institutionPaymentMethods.institutionId, type: institutionPaymentMethods.type, verification: institutionPaymentMethods.verification },
  orderBy: [institutionPaymentMethods.institutionId, institutionPaymentMethods.label],
  statusColumn: institutionPaymentMethods.status,
  institutionColumn: institutionPaymentMethods.institutionId,
} satisfies Partial<ResourceDef<z.ZodObject>>;

/** AOSA's view: can verify or reject accounts. */
export const adminPaymentMethodResource: ResourceDef<z.ZodObject> = {
  ...paymentMethodBase,
  create: z.object({ ...paymentMethodFields, verification: z.enum(["VERIFIED", "PENDING", "REJECTED"]).default("PENDING") }),
};

/** An institution's view: any change to where money goes needs AOSA to check it again. */
export const institutionPaymentMethodResource: ResourceDef<z.ZodObject> = {
  ...paymentMethodBase,
  create: z.object(paymentMethodFields),
  prepare(next, existing) {
    if (!existing) return { ...next, verification: "PENDING" };
    const changed = ACCOUNT_FIELDS.some((k) => next[k] !== existing[k]);
    return changed ? { ...next, verification: "PENDING" } : next;
  },
};

// ---------------------------------------------------------------------------
// Upload requirements
// ---------------------------------------------------------------------------

export const uploadRequirementResource: ResourceDef<z.ZodObject> = {
  name: "upload requirement",
  table: uploadRequirements,
  idColumn: uploadRequirements.id,
  idPrefix: "req",
  create: z.object({
    institutionId: requiredText(100),
    name: requiredText(200),
    description: text(1000).default(""),
    required: z.boolean().default(true),
    fileTypes: z
      .array(z.enum(["pdf", "jpg", "jpeg", "png"]))
      .min(1, "Choose at least one file type."),
    maxSizeKb: z.number().int().min(50).max(25_600),
  }),
  searchColumns: [uploadRequirements.name, uploadRequirements.description],
  filters: { institutionId: uploadRequirements.institutionId },
  orderBy: [uploadRequirements.institutionId, uploadRequirements.name],
  statusColumn: uploadRequirements.status,
  institutionColumn: uploadRequirements.institutionId,
};
