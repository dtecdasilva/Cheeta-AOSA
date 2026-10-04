import { createCollection } from "./store";
import type { Role, AccountStatus } from "@/lib/auth/roles";
import { PERMISSION_CATALOGUE, type PermissionDef } from "@/lib/auth/permissions";

/**
 * Platform accounts as the Access management screen lists them.
 *
 * Real authentication lives server-side (src/lib/auth/users.ts) and never
 * leaves the server with its password hashes. This is the admin-facing
 * projection of that table — no credentials, plus the audit fields the
 * screen shows. When the backend lands, this store is replaced by a
 * `GET /api/admin/users` that returns exactly this shape.
 */

export interface PlatformAccount {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  institutionId: string;
  status: AccountStatus;
  /** Admin accounts must use a second factor. */
  mfa: boolean;
  lastSignInAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * What each role can do. Shown as a matrix on the Access screen.
 *
 * Read from the platform's permission catalogue, leaving out the ones
 * granted to institution staff individually: those vary per person, so
 * they have no place in a role-by-role matrix.
 */
export const PERMISSIONS: { key: string; label: string; roles: Role[] }[] = (PERMISSION_CATALOGUE as readonly PermissionDef[])
  .filter((p) => !p.assignableTo)
  .map((p) => ({ key: p.key, label: p.label, roles: [...p.roles] }));

type Seed = [id: string, name: string, email: string, phone: string, role: Role, inst: string, status: AccountStatus, mfa: boolean, lastSignIn: string, created: string];

// The first five match the demo accounts in src/lib/auth/users.ts.
const SEEDS: Seed[] = [
  ["usr-aosa-admin-1", "Chantal Biya-Fouda", "root@aosa.cheeta.local", "+237 670 100 001", "AOSA_ADMIN", "", "ACTIVE", true, "2026-10-02T16:40:00Z", "2026-01-01"],
  ["usr-inst-admin-1", "Dr. Rose Ateba", "admin@montfebe.cheeta.local", "+237 670 200 001", "INSTITUTION_ADMIN", "inst-1", "ACTIVE", true, "2026-10-01T08:12:00Z", "2026-01-10"],
  ["usr-inst-admission-1", "Jules Etoundi", "admissions@montfebe.cheeta.local", "+237 670 200 002", "INSTITUTION_ADMISSION_USER", "inst-1", "ACTIVE", false, "2026-09-30T14:03:00Z", "2026-01-10"],
  ["usr-student-1", "Aïssatou Mballa", "student@cheeta.local", "+237 670 000 001", "STUDENT", "", "ACTIVE", false, "2026-10-02T19:21:00Z", "2026-01-15"],
  ["usr-student-2", "Paul Nguemo", "inactive.student@cheeta.local", "+237 670 000 002", "STUDENT", "", "INACTIVE", false, "2026-02-03T10:00:00Z", "2026-01-16"],
  ["usr-aosa-admin-2", "Hervé Nkodo", "payments@aosa.cheeta.local", "+237 670 100 002", "AOSA_ADMIN", "", "ACTIVE", true, "2026-10-02T11:55:00Z", "2026-02-01"],
  ["usr-inst-admin-2", "Eng. Roland Ekwalla", "admin@sanagapoly.example.cm", "+237 670 300 001", "INSTITUTION_ADMIN", "inst-2", "ACTIVE", true, "2026-09-28T09:30:00Z", "2026-01-22"],
  ["usr-inst-admission-2", "Amina Kouotou", "admissions@sanagapoly.example.cm", "+237 670 300 002", "INSTITUTION_ADMISSION_USER", "inst-2", "INACTIVE", false, "2026-05-11T15:47:00Z", "2026-01-22"],
  ["usr-inst-admin-3", "Mrs. Florence Ngwa", "admin@bpsh.example.cm", "+237 670 400 001", "INSTITUTION_ADMIN", "inst-3", "ACTIVE", false, "2026-09-25T07:58:00Z", "2026-02-11"],
  ["usr-inst-admin-4", "M. Jean-Paul Tchoua", "admin@lgbafoussam.example.cm", "+237 670 500 001", "INSTITUTION_ADMIN", "inst-4", "ACTIVE", false, "2026-09-19T12:20:00Z", "2026-02-20"],
];

export const accountStore = createCollection<PlatformAccount>("accounts", () =>
  SEEDS.map(([id, fullName, email, phone, role, institutionId, status, mfa, lastSignInAt, created]) => ({
    id,
    fullName,
    email,
    phone,
    role,
    institutionId,
    status,
    mfa,
    lastSignInAt,
    createdAt: `${created}T09:00:00.000Z`,
    updatedAt: `${created}T09:00:00.000Z`,
  }))
);
