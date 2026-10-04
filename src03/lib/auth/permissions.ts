import type { Role } from "./roles";

/**
 * Every permission on the platform and who holds it.
 *
 * This list is the source of truth. The `permissions` and
 * `role_permissions` tables are brought in line with it each time the
 * server starts (src/server/auth/access.ts), so adding a permission or
 * changing which role holds one is an edit here and nothing else.
 *
 * A permission reaches an account in one of two ways:
 *
 * - `roles`        Every account with one of these roles has it.
 * - `assignableTo` Accounts with one of these roles have it only when it
 *                  has been granted to them individually (a row in
 *                  `user_permissions`). This is how an institution
 *                  administrator decides what each admission user may do.
 *
 * Kept free of server imports so the portals can read the labels too.
 */
export interface PermissionDef {
  key: string;
  label: string;
  roles: readonly Role[];
  assignableTo?: readonly Role[];
}

export const PERMISSION_CATALOGUE = [
  // Applicant portal
  { key: "apply", label: "Complete and submit applications", roles: ["STUDENT"] },
  { key: "pay", label: "Record application fee payments", roles: ["STUDENT"] },

  // Institution portal
  { key: "inst-structure", label: "Manage faculties, departments and programs", roles: ["INSTITUTION_ADMIN", "AOSA_ADMIN"] },
  { key: "inst-staff", label: "Manage institution staff", roles: ["INSTITUTION_ADMIN"] },
  { key: "review", label: "Review and acknowledge applications", roles: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] },
  { key: "deliberate", label: "Run deliberations and issue admissions", roles: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] },

  // Institution portal, granted to admission users one by one (the staff form's checkboxes)
  { key: "PAYMENTS_UPLOADS", label: "Student payments and uploads", roles: ["INSTITUTION_ADMIN"], assignableTo: ["INSTITUTION_ADMISSION_USER"] },
  { key: "ACKNOWLEDGED_APPS", label: "Acknowledged applications", roles: ["INSTITUTION_ADMIN"], assignableTo: ["INSTITUTION_ADMISSION_USER"] },
  { key: "REJECTED_APPS", label: "Rejected applications", roles: ["INSTITUTION_ADMIN"], assignableTo: ["INSTITUTION_ADMISSION_USER"] },
  { key: "DELIBERATION", label: "Deliberation list", roles: ["INSTITUTION_ADMIN"], assignableTo: ["INSTITUTION_ADMISSION_USER"] },

  // Administration portal
  { key: "approve-fees", label: "Approve application fee payments", roles: ["AOSA_ADMIN"] },
  { key: "institutions", label: "Add and accredit institutions", roles: ["AOSA_ADMIN"] },
  { key: "parameters", label: "Edit platform parameters and configuration", roles: ["AOSA_ADMIN"] },
  { key: "accounts", label: "Manage platform accounts", roles: ["AOSA_ADMIN"] },
  { key: "reports", label: "View platform-wide reports", roles: ["AOSA_ADMIN"] },
] as const satisfies readonly PermissionDef[];

export type PermissionKey = (typeof PERMISSION_CATALOGUE)[number]["key"];

/** The permissions an institution administrator can grant to an admission user. */
export type StaffPermission = Extract<(typeof PERMISSION_CATALOGUE)[number], { assignableTo: readonly Role[] }>["key"];

export const PERMISSION_KEYS = PERMISSION_CATALOGUE.map((p) => p.key) as PermissionKey[];

const DEFS: readonly PermissionDef[] = PERMISSION_CATALOGUE;

/** Whether `role` is one of the roles this permission can be granted to individually. */
export function isAssignableTo(key: string, role: Role): boolean {
  return DEFS.some((p) => p.key === key && (p.assignableTo ?? []).includes(role));
}
