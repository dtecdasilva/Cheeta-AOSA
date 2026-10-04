import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { ROLES } from "../../../lib/auth/roles";
import { INSTITUTION_TYPES } from "../../../lib/data";
import { id, oneOf, recordStatus, timestamps, ts } from "./_shared";
import { institutions } from "./institutions";

/**
 * Accounts and the role-specific data hung off them. One `users` row per
 * person who can sign in, whatever their portal.
 */

export const users = pgTable(
  "users",
  {
    id: id(),
    /** Always stored lower-cased; uniqueness is case-insensitive because of that. */
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull(),
    role: text("role", { enum: ROLES as [string, ...string[]] }).notNull(),
    status: recordStatus(),
    phone: text("phone"),
    /** Set for institution staff; the institution they act for. */
    institutionId: text("institution_id").references(() => institutions.id),
    mfaEnabled: boolean("mfa_enabled").notNull().default(false),
    /**
     * Copied into every session token. Bumping it (password reset,
     * deactivation, "sign out everywhere") makes existing sessions invalid
     * without a sessions table.
     */
    sessionVersion: integer("session_version").notNull().default(1),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: ts("locked_until"),
    lastSignInAt: ts("last_sign_in_at"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("users_email_unique").on(t.email),
    index("users_role_idx").on(t.role),
    index("users_institution_idx").on(t.institutionId),
    check("users_role_check", oneOf(t.role, ROLES)),
    // Institution staff must belong to an institution.
    check("users_institution_staff_check", sql`${t.role} in ('STUDENT', 'AOSA_ADMIN') or ${t.institutionId} is not null`),
  ]
);

/** Registration-time data that only applicants have. */
export const applicantProfiles = pgTable(
  "applicant_profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    registrationNo: text("registration_no").notNull(),
    institutionType: text("institution_type").notNull(),
    mobileNumber: text("mobile_number").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    gender: text("gender", { enum: ["Male", "Female"] }),
    dateOfBirth: date("date_of_birth"),
    /** Parameter ids (regions, towns). */
    regionId: text("region_id"),
    townId: text("town_id"),
    address: text("address").notNull().default(""),
    highestQualification: text("highest_qualification").notNull().default(""),
    /** "Self-registered" or "Registered by admin", as the admin screens show it. */
    source: text("source").notNull().default("Self-registered"),
    ...timestamps,
  },
  (t) => [uniqueIndex("applicant_profiles_registration_no_unique").on(t.registrationNo), check("applicant_profiles_institution_type_check", oneOf(t.institutionType, INSTITUTION_TYPES))]
);

/** Staff-side details for institution accounts (src/lib/mockData/staff.ts). */
export const institutionStaff = pgTable(
  "institution_staff",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id),
    staffNo: text("staff_no").notNull(),
    position: text("position").notNull(),
    title: text("title"),
    /** PAYMENTS_UPLOADS, ACKNOWLEDGED_APPS, REJECTED_APPS, DELIBERATION. */
    permissions: text("permissions").array().notNull().default([]),
    ...timestamps,
  },
  (t) => [uniqueIndex("institution_staff_no_unique").on(t.institutionId, t.staffNo)]
);

/** Every credential or notification sent to a person, for support questions. */
export const credentialDeliveries = pgTable(
  "credential_deliveries",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: text("channel", { enum: ["EMAIL", "SMS"] }).notNull(),
    purpose: text("purpose", { enum: ["REGISTRATION", "PASSWORD_RESET"] }).notNull(),
    destination: text("destination").notNull(),
    status: text("status", { enum: ["SENT", "FAILED"] }).notNull().default("SENT"),
    providerRef: text("provider_ref"),
    sentAt: ts("sent_at").notNull().defaultNow(),
  },
  (t) => [index("credential_deliveries_user_idx").on(t.userId)]
);
