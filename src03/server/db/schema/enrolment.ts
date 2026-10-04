import { boolean, index, integer, jsonb, pgTable, smallint, text, uniqueIndex, date } from "drizzle-orm/pg-core";
import type { Condition } from "../../../lib/mockData/admissionRules";
import type { Instalment } from "../../../lib/tuition/data";
import { id, timestamps, ts } from "./_shared";
import { users } from "./identity";
import { institutions, programs, institutionPaymentMethods } from "./institutions";
import { applicationInstitutions } from "./applications";
import { parameters } from "./reference";
import { files } from "./files";

/**
 * After submission: admission rules and deliberations, offers, tuition,
 * medical checks and matriculation. Shapes follow the institution portal
 * (src/lib/mockData/admissionRules.ts, deliberations.ts, admissions.ts)
 * and src/lib/tuition, src/lib/medical, src/lib/matriculation.
 */

// ---------------------------------------------------------------------------
// Admission rules and deliberation
// ---------------------------------------------------------------------------

export const admissionRules = pgTable(
  "admission_rules",
  {
    id: id(),
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    ...timestamps,
  },
  (t) => [index("admission_rules_institution_idx").on(t.institutionId)]
);

/** Rules are versioned; a deliberation records the exact version it ran. */
export const admissionRuleVersions = pgTable(
  "admission_rule_versions",
  {
    id: id(),
    ruleId: text("rule_id")
      .notNull()
      .references(() => admissionRules.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    condition: jsonb("condition").$type<Condition>().notNull(),
    notes: text("notes").notNull().default(""),
    createdBy: text("created_by").references(() => users.id),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("admission_rule_versions_unique").on(t.ruleId, t.version)]
);

export const deliberationRuns = pgTable(
  "deliberation_runs",
  {
    id: id(),
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id),
    ruleVersionId: text("rule_version_id")
      .notNull()
      .references(() => admissionRuleVersions.id),
    status: text("status", { enum: ["PENDING", "RUNNING", "COMPLETED"] }).notNull().default("PENDING"),
    notes: text("notes").notNull().default(""),
    /** Application-institution ids per outcome. */
    results: jsonb("results")
      .$type<{ accepted: string[]; unsuccessful: string[]; firstChoice: string[]; secondChoice: string[]; thirdChoice: string[] }>()
      .notNull()
      .default({ accepted: [], unsuccessful: [], firstChoice: [], secondChoice: [], thirdChoice: [] }),
    runBy: text("run_by").references(() => users.id),
    ...timestamps,
  },
  (t) => [index("deliberation_runs_institution_idx").on(t.institutionId)]
);

/**
 * What a deliberation run decided for one application. The per-application
 * record of deliberation: `deliberation_runs.results` keeps the run's
 * summary lists, this is the row to join and report on.
 */
export const deliberationResults = pgTable(
  "deliberation_results",
  {
    id: id(),
    deliberationRunId: text("deliberation_run_id")
      .notNull()
      .references(() => deliberationRuns.id, { onDelete: "cascade" }),
    applicationInstitutionId: text("application_institution_id")
      .notNull()
      .references(() => applicationInstitutions.id, { onDelete: "cascade" }),
    outcome: text("outcome", { enum: ["ACCEPTED", "UNSUCCESSFUL"] }).notNull(),
    /** Which ranked choice the applicant qualified for (1 to 3), when accepted. */
    choice: smallint("choice"),
    programId: text("program_id").references(() => programs.id),
    note: text("note").notNull().default(""),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("deliberation_results_run_application_unique").on(t.deliberationRunId, t.applicationInstitutionId),
    index("deliberation_results_application_idx").on(t.applicationInstitutionId),
  ]
);

/** An offer of a place on one program. */
export const admissions = pgTable(
  "admissions",
  {
    id: id(),
    applicationInstitutionId: text("application_institution_id")
      .notNull()
      .references(() => applicationInstitutions.id, { onDelete: "cascade" }),
    programId: text("program_id")
      .notNull()
      .references(() => programs.id),
    choice: smallint("choice").notNull(),
    status: text("status", { enum: ["PENDING", "OFFERED", "ACCEPTED", "REJECTED"] }).notNull().default("PENDING"),
    deliberationRunId: text("deliberation_run_id").references(() => deliberationRuns.id),
    offeredAt: ts("offered_at"),
    respondedAt: ts("responded_at"),
    letterFileId: text("letter_file_id").references(() => files.id),
    ...timestamps,
  },
  (t) => [uniqueIndex("admissions_application_unique").on(t.applicationInstitutionId)]
);

// ---------------------------------------------------------------------------
// Tuition
// ---------------------------------------------------------------------------

export const tuitionAccounts = pgTable(
  "tuition_accounts",
  {
    id: id(),
    admissionId: text("admission_id")
      .notNull()
      .references(() => admissions.id, { onDelete: "cascade" }),
    academicYearId: text("academic_year_id").references(() => parameters.id),
    feeCategoryId: text("fee_category_id").references(() => parameters.id),
    /** XAF. */
    tuitionAmount: integer("tuition_amount").notNull(),
    instalments: jsonb("instalments").$type<Instalment[]>().notNull().default([]),
    offerAccepted: boolean("offer_accepted").notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex("tuition_accounts_admission_unique").on(t.admissionId)]
);

export const tuitionPayments = pgTable(
  "tuition_payments",
  {
    id: id(),
    accountId: text("account_id")
      .notNull()
      .references(() => tuitionAccounts.id, { onDelete: "cascade" }),
    paymentMethodId: text("payment_method_id").references(() => institutionPaymentMethods.id),
    reference: text("reference").notNull(),
    amount: integer("amount").notNull(),
    paidOn: date("paid_on").notNull(),
    payerName: text("payer_name").notNull(),
    receiptFileId: text("receipt_file_id").references(() => files.id),
    status: text("status", { enum: ["PENDING", "QUERIED", "VERIFIED", "REJECTED"] }).notNull().default("PENDING"),
    bankCode: text("bank_code"),
    receivedAt: ts("received_at"),
    receivedBy: text("received_by").references(() => users.id),
    ...timestamps,
  },
  (t) => [index("tuition_payments_account_idx").on(t.accountId), uniqueIndex("tuition_payments_bank_code_unique").on(t.bankCode)]
);

/** Review trail on a tuition payment: verified, queried, answered, ... */
export const tuitionPaymentReviews = pgTable(
  "tuition_payment_reviews",
  {
    id: id(),
    paymentId: text("payment_id")
      .notNull()
      .references(() => tuitionPayments.id, { onDelete: "cascade" }),
    action: text("action", { enum: ["RECORDED", "VERIFIED", "QUERIED", "REJECTED", "REOPENED", "ANSWERED"] }).notNull(),
    byUserId: text("by_user_id").references(() => users.id),
    byRole: text("by_role", { enum: ["student", "institution", "admin"] }).notNull(),
    reasonId: text("reason_id").references(() => parameters.id),
    note: text("note").notNull().default(""),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("tuition_payment_reviews_payment_idx").on(t.paymentId)]
);

// ---------------------------------------------------------------------------
// Medical and matriculation
// ---------------------------------------------------------------------------

export const medicalRecords = pgTable(
  "medical_records",
  {
    id: id(),
    tuitionAccountId: text("tuition_account_id")
      .notNull()
      .references(() => tuitionAccounts.id, { onDelete: "cascade" }),
    requirementCode: text("requirement_code").notNull(),
    status: text("status", { enum: ["NOT_STARTED", "SCHEDULED", "AWAITING", "VERIFIED", "RETEST"] }).notNull().default("NOT_STARTED"),
    result: text("result", { enum: ["FIT", "CONDITIONAL", "UNFIT"] }),
    verificationDate: date("verification_date"),
    centre: text("centre"),
    certificateRef: text("certificate_ref"),
    certificateFileId: text("certificate_file_id").references(() => files.id),
    note: text("note").notNull().default(""),
    ...timestamps,
  },
  (t) => [uniqueIndex("medical_records_requirement_unique").on(t.tuitionAccountId, t.requirementCode)]
);

export const medicalEvents = pgTable(
  "medical_events",
  {
    id: id(),
    medicalRecordId: text("medical_record_id")
      .notNull()
      .references(() => medicalRecords.id, { onDelete: "cascade" }),
    byUserId: text("by_user_id").references(() => users.id),
    byRole: text("by_role", { enum: ["student", "institution", "admin"] }).notNull(),
    status: text("status").notNull(),
    result: text("result"),
    note: text("note").notNull().default(""),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("medical_events_record_idx").on(t.medicalRecordId)]
);

export const matriculations = pgTable(
  "matriculations",
  {
    id: id(),
    tuitionAccountId: text("tuition_account_id")
      .notNull()
      .references(() => tuitionAccounts.id, { onDelete: "cascade" }),
    /** The student's matriculation number at the institution. */
    code: text("code").notNull(),
    matriculatedAt: ts("matriculated_at").notNull().defaultNow(),
    confirmedBy: text("confirmed_by").references(() => users.id),
    note: text("note").notNull().default(""),
  },
  (t) => [uniqueIndex("matriculations_account_unique").on(t.tuitionAccountId), uniqueIndex("matriculations_code_unique").on(t.code)]
);
