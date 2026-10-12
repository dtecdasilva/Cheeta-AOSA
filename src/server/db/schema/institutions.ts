import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, real, text, uniqueIndex, date, type AnyPgColumn } from "drizzle-orm/pg-core";
import { PAYMENT_METHOD_TYPES } from "../../../lib/institution/paymentMethods";
import { id, recordStatus, timestamps, ts } from "./_shared";
import { users } from "./identity";
import { parameters } from "./reference";

/**
 * Institutions and how each is organised: faculties, departments, study
 * programs, the accounts it collects money into, the documents it asks
 * applicants for, and its fee schedule. Mirrors src/lib/admin/institutions.ts,
 * src/lib/admin/academics.ts, src/lib/admin/paymentMethods.ts and the
 * institution portal's mock data.
 */

export const institutions = pgTable(
  "institutions",
  {
    id: id(),
    name: text("name").notNull(),
    /** Parameter ids ("institution-types:UNI", "regions:CE", ...). */
    typeId: text("type_id")
      .notNull()
      .references(() => parameters.id),
    accreditationBodyId: text("accreditation_body_id")
      .notNull()
      .references(() => parameters.id),
    accreditationCode: text("accreditation_code").notNull(),
    address: text("address").notNull(),
    location: text("location").notNull().default(""),
    regionId: text("region_id")
      .notNull()
      .references(() => parameters.id),
    townId: text("town_id")
      .notNull()
      .references(() => parameters.id),
    quarterId: text("quarter_id").references(() => parameters.id),
    contactName: text("contact_name").notNull(),
    phone: text("phone").notNull(),
    email: text("email").notNull(),
    website: text("website").notNull().default(""),
    /** Platform web fee charged per application, in XAF. */
    /**
     * This institution's own web fee, in XAF. Null means it uses the
     * platform web fee the administrator sets under Payment configuration
     * (settings "payment".defaultWebFee).
     */
    webFee: integer("web_fee"),
    status: recordStatus(),
    ...timestamps,
  },
  (t) => [uniqueIndex("institutions_accreditation_code_unique").on(t.accreditationCode), index("institutions_region_idx").on(t.regionId)]
);

export const faculties = pgTable(
  "faculties",
  {
    id: id(),
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id),
    name: text("name").notNull(),
    code: text("code").notNull(),
    dean: text("dean").notNull(),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    address: text("address").notNull().default(""),
    status: recordStatus(),
    ...timestamps,
  },
  (t) => [uniqueIndex("faculties_institution_code_unique").on(t.institutionId, t.code)]
);

export const departments = pgTable(
  "departments",
  {
    id: id(),
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id),
    facultyId: text("faculty_id")
      .notNull()
      .references(() => faculties.id),
    name: text("name").notNull(),
    code: text("code").notNull(),
    head: text("head").notNull(),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    status: recordStatus(),
    ...timestamps,
  },
  (t) => [uniqueIndex("departments_institution_code_unique").on(t.institutionId, t.code), index("departments_faculty_idx").on(t.facultyId)]
);

export const programs = pgTable(
  "programs",
  {
    id: id(),
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id),
    facultyId: text("faculty_id")
      .notNull()
      .references(() => faculties.id),
    departmentId: text("department_id")
      .notNull()
      .references(() => departments.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    /** Parameter id in "qualification-types". */
    qualificationId: text("qualification_id")
      .notNull()
      .references(() => parameters.id),
    durationYears: real("duration_years").notNull(),
    studyMode: text("study_mode", { enum: ["FULL_TIME", "PART_TIME", "DISTANCE"] }).notNull(),
    language: text("language", { enum: ["EN", "FR", "BILINGUAL"] }).notNull(),
    availableSpaces: integer("available_spaces").notNull().default(0),
    status: recordStatus(),
    ...timestamps,
  },
  (t) => [uniqueIndex("programs_institution_code_unique").on(t.institutionId, t.code), index("programs_department_idx").on(t.departmentId)]
);

/**
 * The ways an institution takes payment, one row per account. There are
 * four kinds, and the same columns mean something slightly different for
 * each (src/lib/institution/paymentMethods.ts has the labels and which
 * are required):
 *
 *   bank             Bank account deposit      bank, branch, account name, account number, SWIFT
 *   money_transfer   Money transfer            agency, pay-out town, recipient name, recipient's phone or ID
 *   mobile_operator  Mobile operator transfer  operator, account name, mobile number
 *   debit_wallet     Debit wallet              wallet provider, wallet name, wallet id
 *
 * AOSA checks every account before applicants are shown it, and again
 * whenever the institution changes where the money goes.
 */
export const institutionPaymentMethods = pgTable(
  "institution_payment_methods",
  {
    id: id(),
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id),
    type: text("type", { enum: PAYMENT_METHOD_TYPES }).notNull(),
    label: text("label").notNull(),
    /** Bank, transfer agency, mobile operator or wallet provider. */
    provider: text("provider").notNull(),
    /** Bank branch, or the town a transfer is collected in. */
    branch: text("branch").notNull().default(""),
    /** Account holder, or the person a transfer is sent to. */
    accountName: text("account_name").notNull(),
    /** Account number or IBAN, mobile number, wallet id, or the recipient's phone or ID number. */
    accountNumber: text("account_number").notNull(),
    swift: text("swift").notNull().default(""),
    instructions: text("instructions").notNull().default(""),
    acceptsTuition: boolean("accepts_tuition").notNull().default(false),
    /** AOSA checks every account before applicants see it. */
    verification: text("verification", { enum: ["VERIFIED", "PENDING", "REJECTED"] }).notNull().default("PENDING"),
    /** Why AOSA rejected it, for the institution to read. */
    verificationNote: text("verification_note").notNull().default(""),
    /** When AOSA last verified or rejected it; cleared when it goes back to be checked. */
    verifiedAt: ts("verified_at"),
    verifiedBy: text("verified_by").references((): AnyPgColumn => users.id),
    status: recordStatus(),
    ...timestamps,
  },
  (t) => [index("institution_payment_methods_institution_idx").on(t.institutionId)]
);

/**
 * Documents an institution asks applicants to upload. Each institution
 * keeps its own list; nothing here is shared between institutions.
 *
 * A requirement is for one document type from the platform's "Upload
 * types" list (Application parameters), which sets the outer limits: the
 * formats that type may be uploaded in and its largest size. The
 * institution chooses within them, and says whether the document is
 * required or optional.
 */
export const uploadRequirements = pgTable(
  "upload_requirements",
  {
    id: id(),
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id),
    /** Parameter id in "upload-types". Null only on requirements entered before document types were chosen from that list. */
    documentTypeId: text("document_type_id").references(() => parameters.id),
    /** What applicants see the document called: the document type's name when it was saved. */
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    required: boolean("required").notNull().default(true),
    /** Lower-case extensions, e.g. ["pdf", "jpg"]. */
    fileTypes: text("file_types").array().notNull(),
    maxSizeKb: integer("max_size_kb").notNull(),
    status: recordStatus(),
    ...timestamps,
  },
  (t) => [
    index("upload_requirements_institution_idx").on(t.institutionId),
    // An institution asks for each document type once.
    uniqueIndex("upload_requirements_institution_type_unique")
      .on(t.institutionId, t.documentTypeId)
      .where(sql`${t.documentTypeId} is not null`),
  ]
);

/**
 * An institution's fee schedule: what it charges, for what, to whom
 * (national or international applicants), in which currency, and for
 * which period. A change of price is a new entry with its own period, so
 * what was charged in the past stays on record.
 */
export const feeConfigs = pgTable(
  "fee_configs",
  {
    id: id(),
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id),
    name: text("name").notNull(),
    /** A fee type code from the "fee-types" parameter list, lower-cased: "application", "web", "tuition", ... */
    type: text("type").notNull(),
    category: text("category", { enum: ["national", "international"] }).notNull(),
    currency: text("currency").notNull().default("XAF"),
    amount: integer("amount").notNull(),
    /** First day the fee applies. */
    effectiveDate: date("effective_date").notNull(),
    /** Last day it applies; null for "until further notice". */
    effectiveTo: date("effective_to"),
    notes: text("notes").notNull().default(""),
    status: recordStatus(),
    ...timestamps,
  },
  (t) => [index("fee_configs_institution_idx").on(t.institutionId)]
);
