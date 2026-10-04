import { check, index, jsonb, pgTable, smallint, text, uniqueIndex } from "drizzle-orm/pg-core";
import { ALL_STATUSES } from "../../../lib/admin/status";
import type { StepKey, StepStatus } from "../../../lib/types";
import { id, oneOf, timestamps, ts } from "./_shared";
import { users } from "./identity";
import { institutions, programs, uploadRequirements } from "./institutions";
import { parameters } from "./reference";
import { files } from "./files";

/**
 * Everything an applicant fills in, and the applications built from it.
 *
 * One `applications` row is the applicant's bundle for an intake: the
 * shared sections (demographic, education, examinations) are sent to every
 * institution in it. Each institution applied to gets an
 * `application_institutions` row with its own status, program choices,
 * documents and fee payment; that row is what institutions and the admin
 * portal call "an application".
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

/** One examination sat, with its results; shape follows src/lib/examination. */
export const examinationRecords = pgTable(
  "examination_records",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Exam type id from the examination configuration (a parameter id). */
    examTypeId: text("exam_type_id").notNull(),
    year: smallint("year").notNull(),
    centreNumber: text("centre_number").notNull().default(""),
    candidateNumber: text("candidate_number").notNull().default(""),
    sittings: smallint("sittings").notNull().default(1),
    /** [{ subject, grade | score, sitting }] — validated against the exam type's subjects and grades. */
    results: jsonb("results").$type<{ subject: string; grade?: string; score?: number; sitting?: number }[]>().notNull().default([]),
    ...timestamps,
  },
  (t) => [index("examination_records_user_idx").on(t.userId)]
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
