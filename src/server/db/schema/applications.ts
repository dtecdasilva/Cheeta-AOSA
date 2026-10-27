import { boolean, check, index, integer, jsonb, numeric, pgTable, smallint, text, uniqueIndex } from "drizzle-orm/pg-core";
import { ALL_STATUSES } from "../../../lib/admin/status";
import type { StepKey, StepStatus } from "../../../lib/types";
import { id, oneOf, timestamps, ts } from "./_shared";
import { users } from "./identity";
import { feeConfigs, institutions, programs, uploadRequirements } from "./institutions";
import { parameters } from "./reference";
import { files } from "./files";

/**
 * Everything an applicant fills in, and the applications built from it.
 *
 * The chain is
 *
 *   applicant (users) -> applications -> application_institutions -> institutions
 *
 * and there is no shorter path: an applicant is never attached to an
 * institution directly (users.institution_id is refused for applicants by
 * a check constraint), only through an application.
 *
 * One `applications` row is the applicant's bundle for an intake: the
 * shared sections (demographic, education, examinations) are sent to every
 * institution in it. Each institution applied to gets an
 * `application_institutions` row; that row is what institutions and the
 * admin portal call "an application", and everything that can differ from
 * one institution to the next hangs off it rather than off the bundle:
 *
 *   Study choices     program_choices
 *   Fees              application_fees
 *   Payments          fee_payments                    (payments.ts)
 *   Uploads           application_documents
 *   Verification      application_documents.review_status, fee_payments.approval
 *   Acknowledgement   status I_ACKNOWLEDGED + application_status_events
 *   Rejection         status I_REJECTED + application_status_events.reason_id
 *   Deliberation      deliberation_results            (enrolment.ts)
 *   Admission         admissions                      (enrolment.ts)
 *
 * So being rejected by one institution, or paying for one, says nothing
 * about the others in the same bundle.
 */

// ---------------------------------------------------------------------------
// Shared applicant sections
// ---------------------------------------------------------------------------

/** Field names and rules: src/lib/demographic/types.ts and validation.ts. */
export const demographicProfiles = pgTable("demographic_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  fullNameOnBirthCertificate: text("full_name_on_birth_certificate").notNull().default(""),
  dateOfBirth: text("date_of_birth").notNull().default(""),
  placeOfBirth: text("place_of_birth").notNull().default(""),
  countryOfBirth: text("country_of_birth").notNull().default(""),
  poBox: text("po_box").notNull().default(""),
  alternativeTelephone: text("alternative_telephone").notNull().default(""),
  disability: text("disability").notNull().default(""),
  disabilityDetails: text("disability_details").notNull().default(""),
  countryOfResidence: text("country_of_residence").notNull().default(""),
  nationality: text("nationality").notNull().default(""),
  regionOfOrigin: text("region_of_origin").notNull().default(""),
  divisionOfOrigin: text("division_of_origin").notNull().default(""),
  townOfResidence: text("town_of_residence").notNull().default(""),
  religion: text("religion").notNull().default(""),
  maritalStatus: text("marital_status").notNull().default(""),
  sex: text("sex").notNull().default(""),
  fathersNames: text("fathers_names").notNull().default(""),
  mothersNames: text("mothers_names").notNull().default(""),
  parentsCountry: text("parents_country").notNull().default(""),
  parentsTownCity: text("parents_town_city").notNull().default(""),
  parentsAddress: text("parents_address").notNull().default(""),
  parentsOccupation: text("parents_occupation").notNull().default(""),
  parentsTelephone: text("parents_telephone").notNull().default(""),
  parentsEmail: text("parents_email").notNull().default(""),
  preferredLanguage: text("preferred_language").notNull().default(""),
  /** Set when the applicant submits the section rather than saving a draft. */
  submittedAt: ts("submitted_at"),
  ...timestamps,
});

/**
 * Photos and a short video an applicant who answers Yes to the disability
 * question can add, so an institution can judge whether it can accommodate
 * them. Seen by the applicant, the institutions they submit to, and Cheeta
 * administration. Removed if the answer changes to No.
 */
export const disabilityMedia = pgTable(
  "disability_media",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fileId: text("file_id")
      .notNull()
      .references(() => files.id),
    kind: text("kind", { enum: ["PHOTO", "VIDEO"] }).notNull(),
    caption: text("caption").notNull().default(""),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("disability_media_user_idx").on(t.userId)]
);

/** Fields and rules: src/lib/education/types.ts and validation.ts. */
export const educationRecords = pgTable(
  "education_records",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startYear: text("start_year").notNull(),
    endYear: text("end_year").notNull(),
    schoolName: text("school_name").notNull(),
    country: text("country").notNull(),
    schoolType: text("school_type").notNull(),
    qualification: text("qualification").notNull(),
    ...timestamps,
  },
  (t) => [index("education_records_user_idx").on(t.userId)]
);

/**
 * Examinations an applicant has sat, and the results obtained in them.
 *
 * The two are recorded in two steps, on two forms:
 *
 * 1. Examinations Information creates the examination: one record per
 *    qualification, with one or more sittings, each with its year,
 *    candidate number and centre number. No subjects are entered here.
 * 2. Results Information picks one of those examinations (a sitting) and
 *    adds the results obtained in it: one row per subject, with the grade
 *    or score, or a result type such as "Absent" when there is no grade.
 *
 * So a result always belongs to a sitting the applicant created first:
 *
 *   examination_records -> examination_sittings -> examination_results
 *
 * `exam_type_id` is a qualification id from the examination configuration
 * (src/lib/examination/config.ts): "GCE_OL", "GCE_AL", or the id of a
 * BAC/BEPC/Probatoire type parameter. Subjects and grades are checked
 * against that configuration when a result is saved; they are stored as
 * text so a record still reads right if the configuration changes later.
 */
export const examinationRecords = pgTable(
  "examination_records",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    examTypeId: text("exam_type_id").notNull(),
    ...timestamps,
  },
  (t) => [index("examination_records_user_idx").on(t.userId), uniqueIndex("examination_records_user_type_unique").on(t.userId, t.examTypeId)]
);

export const examinationSittings = pgTable(
  "examination_sittings",
  {
    id: id(),
    examinationRecordId: text("examination_record_id")
      .notNull()
      .references(() => examinationRecords.id, { onDelete: "cascade" }),
    /** 1 for the first sitting, 2 for the second, ... */
    sittingNo: smallint("sitting_no").notNull(),
    year: smallint("year").notNull(),
    candidateNumber: text("candidate_number").notNull(),
    centreNumber: text("centre_number").notNull(),
  },
  (t) => [uniqueIndex("examination_sittings_record_no_unique").on(t.examinationRecordId, t.sittingNo)]
);

/**
 * No longer written. Subjects used to be entered with the examination
 * itself and were kept here; they are now results, added on the Results
 * Information form and kept in examination_results. Rows found here at
 * start-up are moved there (server/modules/student/legacyResults.ts), so
 * this table stays empty. It is kept so that upgrade has something to
 * read; it can be dropped once every database has been through it.
 */
export const examinationSittingSubjects = pgTable(
  "examination_sitting_subjects",
  {
    id: id(),
    sittingId: text("sitting_id")
      .notNull()
      .references(() => examinationSittings.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    /** A grade label, or a score as text ("14.5"), depending on the qualification. */
    value: text("value").notNull(),
    position: smallint("position").notNull().default(0),
  },
  (t) => [uniqueIndex("examination_sitting_subjects_unique").on(t.sittingId, t.subject)]
);

/**
 * The result obtained in one subject at one sitting: the grade or score,
 * or a result type such as "Absent" when there is no grade. One row per
 * sitting and subject, so the same subject sat again at a second sitting
 * has its own result.
 */
export const examinationResults = pgTable(
  "examination_results",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /**
     * The sitting the result was obtained at. Removing the examination
     * removes its results. Null only on a result recorded before results
     * were tied to an examination and that couldn't be matched to one.
     */
    sittingId: text("sitting_id").references(() => examinationSittings.id, { onDelete: "cascade" }),
    /** The sitting's qualification, kept on the row so results can be listed without joining up to the record. */
    examTypeId: text("exam_type_id").notNull(),
    subject: text("subject").notNull(),
    /** Grade label or score; empty when `result_type_id` is set. */
    value: text("value").notNull().default(""),
    /** Parameter id in "result-types", for a result recorded without a grade. */
    resultTypeId: text("result_type_id").references(() => parameters.id),
    ...timestamps,
  },
  (t) => [index("examination_results_user_idx").on(t.userId), uniqueIndex("examination_results_sitting_subject_unique").on(t.sittingId, t.subject)]
);

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export const applications = pgTable(
  "applications",
  {
    id: id(),
    applicantId: text("applicant_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Parameter id in "academic-years". */
    academicYearId: text("academic_year_id").references(() => parameters.id),
    reference: text("reference").notNull(),
    /** Progress of each step, as the applicant portal tracks it. */
    steps: jsonb("steps").$type<Partial<Record<StepKey, StepStatus>>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [uniqueIndex("applications_reference_unique").on(t.reference), uniqueIndex("applications_applicant_year_unique").on(t.applicantId, t.academicYearId)]
);

export const applicationInstitutions = pgTable(
  "application_institutions",
  {
    id: id(),
    applicationId: text("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id),
    /** The working reference, given when the institution is added to the application, e.g. "APP-26-00412". */
    reference: text("reference").notNull(),
    /**
     * The Application ID, e.g. "AOSA-2026-000123": issued once, when the
     * application is first submitted, and kept through any resubmission.
     * Null until then. Unique across the platform.
     */
    applicationNumber: text("application_number"),
    status: text("status", { enum: ALL_STATUSES as [string, ...string[]] }).notNull().default("INCOMPLETE"),
    submittedAt: ts("submitted_at"),
    decidedAt: ts("decided_at"),
    /** When the applicant confirmed the declaration on their latest submission, and which wording they confirmed. */
    declarationAcceptedAt: ts("declaration_accepted_at"),
    declarationVersion: text("declaration_version"),
    /**
     * The institution's own check that the application fee reached its
     * account. Separate from Cheeta administration's approval of the
     * payment (fee_payments.approval), which comes first: the institution
     * checks a payment that has already been approved, against its own
     * statement. PENDING until a staff member records what they found.
     */
    paymentVerification: text("payment_verification", { enum: ["PENDING", "VERIFIED", "NOT_RECEIVED"] }).notNull().default("PENDING"),
    paymentVerifiedBy: text("payment_verified_by").references(() => users.id),
    paymentVerifiedAt: ts("payment_verified_at"),
    paymentVerificationNote: text("payment_verification_note").notNull().default(""),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("application_institutions_unique").on(t.applicationId, t.institutionId),
    uniqueIndex("application_institutions_reference_unique").on(t.reference),
    uniqueIndex("application_institutions_number_unique").on(t.applicationNumber),
    index("application_institutions_institution_status_idx").on(t.institutionId, t.status),
    check("application_institutions_status_check", oneOf(t.status, ALL_STATUSES)),
  ]
);

/** Every status an application has been through, oldest first. */
export const applicationStatusEvents = pgTable(
  "application_status_events",
  {
    id: id(),
    applicationInstitutionId: text("application_institution_id")
      .notNull()
      .references(() => applicationInstitutions.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    actor: text("actor", { enum: ["applicant", "institution", "system", "admin"] }).notNull(),
    actorUserId: text("actor_user_id").references(() => users.id),
    note: text("note").notNull().default(""),
    /** Parameter id in "rejection-reasons", for rejections. */
    reasonId: text("reason_id").references(() => parameters.id),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("application_status_events_app_idx").on(t.applicationInstitutionId, t.at)]
);

/**
 * What applying to this one institution costs: the institution's
 * application fee plus the platform's web fee, in the base currency.
 * Worked out by the server from the institution's fee schedule (never
 * taken from a request) when the institution is added, and again when a
 * payment is recorded, so it is what the applicant is actually asked to
 * pay.
 *
 * An institution may schedule its fee in another currency. The fee is
 * then converted to the base currency at the exchange rate applying when
 * it is assessed, and the fee as scheduled and that rate are kept beside
 * the result. This row is the current assessment and moves with the rate
 * until a payment is recorded; from then on the payment's own figures are
 * the record (fee_payments and its exchange-rate snapshots).
 */
export const applicationFees = pgTable("application_fees", {
  applicationInstitutionId: text("application_institution_id")
    .primaryKey()
    .references(() => applicationInstitutions.id, { onDelete: "cascade" }),
  /** The fee schedule entry the amount came from; null when it fell back to the default. */
  feeConfigId: text("fee_config_id").references(() => feeConfigs.id, { onDelete: "set null" }),
  /** The institution's fee in the base currency. */
  applicationFee: integer("application_fee").notNull(),
  webFee: integer("web_fee").notNull(),
  amount: integer("amount").notNull(),
  /** The base currency the three amounts above are in. */
  currency: text("currency").notNull().default("XAF"),
  /** The currency the institution scheduled its fee in. */
  feeCurrency: text("fee_currency").notNull().default("XAF"),
  /** The fee as scheduled, in `fee_currency`. Null when that is the base currency (it is then `application_fee`). */
  feeAmount: integer("fee_amount"),
  /** Base currency per one unit of `fee_currency`, as used. Null when nothing was converted. */
  feeRate: numeric("fee_rate", { precision: 24, scale: 12, mode: "number" }),
  assessedAt: ts("assessed_at").notNull().defaultNow(),
  ...timestamps,
});

/** Ranked study-program choices at one institution. */
export const programChoices = pgTable(
  "program_choices",
  {
    id: id(),
    applicationInstitutionId: text("application_institution_id")
      .notNull()
      .references(() => applicationInstitutions.id, { onDelete: "cascade" }),
    programId: text("program_id")
      .notNull()
      .references(() => programs.id),
    rank: smallint("rank").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("program_choices_rank_unique").on(t.applicationInstitutionId, t.rank),
    uniqueIndex("program_choices_program_unique").on(t.applicationInstitutionId, t.programId),
    check("program_choices_rank_check", oneOf(t.rank, ["1", "2", "3"])),
  ]
);

/**
 * A document uploaded against one of an institution's requirements.
 *
 * Each record says outright whose it is and what it is for, so that
 * "may this person open it?" is answered from this one row:
 *
 *   Student                  applicant_id
 *   Application              application_id
 *   ApplicationInstitution   application_institution_id
 *   Institution              institution_id
 *   Document type            document_type_id (with requirement_id and requirement_name)
 *
 * The four owners always agree with the application the document was
 * uploaded to: they are copied from it by the server when the document is
 * stored and are never taken from a request or changed afterwards. They
 * are nullable only because documents stored before these columns existed
 * are filled in at start-up; a document with no owner recorded can be
 * opened by no one but Cheeta administration.
 */
export const applicationDocuments = pgTable(
  "application_documents",
  {
    id: id(),
    applicationInstitutionId: text("application_institution_id")
      .notNull()
      .references(() => applicationInstitutions.id, { onDelete: "cascade" }),
    applicantId: text("applicant_id").references(() => users.id, { onDelete: "cascade" }),
    applicationId: text("application_id").references(() => applications.id, { onDelete: "cascade" }),
    institutionId: text("institution_id").references(() => institutions.id),
    requirementId: text("requirement_id").references(() => uploadRequirements.id),
    /** Kept as well as the id so the record still reads right if the requirement is renamed. */
    requirementName: text("requirement_name").notNull(),
    /** Parameter id in "upload-types": the kind of document this is. */
    documentTypeId: text("document_type_id").references(() => parameters.id),
    fileId: text("file_id")
      .notNull()
      .references(() => files.id),
    reviewStatus: text("review_status", { enum: ["PENDING", "APPROVED", "REJECTED"] }).notNull().default("PENDING"),
    rejectionReason: text("rejection_reason"),
    /** The standard reason chosen when rejecting, where one was (parameter id in "rejection-reasons"). */
    rejectionReasonId: text("rejection_reason_id").references(() => parameters.id),
    reviewedBy: text("reviewed_by").references(() => users.id),
    reviewedAt: ts("reviewed_at"),
    ...timestamps,
  },
  (t) => [
    index("application_documents_app_idx").on(t.applicationInstitutionId),
    index("application_documents_applicant_idx").on(t.applicantId),
    index("application_documents_institution_idx").on(t.institutionId),
    // The file a download asks for is looked up here to decide who may open it.
    index("application_documents_file_idx").on(t.fileId),
  ]
);

/**
 * Comments institution staff add while reviewing an application. Each
 * belongs to one application at one institution and is only ever shown
 * to that institution's staff, to Cheeta administration, and, when the
 * author chose to share it, to the applicant.
 */
export const applicationComments = pgTable(
  "application_comments",
  {
    id: id(),
    applicationInstitutionId: text("application_institution_id")
      .notNull()
      .references(() => applicationInstitutions.id, { onDelete: "cascade" }),
    /** The institution the application is to, kept on the row so every read can be confined to it. */
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id),
    authorUserId: text("author_user_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    /** Shown to the applicant as well as to staff. */
    visibleToApplicant: boolean("visible_to_applicant").notNull().default(false),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("application_comments_app_idx").on(t.applicationInstitutionId, t.createdAt), index("application_comments_institution_idx").on(t.institutionId)]
);
