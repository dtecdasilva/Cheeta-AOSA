// Central definition of the four user categories and which URL prefix
// ("portal") each one is allowed into. Adding a new role or portal means
// touching only this file plus the middleware matcher config. The `roles`
// table is filled from these constants at start-up (src/server/auth/access.ts).

export type Role =
  | "STUDENT"
  | "INSTITUTION_ADMIN"
  | "INSTITUTION_ADMISSION_USER"
  | "AOSA_ADMIN";

export type AccountStatus = "ACTIVE" | "INACTIVE";

export const ROLES: Role[] = [
  "STUDENT",
  "INSTITUTION_ADMIN",
  "INSTITUTION_ADMISSION_USER",
  "AOSA_ADMIN",
];

/**
 * The three portals. Every role belongs to exactly one, and an account
 * has exactly one role, so an account can only ever be inside one portal.
 */
export type Portal = "STUDENT" | "INSTITUTION" | "ADMIN";

export const PORTALS: Portal[] = ["STUDENT", "INSTITUTION", "ADMIN"];

export const PORTAL_LABELS: Record<Portal, string> = {
  STUDENT: "Applicant portal",
  INSTITUTION: "Institution portal",
  ADMIN: "Administration portal",
};

export const ROLE_PORTAL: Record<Role, Portal> = {
  STUDENT: "STUDENT",
  INSTITUTION_ADMIN: "INSTITUTION",
  INSTITUTION_ADMISSION_USER: "INSTITUTION",
  AOSA_ADMIN: "ADMIN",
};

/** Stored with each role, and shown wherever a role needs explaining. */
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  STUDENT: "Registers, completes an application and applies to institutions.",
  INSTITUTION_ADMIN: "Runs an institution's account: its structure, staff, fees and every admissions decision.",
  INSTITUTION_ADMISSION_USER: "Institution staff who handle applications, limited to the permissions granted to them.",
  AOSA_ADMIN: "Cheeta staff who run the platform: institutions, parameters, payments, accounts and reports.",
};

export const ROLE_LABELS: Record<Role, string> = {
  STUDENT: "Student / Applicant",
  INSTITUTION_ADMIN: "Institution Administrator",
  INSTITUTION_ADMISSION_USER: "Institution Admission User",
  AOSA_ADMIN: "Cheeta / AOSA Administrator",
};

/** URL prefix each role is confined to. */
export const ROLE_PORTAL_PREFIX: Record<Role, string> = {
  STUDENT: "/student",
  INSTITUTION_ADMIN: "/institution",
  INSTITUTION_ADMISSION_USER: "/institution",
  AOSA_ADMIN: "/admin",
};

/** Where to send a role immediately after login. */
export const ROLE_HOME: Record<Role, string> = {
  STUDENT: "/student/dashboard",
  INSTITUTION_ADMIN: "/institution/dashboard",
  INSTITUTION_ADMISSION_USER: "/institution/dashboard",
  AOSA_ADMIN: "/admin/dashboard",
};

/** Protected URL prefixes and the roles allowed into each. Order matters:
 * first matching prefix wins, so put more specific prefixes first if you
 * ever nest one portal inside another (not the case today). */
export const PROTECTED_PREFIXES: { prefix: string; roles: Role[] }[] = [
  { prefix: "/student", roles: ["STUDENT"] },
  { prefix: "/institution", roles: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] },
  { prefix: "/admin", roles: ["AOSA_ADMIN"] },
];

export function findProtectedRule(pathname: string) {
  return PROTECTED_PREFIXES.find((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"));
}
