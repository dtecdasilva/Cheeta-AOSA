import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";
import { ROLES } from "../../../lib/auth/roles";
import { INSTITUTION_TYPES } from "../../../lib/data";
import { id, oneOf, recordStatus, timestamps, ts } from "./_shared";
import { permissions, roles } from "./access";
import { institutions } from "./institutions";

/**
 * Accounts and the role-specific data hung off them.
 *
 * One `users` row per person who can sign in, whatever their portal. Its
 * role decides the portal; the details that only one kind of account has
 * live in a profile table that shares the user's id:
 *
 *   Applicant portal        users + applicant_profiles
 *   Institution portal      users + institution_staff  -> institutions
 *   Administration portal   users + administrator_profiles
 *
 * What an account may do is its role's permissions (role_permissions)
 * plus any granted to it individually (user_permissions).
 */

export const users = pgTable(
  "users",
  {
    id: id(),
    /** Always stored lower-cased; uniqueness is case-insensitive because of that. */
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull(),
    /** Exactly one role per account, and so exactly one portal. */
    role: text("role", { enum: ROLES as [string, ...string[]] })
      .notNull()
      .references(() => roles.key, { onUpdate: "cascade" }),
    status: recordStatus(),
    phone: text("phone"),
    /** Set for institution staff; the institution they act for. */
    institutionId: text("institution_id").references(() => institutions.id),
    /**
     * When the account's owner proved they control `email`: by opening the
     * verification link, or by signing in with (or resetting to) a
     * password that was only ever sent to that address. Null until then.
     */
    emailVerifiedAt: ts("email_verified_at"),
    mfaEnabled: boolean("mfa_enabled").notNull().default(false),
    /**
     * Copied into every session token. Bumping it (password reset,
     * deactivation, a role change) ends every session the account has at
     * once; signing out ends just one, through auth_sessions.
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
    // Institution staff must belong to an institution.
    check("users_institution_staff_check", sql`${t.role} in ('STUDENT', 'AOSA_ADMIN') or ${t.institutionId} is not null`),
    // ...and nobody else may. An applicant is never tied to one institution:
    // they reach institutions only through application_institutions.
    check("users_non_staff_no_institution_check", sql`${t.role} in ('INSTITUTION_ADMIN', 'INSTITUTION_ADMISSION_USER') or ${t.institutionId} is null`),
  ]
);

/** Student: registration-time data that only applicants have. */
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

/**
 * Institution user: staff-side details for institution accounts
 * (src/lib/mockData/staff.ts). What each admission user may do is in
 * user_permissions; an institution administrator has everything through
 * the role.
 */
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
    ...timestamps,
  },
  (t) => [uniqueIndex("institution_staff_no_unique").on(t.institutionId, t.staffNo), index("institution_staff_institution_idx").on(t.institutionId)]
);

/** Cheeta administrator: details that only Administration portal accounts have. */
export const administratorProfiles = pgTable("administrator_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Job title, e.g. "Payments officer". */
  position: text("position"),
  department: text("department"),
  ...timestamps,
});

/**
 * Permissions granted to one account on top of its role's. Only
 * permissions marked assignable are granted this way, and only to the
 * roles the catalogue allows (src/lib/auth/permissions.ts).
 */
export const userPermissions = pgTable(
  "user_permissions",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    permissionKey: text("permission_key")
      .notNull()
      .references(() => permissions.key, { onDelete: "cascade", onUpdate: "cascade" }),
    /** Who granted it; kept as null if that account is later removed. */
    grantedBy: text("granted_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.permissionKey] }), index("user_permissions_permission_idx").on(t.permissionKey)]
);

/**
 * One row per sign-in. The session token carries the row's id, and a
 * request is only honoured while the row exists, hasn't been revoked and
 * hasn't expired, so signing out really ends the session even if the
 * token itself was copied somewhere.
 */
export const authSessions = pgTable(
  "auth_sessions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: ts("created_at").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
    /** Set on sign-out, or when the account's other sessions are ended. */
    revokedAt: ts("revoked_at"),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (t) => [index("auth_sessions_user_idx").on(t.userId), index("auth_sessions_expires_idx").on(t.expiresAt)]
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
    purpose: text("purpose", { enum: ["REGISTRATION", "PASSWORD_RESET", "EMAIL_VERIFICATION"] }).notNull(),
    destination: text("destination").notNull(),
    status: text("status", { enum: ["SENT", "FAILED"] }).notNull().default("SENT"),
    providerRef: text("provider_ref"),
    sentAt: ts("sent_at").notNull().defaultNow(),
  },
  (t) => [index("credential_deliveries_user_idx").on(t.userId)]
);
