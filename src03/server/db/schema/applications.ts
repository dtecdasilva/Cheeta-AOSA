import { check, index, integer, jsonb, pgTable, smallint, text, uniqueIndex } from "drizzle-orm/pg-core";
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
 * Examinations an applicant has sat, as the Examinations Information form
 * records them: one record per qualification, with one or more sittings,
 * each sitting with its own year, numbers and subjects.
 *
 * `exam_type_id` is a qualification id from the examination configuration
 * (src/lib/examination/mockConfig.ts): "GCE_OL", "GCE_AL", or the id of a
 * BAC/BEPC/Probatoire type parameter. Subjects, grades and limits are
 * checked against that configuration when a record is saved; they are
 * stored as text so a record still reads right if the configuration
 * changes later.
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

/** A subject sat in one sitting, with the grade or score obtained. */
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
 * Subject results as the Results Information form records them: one row
 * per qualification and subject, holding either the grade or score, or a
 * result type such as "Absent" when there is no grade.
 */
export const examinationResults = pgTable(
  "examination_results",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    examTypeId: text("exam_type_id").notNull(),
    subject: text("subject").notNull(),
    /** Grade label or score; empty when `result_type_id` is set. */
    value: text("value").notNull().default(""),
    /** Parameter id in "result-types", for a result recorded without a grade. */
    resultTypeId: text("result_type_id").references(() => parameters.id),
    ...timestamps,
  },
  (t) => [index("examination_results_user_idx").on(t.userId), uniqueIndex("examination_results_user_type_subject_unique").on(t.userId, t.examTypeId, t.subject)]
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
    /** What the applicant quotes to the institution, e.g. "APP-2026-00412". */
    reference: text("reference").notNull(),
    status: text("status", { enum: ALL_STATUSES as [string, ...string[]] }).notNull().default("INCOMPLETE"),
    submittedAt: ts("submitted_at"),
    decidedAt: ts("decided_at"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("application_institutions_unique").on(t.applicationId, t.institutionId),
    uniqueIndex("application_institutions_reference_unique").on(t.reference),
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
 * application fee plus the platform's web fee, in XAF. Worked out by the
 * server from the institution's fee schedule (never taken from a request)
 * when the institution is added, and again when a payment is recorded, so
 * it is what the applicant is actually asked to pay.
 */
export const applicationFees = pgTable("application_fees", {
  applicationInstitutionId: text("application_institution_id")
    .primaryKey()
    .references(() => applicationInstitutions.id, { onDelete: "cascade" }),
  /** The fee schedule entry the amount came from; null when it fell back to the default. */
  feeConfigId: text("fee_config_id").references(() => feeConfigs.id, { onDelete: "set null" }),
  applicationFee: integer("application_fee").notNull(),
  webFee: integer("web_fee").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("XAF"),
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

/** A document uploaded against one of an institution's requirements. */
export const applicationDocuments = pgTable(
  "application_documents",
  {
    id: id(),
    applicationInstitutionId: text("application_institution_id")
      .notNull()
      .references(() => applicationInstitutions.id, { onDelete: "cascade" }),
    requirementId: text("requirement_id").references(() => uploadRequirements.id),
    /** Kept as well as the id so the record still reads right if the requirement is renamed. */
    requirementName: text("requirement_name").notNull(),
    fileId: text("file_id")
      .notNull()
      .references(() => files.id),
    reviewStatus: text("review_status", { enum: ["PENDING", "APPROVED", "REJECTED"] }).notNull().default("PENDING"),
    rejectionReason: text("rejection_reason"),
    reviewedBy: text("reviewed_by").references(() => users.id),
    reviewedAt: ts("reviewed_at"),
    ...timestamps,
  },
  (t) => [index("application_documents_app_idx").on(t.applicationInstitutionId)]
);
