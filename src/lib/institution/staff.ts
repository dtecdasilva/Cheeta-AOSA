/**
 * Institution users and what each may do. Shared by the staff screens
 * and the API (src/server/modules/institutions/staff.service.ts).
 *
 * An institution has two kinds of user:
 *
 * - Institution Administrator: everything in the institution portal,
 *   including managing staff. Holds every permission below through the role.
 * - Admission User: reviews applications. Holds only the permissions an
 *   administrator has ticked for them.
 */

export type StaffRole = "INSTITUTION_ADMIN" | "INSTITUTION_ADMISSION_USER";
export const STAFF_ROLES: StaffRole[] = ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"];
export const STAFF_ROLE_LABELS: Record<StaffRole, string> = { INSTITUTION_ADMIN: "Institution Administrator", INSTITUTION_ADMISSION_USER: "Admission User" };

export type StaffPermission = "PAYMENTS_UPLOADS" | "ACKNOWLEDGED_APPS" | "REJECTED_APPS" | "DELIBERATION";
export const STAFF_PERMISSIONS: StaffPermission[] = ["PAYMENTS_UPLOADS", "ACKNOWLEDGED_APPS", "REJECTED_APPS", "DELIBERATION"];

export const STAFF_PERMISSION_INFO: Record<StaffPermission, { label: string; grants: string }> = {
  PAYMENTS_UPLOADS: { label: "Student Payments & Uploads", grants: "See application fees and payment details, open applicants' documents, verify payments and approve or reject uploads." },
  ACKNOWLEDGED_APPS: { label: "Acknowledged Applications", grants: "Acknowledge applications and see the ones already acknowledged." },
  REJECTED_APPS: { label: "Rejected Applications", grants: "Reject applications and see the ones already rejected." },
  DELIBERATION: { label: "Deliberation List", grants: "See the deliberation list, make offers, and see applications once an offer is made." },
};

export interface StaffMember {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: StaffRole;
  status: "ACTIVE" | "INACTIVE";
  staffNo: string;
  position: string;
  title: string | null;
  /** Their role on the platform, and what it involves, in the institution's words. */
  platformTitle: string;
  roleDescription: string;
  /** What the person may do: every permission for an administrator, the granted ones for an admission user. */
  permissions: StaffPermission[];
  lastSignInAt: string | null;
  createdAt: string;
  isSelf: boolean;
}
