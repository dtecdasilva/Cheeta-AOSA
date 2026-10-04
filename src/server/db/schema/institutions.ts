import { boolean, index, integer, pgTable, real, text, uniqueIndex, date } from "drizzle-orm/pg-core";
import { id, recordStatus, timestamps } from "./_shared";
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
    webFee: integer("web_fee").notNull().default(0),
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

export const institutionPaymentMethods = pgTable(
  "institution_payment_methods",
  {
    id: id(),
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id),
    type: text("type", { enum: ["bank", "money_transfer", "mobile_operator", "debit_wallet"] }).notNull(),
    label: text("label").notNull(),
    provider: text("provider").notNull(),
    accountName: text("account_name").notNull(),
    accountNumber: text("account_number").notNull(),
    swift: text("swift").notNull().default(""),
    instructions: text("instructions").notNull().default(""),
    acceptsTuition: boolean("accepts_tuition").notNull().default(false),
    /** AOSA checks every account before applicants see it. */
    verification: text("verification", { enum: ["VERIFIED", "PENDING", "REJECTED"] }).notNull().default("PENDING"),
    status: recordStatus(),
    ...timestamps,
  },
  (t) => [index("institution_payment_methods_institution_idx").on(t.institutionId)]
);

/** Documents an institution asks applicants to upload. */
export const uploadRequirements = pgTable(
  "upload_requirements",
  {
    id: id(),
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    required: boolean("required").notNull().default(true),
    /** Lower-case extensions, e.g. ["pdf", "jpg"]. */
    fileTypes: text("file_types").array().notNull(),
    maxSizeKb: integer("max_size_kb").notNull(),
    status: recordStatus(),
    ...timestamps,
  },
  (t) => [index("upload_requirements_institution_idx").on(t.institutionId)]
);

/** An institution's fee schedule (src/lib/mockData/billing.ts). Amounts in XAF. */
export const feeConfigs = pgTable(
  "fee_configs",
  {
    id: id(),
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id),
    name: text("name").notNull(),
    /** "application", "web", "tuition", "other". */
    type: text("type").notNull(),
    category: text("category", { enum: ["national", "international"] }).notNull(),
    currency: text("currency").notNull().default("XAF"),
    amount: integer("amount").notNull(),
    effectiveDate: date("effective_date").notNull(),
    notes: text("notes").notNull().default(""),
    status: recordStatus(),
    ...timestamps,
  },
  (t) => [index("fee_configs_institution_idx").on(t.institutionId)]
);
