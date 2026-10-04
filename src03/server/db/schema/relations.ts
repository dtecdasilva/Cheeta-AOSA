import { relations } from "drizzle-orm";
import { permissions, rolePermissions, roles } from "./access";
import { applicationDocuments, applicationFees, applicationInstitutions, applicationStatusEvents, applications, programChoices } from "./applications";
import { admissions, deliberationResults, deliberationRuns } from "./enrolment";
import { administratorProfiles, applicantProfiles, authSessions, institutionStaff, userPermissions, users } from "./identity";
import { institutions } from "./institutions";
import { feePayments } from "./payments";

/**
 * How the account tables relate, for drizzle's relational queries
 * (`db.query.users.findFirst({ with: { role: true, staff: true } })`).
 * The foreign keys themselves are declared on the tables; this file only
 * names the two ends of each one. It covers accounts and access, and the
 * core application chain (applicant -> application ->
 * application_institution -> institution); the other modules query with
 * explicit joins.
 */

export const usersRelations = relations(users, ({ one, many }) => ({
  role: one(roles, { fields: [users.role], references: [roles.key] }),
  institution: one(institutions, { fields: [users.institutionId], references: [institutions.id] }),
  /** At most one of these three exists, matching the role's portal. */
  applicantProfile: one(applicantProfiles),
  staff: one(institutionStaff),
  administratorProfile: one(administratorProfiles),
  permissions: many(userPermissions, { relationName: "holder" }),
  sessions: many(authSessions),
  /** Applicants only. Their only route to an institution. */
  applications: many(applications),
}));

export const authSessionsRelations = relations(authSessions, ({ one }) => ({
  user: one(users, { fields: [authSessions.userId], references: [users.id] }),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(users),
  permissions: many(rolePermissions),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  roles: many(rolePermissions),
  users: many(userPermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, { fields: [rolePermissions.roleKey], references: [roles.key] }),
  permission: one(permissions, { fields: [rolePermissions.permissionKey], references: [permissions.key] }),
}));

export const userPermissionsRelations = relations(userPermissions, ({ one }) => ({
  user: one(users, { fields: [userPermissions.userId], references: [users.id], relationName: "holder" }),
  permission: one(permissions, { fields: [userPermissions.permissionKey], references: [permissions.key] }),
  grantedByUser: one(users, { fields: [userPermissions.grantedBy], references: [users.id], relationName: "granter" }),
}));

export const applicantProfilesRelations = relations(applicantProfiles, ({ one }) => ({
  user: one(users, { fields: [applicantProfiles.userId], references: [users.id] }),
}));

export const institutionStaffRelations = relations(institutionStaff, ({ one }) => ({
  user: one(users, { fields: [institutionStaff.userId], references: [users.id] }),
  institution: one(institutions, { fields: [institutionStaff.institutionId], references: [institutions.id] }),
}));

export const administratorProfilesRelations = relations(administratorProfiles, ({ one }) => ({
  user: one(users, { fields: [administratorProfiles.userId], references: [users.id] }),
}));

export const institutionsRelations = relations(institutions, ({ many }) => ({
  users: many(users),
  staff: many(institutionStaff),
  applications: many(applicationInstitutions),
}));

// ---------------------------------------------------------------------------
// Applicant -> Application -> ApplicationInstitution -> Institution
// ---------------------------------------------------------------------------

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  applicant: one(users, { fields: [applications.applicantId], references: [users.id] }),
  institutions: many(applicationInstitutions),
}));

/** Everything that is decided per institution hangs off this row. */
export const applicationInstitutionsRelations = relations(applicationInstitutions, ({ one, many }) => ({
  application: one(applications, { fields: [applicationInstitutions.applicationId], references: [applications.id] }),
  institution: one(institutions, { fields: [applicationInstitutions.institutionId], references: [institutions.id] }),
  programChoices: many(programChoices),
  fee: one(applicationFees),
  payments: many(feePayments),
  documents: many(applicationDocuments),
  statusEvents: many(applicationStatusEvents),
  deliberationResults: many(deliberationResults),
  admission: one(admissions),
}));

export const programChoicesRelations = relations(programChoices, ({ one }) => ({
  applicationInstitution: one(applicationInstitutions, { fields: [programChoices.applicationInstitutionId], references: [applicationInstitutions.id] }),
}));

export const applicationFeesRelations = relations(applicationFees, ({ one }) => ({
  applicationInstitution: one(applicationInstitutions, { fields: [applicationFees.applicationInstitutionId], references: [applicationInstitutions.id] }),
}));

export const feePaymentsRelations = relations(feePayments, ({ one }) => ({
  applicationInstitution: one(applicationInstitutions, { fields: [feePayments.applicationInstitutionId], references: [applicationInstitutions.id] }),
}));

export const applicationDocumentsRelations = relations(applicationDocuments, ({ one }) => ({
  applicationInstitution: one(applicationInstitutions, { fields: [applicationDocuments.applicationInstitutionId], references: [applicationInstitutions.id] }),
}));

export const applicationStatusEventsRelations = relations(applicationStatusEvents, ({ one }) => ({
  applicationInstitution: one(applicationInstitutions, { fields: [applicationStatusEvents.applicationInstitutionId], references: [applicationInstitutions.id] }),
}));

export const deliberationRunsRelations = relations(deliberationRuns, ({ many }) => ({
  results: many(deliberationResults),
}));

export const deliberationResultsRelations = relations(deliberationResults, ({ one }) => ({
  run: one(deliberationRuns, { fields: [deliberationResults.deliberationRunId], references: [deliberationRuns.id] }),
  applicationInstitution: one(applicationInstitutions, { fields: [deliberationResults.applicationInstitutionId], references: [applicationInstitutions.id] }),
}));

export const admissionsRelations = relations(admissions, ({ one }) => ({
  applicationInstitution: one(applicationInstitutions, { fields: [admissions.applicationInstitutionId], references: [applicationInstitutions.id] }),
}));
