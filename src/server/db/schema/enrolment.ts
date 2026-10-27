import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, numeric, pgTable, primaryKey, smallint, text, uniqueIndex, date } from "drizzle-orm/pg-core";
import type { Condition, RuleScope } from "../../../lib/admission/rules";
import type { Instalment } from "../../../lib/tuition/data";
import { id, recordStatus, timestamps, ts } from "./_shared";
import { users } from "./identity";
import { institutions, programs, institutionPaymentMethods } from "./institutions";
import { applicationInstitutions } from "./applications";
import { parameters } from "./reference";
import { files } from "./files";

/**
 * After submission: admission rules and deliberations, offers, tuition,
 * medical checks and matriculation. Shapes follow the institution portal
 * (src/lib/admission/rules.ts, src/lib/mockData/deliberations.ts, admissions.ts)
 * and src/lib/tuition, src/lib/medical, src/lib/matriculation.
 */

// ---------------------------------------------------------------------------
// Admission rules and deliberation
// ---------------------------------------------------------------------------

/**
 * An institution's admission rules. What a rule requires is never in this
 * row: it is in the rule's versions (below), so a change to a rule never
 * changes what an earlier deliberation was run against.
 */
export const admissionRules = pgTable(
  "admission_rules",
  {
    id: id(),
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    /** Whether deliberations use it. An inactive rule keeps its versions. */
    status: text("status", { enum: ["ACTIVE", "INACTIVE"] }).notNull().default("ACTIVE"),
    createdBy: text("created_by").references(() => users.id),
    ...timestamps,
  },
  (t) => [index("admission_rules_institution_idx").on(t.institutionId)]
);

/**
 * Every version of a rule: its condition tree and the programs it applies
 * to. Versions are only ever added, never changed or removed; the newest
 * is the one in force, and a deliberation records the exact version it ran.
 */
export const admissionRuleVersions = pgTable(
  "admission_rule_versions",
  {
    id: id(),
    ruleId: text("rule_id")
      .notNull()
      .references(() => admissionRules.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    condition: jsonb("condition").$type<Condition>().notNull(),
    /** The faculties, departments and programs it applies to; all empty for every program. */
    scope: jsonb("scope").$type<RuleScope>().notNull().default({ facultyIds: [], departmentIds: [], programIds: [] }),
    notes: text("notes").notNull().default(""),
    createdBy: text("created_by").references(() => users.id),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("admission_rule_versions_unique").on(t.ruleId, t.version)]
);

/**
 * One deliberation of an institution's Deliberation List. Runs are never
 * changed or deleted once completed: a rerun is a new run, so every
 * earlier result, and why it came out as it did, stays on record. A run
 * only proposes; publishing it (once) makes the offers.
 */
export const deliberationRuns = pgTable(
  "deliberation_runs",
  {
    id: id(),
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id),
    /** 1, 2, 3, ... per institution. */
    runNumber: integer("run_number").notNull().default(0),
    /** Kept for runs recorded before a run could use several rules; see deliberation_run_rules. */
    ruleVersionId: text("rule_version_id").references(() => admissionRuleVersions.id),
    status: text("status", { enum: ["PENDING", "RUNNING", "COMPLETED", "PUBLISHED"] }).notNull().default("PENDING"),
    notes: text("notes").notNull().default(""),
    /** The criterion applicants were ranked by when places were short (a criterion key), or null for date of submission. */
    rankBy: text("rank_by"),
    /** Application-institution ids per outcome. */
    results: jsonb("results")
      .$type<{ accepted: string[]; unsuccessful: string[]; firstChoice: string[]; secondChoice: string[]; thirdChoice: string[] }>()
      .notNull()
      .default({ accepted: [], unsuccessful: [], firstChoice: [], secondChoice: [], thirdChoice: [] }),
    /** The report: counts by stage, and each program's places and who filled them. Worked out when the run is made and kept as it was. */
    summary: jsonb("summary").$type<Record<string, unknown>>(),
    runBy: text("run_by").references(() => users.id),
    publishedAt: ts("published_at"),
    publishedBy: text("published_by").references(() => users.id),
    ...timestamps,
  },
  (t) => [index("deliberation_runs_institution_idx").on(t.institutionId), uniqueIndex("deliberation_runs_number_unique").on(t.institutionId, t.runNumber).where(sql`${t.runNumber} > 0`)]
);

/** The exact rule versions a run applied, and how: as general conditions or as program requirements. */
export const deliberationRunRules = pgTable(
  "deliberation_run_rules",
  {
    deliberationRunId: text("deliberation_run_id")
      .notNull()
      .references(() => deliberationRuns.id, { onDelete: "cascade" }),
    ruleVersionId: text("rule_version_id")
      .notNull()
      .references(() => admissionRuleVersions.id),
    kind: text("kind", { enum: ["GENERAL", "PROGRAM"] }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.deliberationRunId, t.ruleVersionId] })]
);

// ---------------------------------------------------------------------------
// Deliberation as a paid service
// ---------------------------------------------------------------------------

/**
 * Deliberation is not automatic and is not included by default. Every
 * institution can see its Deliberation List (the applicants it has
 * acknowledged and not yet decided on) and can always reject an
 * application. Admitting applicants through the platform is the paid part:
 * it needs a subscription, renewed every year, and each applicant name on
 * the list is charged for while the subscription runs.
 *
 * One row per subscription request. The two fees are copied from the
 * platform's settings when the subscription is requested (the
 * administrator sets them under Payment configuration), so a later change
 * of price doesn't alter a year that has already been agreed.
 */
export const deliberationSubscriptions = pgTable(
  "deliberation_subscriptions",
  {
    id: id(),
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id),
    /** PENDING until the administrator confirms payment; ACTIVE runs from starts_at to ends_at. */
    status: text("status", { enum: ["PENDING", "ACTIVE", "REJECTED", "CANCELLED"] }).notNull().default("PENDING"),
    /** Annual fee, in XAF. */
    subscriptionFee: integer("subscription_fee").notNull(),
    /** Fee for each applicant name on the list, in XAF. */
    perNameFee: integer("per_name_fee").notNull(),
    /** How the institution says it paid the annual fee; checked by the administrator. */
    paymentReference: text("payment_reference").notNull().default(""),
    note: text("note").notNull().default(""),
    requestedBy: text("requested_by").references(() => users.id),
    decidedBy: text("decided_by").references(() => users.id),
    decidedAt: ts("decided_at"),
    decisionNote: text("decision_note").notNull().default(""),
    startsAt: ts("starts_at"),
    endsAt: ts("ends_at"),
    ...timestamps,
  },
  (t) => [index("deliberation_subscriptions_institution_idx").on(t.institutionId, t.status)]
);

/**
 * The per-name charge: one row for each applicant whose name is on an
 * institution's Deliberation List while its subscription is active.
 * Charged once per applicant per subscription, at that subscription's
 * per-name fee.
 */
export const deliberationNameCharges = pgTable(
  "deliberation_name_charges",
  {
    id: id(),
    subscriptionId: text("subscription_id")
      .notNull()
      .references(() => deliberationSubscriptions.id, { onDelete: "cascade" }),
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id),
    applicationInstitutionId: text("application_institution_id")
      .notNull()
      .references(() => applicationInstitutions.id, { onDelete: "cascade" }),
    fee: integer("fee").notNull(),
    chargedAt: ts("charged_at").notNull().defaultNow(),
    /** Set when the administrator records that the institution has paid it. */
    paidAt: ts("paid_at"),
  },
  (t) => [
    uniqueIndex("deliberation_name_charges_unique").on(t.subscriptionId, t.applicationInstitutionId),
    index("deliberation_name_charges_institution_idx").on(t.institutionId),
  ]
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
    /** Where an unsuccessful applicant stopped: GENERAL (general conditions), or CHOICES (no choice could take them). */
    failedAt: text("failed_at"),
    /** The applicant's value of the ranking criterion, and their place among those competing. */
    merit: numeric("merit", { mode: "number" }),
    /** Every stage and why: general conditions, then each choice tried (requirements met or not, a place or not), with each condition's outcome. */
    reasons: jsonb("reasons").$type<Record<string, unknown>>(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("deliberation_results_run_application_unique").on(t.deliberationRunId, t.applicationInstitutionId),
    index("deliberation_results_application_idx").on(t.applicationInstitutionId),
  ]
);

/**
 * The Admission List: one record per applicant admitted, made only by
 * publishing a deliberation run (src/server/modules/deliberation/
 * admissions.service.ts), never by hand. It names the program, the
 * institution, the application and the run (and the run's result for the
 * applicant, which holds the reasons), when the admission was made, and
 * where it stands: OFFERED until the applicant answers, then ACCEPTED
 * (taken up) or REJECTED (declined).
 */
export const admissions = pgTable(
  "admissions",
  {
    id: id(),
    applicationInstitutionId: text("application_institution_id")
      .notNull()
      .references(() => applicationInstitutions.id, { onDelete: "cascade" }),
    /** The institution admitting; kept on the row so every read can be confined to it. Null only on rows from before it was recorded, filled in at start-up. */
    institutionId: text("institution_id").references(() => institutions.id),
    programId: text("program_id")
      .notNull()
      .references(() => programs.id),
    /** Which of the applicant's choices the program was (1 to 3). */
    choice: smallint("choice").notNull(),
    status: text("status", { enum: ["PENDING", "OFFERED", "ACCEPTED", "REJECTED", "WITHDRAWN"] }).notNull().default("PENDING"),
    /**
     * FULL, or PROVISIONAL: offered after a published run on conditions not yet
     * met (typically results that aren't out). A provisional admission becomes
     * FULL when the institution confirms the conditions met, or is WITHDRAWN.
     */
    type: text("type", { enum: ["FULL", "PROVISIONAL"] }).notNull().default("FULL"),
    /** The conditions of a provisional admission, as the institution stated them, and the date they must be met by. */
    conditions: text("conditions"),
    conditionsDeadline: ts("conditions_deadline"),
    /** PENDING until the institution decides: MET (the admission became full) or NOT_MET (withdrawn). Null on admissions that were full from the start. */
    conditionStatus: text("condition_status", { enum: ["PENDING", "MET", "NOT_MET"] }),
    conditionsDecidedAt: ts("conditions_decided_at"),
    conditionsDecidedBy: text("conditions_decided_by").references(() => users.id),
    conditionsNote: text("conditions_note"),
    deliberationRunId: text("deliberation_run_id").references(() => deliberationRuns.id),
    /** The applicant's result in that run, with why they were admitted. */
    deliberationResultId: text("deliberation_result_id").references(() => deliberationResults.id),
    /** Admission reference, e.g. "ADM-2026-000045". */
    admissionNumber: text("admission_number"),
    /** The admission date: when the run was published and the place offered. */
    offeredAt: ts("offered_at"),
    admittedBy: text("admitted_by").references(() => users.id),
    respondedAt: ts("responded_at"),
    /** The admission letter as last issued (a PDF in files), and when. Reissuing points it at a new file; the old one is kept, attached to nothing. */
    letterFileId: text("letter_file_id").references(() => files.id),
    letterIssuedAt: ts("letter_issued_at"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("admissions_application_unique").on(t.applicationInstitutionId),
    uniqueIndex("admissions_number_unique").on(t.admissionNumber),
    index("admissions_institution_idx").on(t.institutionId, t.status),
    index("admissions_run_idx").on(t.deliberationRunId),
  ]
);

// ---------------------------------------------------------------------------
// Tuition
// ---------------------------------------------------------------------------

/**
 * What an institution charges admitted students in tuition: the amount for
 * national or international students, for all its programs or one, for an
 * academic year or any, and the instalments it may be paid in. The most
 * specific active requirement applies (a program's over the institution's,
 * a year's over any year's).
 */
export const tuitionRequirements = pgTable(
  "tuition_requirements",
  {
    id: id(),
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id),
    /** Null: every program of the institution. */
    programId: text("program_id").references(() => programs.id),
    /** Null: any academic year. */
    academicYearId: text("academic_year_id").references(() => parameters.id),
    category: text("category", { enum: ["national", "international"] }).notNull(),
    currency: text("currency").notNull().default("XAF"),
    amount: integer("amount").notNull(),
    /** Instalments, in order; their amounts add up to `amount`. A single instalment is payment in full. */
    instalments: jsonb("instalments").$type<Instalment[]>().notNull().default([]),
    notes: text("notes").notNull().default(""),
    status: recordStatus(),
    updatedBy: text("updated_by").references(() => users.id),
    ...timestamps,
  },
  (t) => [index("tuition_requirements_institution_idx").on(t.institutionId, t.status)]
);

/**
 * One admitted student's tuition: opened when they take up the offer, from
 * the requirement in force then. Amount and instalments are copied, so a
 * later change to the requirement never changes what an admitted student
 * owes.
 */
export const tuitionAccounts = pgTable(
  "tuition_accounts",
  {
    id: id(),
    admissionId: text("admission_id")
      .notNull()
      .references(() => admissions.id, { onDelete: "cascade" }),
    institutionId: text("institution_id").references(() => institutions.id),
    requirementId: text("requirement_id").references(() => tuitionRequirements.id),
    category: text("category", { enum: ["national", "international"] }),
    currency: text("currency").notNull().default("XAF"),
    academicYearId: text("academic_year_id").references(() => parameters.id),
    feeCategoryId: text("fee_category_id").references(() => parameters.id),
    tuitionAmount: integer("tuition_amount").notNull(),
    instalments: jsonb("instalments").$type<Instalment[]>().notNull().default([]),
    offerAccepted: boolean("offer_accepted").notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex("tuition_accounts_admission_unique").on(t.admissionId), index("tuition_accounts_institution_idx").on(t.institutionId)]
);

/**
 * A tuition payment the student made outside the platform and recorded
 * here. It counts towards the tuition only once Cheeta administration has
 * VERIFIED it; until then it is PENDING (or QUERIED, waiting for the
 * student's answer). Verifying issues the bank code the institution knows
 * it by; the institution then marks it received on its own statement.
 */
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
    recordedBy: text("recorded_by").references(() => users.id),
    bankCode: text("bank_code"),
    verifiedAt: ts("verified_at"),
    verifiedBy: text("verified_by").references(() => users.id),
    rejectionReason: text("rejection_reason"),
    receivedAt: ts("received_at"),
    receivedBy: text("received_by").references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index("tuition_payments_account_idx").on(t.accountId),
    uniqueIndex("tuition_payments_bank_code_unique").on(t.bankCode),
    // A reference can be on one live payment only; a rejected one frees it.
    uniqueIndex("tuition_payments_live_reference_unique").on(sql`lower(${t.reference})`).where(sql`${t.status} <> 'REJECTED'`),
  ]
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

/**
 * What an institution asks of admitted students medically: a fitness
 * certificate, a vaccination, a screening. For all its programs or one.
 * Required ones must be verified before matriculation; optional ones are
 * recorded but don't hold it up. An institution with none set uses the
 * platform's defaults for its type (src/lib/medical/data.ts).
 */
export const medicalRequirements = pgTable(
  "medical_requirements",
  {
    id: id(),
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id),
    /** Null: every program of the institution. */
    programId: text("program_id").references(() => programs.id),
    code: text("code").notNull(),
    label: text("label").notNull(),
    description: text("description").notNull().default(""),
    required: boolean("required").notNull().default(true),
    /** A certificate older than this many months at verification can't be accepted. Null: no limit. */
    validityMonths: smallint("validity_months"),
    status: recordStatus(),
    updatedBy: text("updated_by").references(() => users.id),
    ...timestamps,
  },
  (t) => [uniqueIndex("medical_requirements_code_unique").on(t.institutionId, t.code), index("medical_requirements_institution_idx").on(t.institutionId, t.status)]
);

/**
 * One medical requirement for one admitted student (keyed by their tuition
 * account). Only the outcome is kept (Fit, Fit with conditions, Unfit),
 * never clinical detail, with who verified it and when.
 */
export const medicalRecords = pgTable(
  "medical_records",
  {
    id: id(),
    tuitionAccountId: text("tuition_account_id")
      .notNull()
      .references(() => tuitionAccounts.id, { onDelete: "cascade" }),
    requirementId: text("requirement_id").references(() => medicalRequirements.id, { onDelete: "set null" }),
    requirementCode: text("requirement_code").notNull(),
    /** The requirement's name and whether it is required, as they were when the record was opened. */
    requirementLabel: text("requirement_label").notNull().default(""),
    required: boolean("required").notNull().default(true),
    status: text("status", { enum: ["NOT_STARTED", "SCHEDULED", "AWAITING", "VERIFIED", "RETEST"] }).notNull().default("NOT_STARTED"),
    result: text("result", { enum: ["FIT", "CONDITIONAL", "UNFIT"] }),
    /** The date the requirement was verified (or found to need a retest). */
    verificationDate: date("verification_date"),
    verifiedBy: text("verified_by").references(() => users.id),
    verifiedAt: ts("verified_at"),
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

/**
 * A student's matriculation at an institution: who, where, on which
 * program, the matriculation code, when, and its status. Confirmed only
 * once admission, tuition and medical verification are complete
 * (server/modules/matriculation). A matriculation confirmed in error is
 * CANCELLED, never deleted; its code is never issued again.
 */
export const matriculations = pgTable(
  "matriculations",
  {
    id: id(),
    tuitionAccountId: text("tuition_account_id")
      .notNull()
      .references(() => tuitionAccounts.id, { onDelete: "cascade" }),
    /** The student, institution, program and admission, stored with the record. Nullable only for rows made before they were. */
    studentId: text("student_id").references(() => users.id),
    institutionId: text("institution_id").references(() => institutions.id),
    programId: text("program_id").references(() => programs.id),
    admissionId: text("admission_id").references(() => admissions.id),
    /** The student's matriculation code at the institution, e.g. MFU/26/CS/0142. */
    code: text("code").notNull(),
    status: text("status", { enum: ["MATRICULATED", "CANCELLED"] }).notNull().default("MATRICULATED"),
    matriculatedAt: ts("matriculated_at").notNull().defaultNow(),
    confirmedBy: text("confirmed_by").references(() => users.id),
    note: text("note").notNull().default(""),
    cancelledAt: ts("cancelled_at"),
    cancelledBy: text("cancelled_by").references(() => users.id),
    cancelReason: text("cancel_reason"),
  },
  (t) => [
    // One live matriculation per admitted student; cancelled ones stay on record.
    uniqueIndex("matriculations_account_unique").on(t.tuitionAccountId).where(sql`${t.status} = 'MATRICULATED'`),
    uniqueIndex("matriculations_code_unique").on(t.code),
    index("matriculations_institution_idx").on(t.institutionId, t.status),
  ]
);
