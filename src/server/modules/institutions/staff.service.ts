import "server-only";
import { and, asc, count, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { generateTemporaryCode, hashPassword } from "@/lib/auth/password";
import { createResetToken } from "@/lib/auth/session";
import type { PublicUser } from "@/lib/auth/users";
import { STAFF_PERMISSIONS, STAFF_ROLES, type StaffMember, type StaffPermission, type StaffRole } from "@/lib/institution/staff";
import { getDb, type Executor } from "@/server/db/client";
import { institutionStaff, userPermissions, users } from "@/server/db/schema";
import { newId } from "@/server/db/ids";
import { audit } from "@/server/audit/audit";
import { assertPermission, setUserPermissions } from "@/server/auth/access";
import { env } from "@/server/config/env";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/http/errors";
import { requiredText } from "@/server/http/validate";
import { sendLoginCredentials, sendPasswordReset } from "@/server/notifications/delivery";

/**
 * An institution administrator managing their own institution's users:
 * adding Institution Administrators and Admission Users, changing their
 * details, role and permissions, deactivating them, and resetting their
 * password.
 *
 * Everything is confined to the caller's institution: another
 * institution's staff, and every applicant and Cheeta administrator, are
 * "not found". Only accounts holding the "inst-staff" permission (the
 * Institution Administrator role) may make changes; any member of staff
 * may see the list.
 */

function institutionOf(user: PublicUser): string {
  if (!user.institutionId) throw new ForbiddenError("This account isn't linked to an institution.");
  return user.institutionId;
}

const assertManager = (db: Executor, user: PublicUser) => assertPermission(db, user, "inst-staff", "Only an institution administrator can manage staff.");

async function load(db: Executor, institutionId: string, id?: string) {
  return db
    .select({ user: users, staff: institutionStaff })
    .from(users)
    .leftJoin(institutionStaff, eq(institutionStaff.userId, users.id))
    .where(and(eq(users.institutionId, institutionId), sql`${users.role} in ('INSTITUTION_ADMIN', 'INSTITUTION_ADMISSION_USER')`, id ? eq(users.id, id) : undefined))
    .orderBy(asc(users.fullName));
}

async function granted(db: Executor, ids: string[]) {
  if (!ids.length) return new Map<string, StaffPermission[]>();
  const rows = await db.select().from(userPermissions).where(sql`${userPermissions.userId} in ${ids}`);
  const out = new Map<string, StaffPermission[]>();
  for (const r of rows) if ((STAFF_PERMISSIONS as string[]).includes(r.permissionKey)) out.set(r.userId, [...(out.get(r.userId) ?? []), r.permissionKey as StaffPermission]);
  return out;
}

function present(row: Awaited<ReturnType<typeof load>>[number], perms: StaffPermission[], self: string): StaffMember {
  const u = row.user;
  const role = u.role as StaffRole;
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone,
    role,
    status: u.status as "ACTIVE" | "INACTIVE",
    staffNo: row.staff?.staffNo ?? "",
    position: row.staff?.position ?? "",
    title: row.staff?.title ?? null,
    platformTitle: row.staff?.platformTitle ?? "",
    roleDescription: row.staff?.roleDescription ?? "",
    // An administrator holds them all through the role; an admission user holds what was granted, in the catalogue's order.
    permissions: role === "INSTITUTION_ADMIN" ? [...STAFF_PERMISSIONS] : STAFF_PERMISSIONS.filter((p) => perms.includes(p)),
    lastSignInAt: u.lastSignInAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    isSelf: u.id === self,
  };
}

export async function listStaff(user: PublicUser) {
  const db = getDb();
  const rows = await load(db, institutionOf(user));
  const perms = await granted(db, rows.map((r) => r.user.id));
  return rows.map((r) => present(r, perms.get(r.user.id) ?? [], user.id));
}

export async function getStaff(user: PublicUser, id: string, db: Executor = getDb()) {
  const [row] = await load(db, institutionOf(user), id);
  if (!row) throw new NotFoundError("Staff member");
  const perms = await granted(db, [id]);
  return present(row, perms.get(id) ?? [], user.id);
}

const permissionList = z.array(z.enum(STAFF_PERMISSIONS as [StaffPermission, ...StaffPermission[]]), { error: "Choose permissions from the list." }).max(STAFF_PERMISSIONS.length);
const details = {
  fullName: requiredText(200),
  phone: z.string().trim().max(40).nullable().optional(),
  staffNo: requiredText(40),
  position: requiredText(120),
  title: z.string().trim().max(40).nullable().optional(),
  platformTitle: z.string().trim().max(120).optional(),
  roleDescription: z.string().trim().max(500).optional(),
};

/** An institution has up to this many active admission users (its administrators aren't counted). */
export const MAX_ADMISSION_USERS = 10;

async function assertAdmissionUserRoom(db: Executor, institutionId: string, exceptUserId?: string) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.institutionId, institutionId), eq(users.role, "INSTITUTION_ADMISSION_USER"), eq(users.status, "ACTIVE"), exceptUserId ? ne(users.id, exceptUserId) : undefined));
  if (Number(n) >= MAX_ADMISSION_USERS) {
    throw new ValidationError({ role: `Your institution already has ${MAX_ADMISSION_USERS} active admission users, the most it can have. Deactivate one first.` });
  }
}

const createSchema = z.object({
  ...details,
  email: z.email({ error: "Enter a valid email address." }).transform((v) => v.trim().toLowerCase()),
  role: z.enum(STAFF_ROLES as [StaffRole, ...StaffRole[]], { error: "Choose Institution Administrator or Admission User." }),
  permissions: permissionList.default([]),
});

const updateSchema = z.object({
  fullName: details.fullName.optional(),
  phone: details.phone,
  staffNo: details.staffNo.optional(),
  position: details.position.optional(),
  title: details.title,
  platformTitle: details.platformTitle,
  roleDescription: details.roleDescription,
  role: createSchema.shape.role.optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  permissions: permissionList.optional(),
});

/** An administrator's permissions come with the role, so none are stored for one. */
function permissionsFor(role: StaffRole, requested: StaffPermission[]) {
  return role === "INSTITUTION_ADMIN" ? [] : [...new Set(requested)];
}

async function assertStaffNoFree(db: Executor, institutionId: string, staffNo: string, exceptUserId?: string) {
  const [clash] = await db
    .select({ userId: institutionStaff.userId })
    .from(institutionStaff)
    .where(and(eq(institutionStaff.institutionId, institutionId), eq(institutionStaff.staffNo, staffNo), exceptUserId ? ne(institutionStaff.userId, exceptUserId) : undefined))
    .limit(1);
  if (clash) throw new ValidationError({ staffNo: "Another member of staff already has this staff ID." });
}

/** Adds a staff account to the caller's institution and sends its sign-in details. */
export async function createStaff(user: PublicUser, input: unknown) {
  const institutionId = institutionOf(user);
  const db = getDb();
  await assertManager(db, user);
  const v = createSchema.parse(input);
  const temporaryCode = generateTemporaryCode();
  const id = newId("usr");
  await db.transaction(async (tx) => {
    await assertStaffNoFree(tx, institutionId, v.staffNo);
    if (v.role === "INSTITUTION_ADMISSION_USER") await assertAdmissionUserRoom(tx, institutionId);
    const [inserted] = await tx
      .insert(users)
      .values({ id, email: v.email, passwordHash: hashPassword(temporaryCode), fullName: v.fullName, role: v.role, phone: v.phone || null, institutionId })
      .onConflictDoNothing({ target: users.email })
      .returning();
    if (!inserted) throw new ValidationError({ email: "Another account already uses this email." });
    await tx.insert(institutionStaff).values({ userId: id, institutionId, staffNo: v.staffNo, position: v.position, title: v.title || null, platformTitle: v.platformTitle ?? "", roleDescription: v.roleDescription ?? "" });
    const perms = permissionsFor(v.role, v.permissions);
    await setUserPermissions(tx, { id, role: v.role }, perms, user.id);
    await audit(tx, { action: "create", entityType: "staff", entityId: id, institutionId, before: null, after: { email: v.email, fullName: v.fullName, role: v.role, staffNo: v.staffNo, permissions: perms } });
  });
  const delivery = await sendLoginCredentials({ id, email: v.email, fullName: v.fullName, mobileNumber: v.phone }, temporaryCode);
  return { data: await getStaff(user, id), ...delivery };
}

/**
 * Changes a staff member's details, role, status or permissions. The
 * institution always keeps at least one active administrator, and an
 * administrator can't deactivate or demote themselves. Deactivating, or
 * changing the role, signs the person out everywhere; a permission change
 * applies from their next request, since permissions are checked on every
 * request.
 */
export async function updateStaff(user: PublicUser, id: string, input: unknown) {
  const institutionId = institutionOf(user);
  const db = getDb();
  await assertManager(db, user);
  const patch = updateSchema.parse(input);
  await db.transaction(async (tx) => {
    const before = await getStaff(user, id, tx);
    const role = patch.role ?? before.role;
    const status = patch.status ?? before.status;
    if (id === user.id && (status === "INACTIVE" || role !== "INSTITUTION_ADMIN")) {
      throw new ValidationError({ [patch.status ? "status" : "role"]: "You can't deactivate your own account or remove your own administrator role." });
    }
    if (before.role === "INSTITUTION_ADMIN" && before.status === "ACTIVE" && (role !== "INSTITUTION_ADMIN" || status !== "ACTIVE")) {
      const [other] = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.institutionId, institutionId), eq(users.role, "INSTITUTION_ADMIN"), eq(users.status, "ACTIVE"), ne(users.id, id)))
        .limit(1);
      if (!other) throw new ValidationError({ role: "The institution needs at least one active administrator." });
    }
    if (patch.permissions && role === "INSTITUTION_ADMIN") throw new ValidationError({ permissions: "An institution administrator has every permission; there is nothing to choose." });
    if (patch.staffNo) await assertStaffNoFree(tx, institutionId, patch.staffNo, id);
    // Becoming an active admission user (reactivated, or moved from administrator) needs a free place.
    if (role === "INSTITUTION_ADMISSION_USER" && status === "ACTIVE" && !(before.role === "INSTITUTION_ADMISSION_USER" && before.status === "ACTIVE")) await assertAdmissionUserRoom(tx, institutionId, id);

    const endSessions = status !== before.status || role !== before.role;
    const account = { ...(patch.fullName !== undefined ? { fullName: patch.fullName } : {}), ...(patch.phone !== undefined ? { phone: patch.phone || null } : {}), ...(patch.role ? { role } : {}), ...(patch.status ? { status } : {}) };
    if (Object.keys(account).length || endSessions) {
      await tx
        .update(users)
        .set({ ...account, ...(endSessions ? { sessionVersion: sql`${users.sessionVersion} + 1` } : {}) })
        .where(eq(users.id, id));
    }
    const staffRow = {
      ...(patch.staffNo ? { staffNo: patch.staffNo } : {}),
      ...(patch.position ? { position: patch.position } : {}),
      ...(patch.title !== undefined ? { title: patch.title || null } : {}),
      ...(patch.platformTitle !== undefined ? { platformTitle: patch.platformTitle } : {}),
      ...(patch.roleDescription !== undefined ? { roleDescription: patch.roleDescription } : {}),
    };
    if (Object.keys(staffRow).length) {
      await tx
        .insert(institutionStaff)
        .values({ userId: id, institutionId, staffNo: patch.staffNo ?? before.staffNo ?? id, position: patch.position ?? before.position ?? "", title: patch.title ?? before.title, platformTitle: patch.platformTitle ?? before.platformTitle, roleDescription: patch.roleDescription ?? before.roleDescription })
        .onConflictDoUpdate({ target: institutionStaff.userId, set: staffRow });
    }
    // Becoming an administrator replaces individual grants with the role's; becoming an admission user starts from what was sent (or none).
    if (patch.permissions || role !== before.role) await setUserPermissions(tx, { id, role }, permissionsFor(role, patch.permissions ?? []), user.id);

    const after = await getStaff(user, id, tx);
    const action = Object.keys(patch).length === 1 && patch.status ? "status" : patch.permissions && Object.keys(patch).length === 1 ? "permissions" : "update";
    await audit(tx, {
      action,
      entityType: "staff",
      entityId: id,
      institutionId,
      before: { fullName: before.fullName, phone: before.phone, role: before.role, status: before.status, staffNo: before.staffNo, position: before.position, title: before.title, platformTitle: before.platformTitle, roleDescription: before.roleDescription, permissions: before.permissions },
      after: { fullName: after.fullName, phone: after.phone, role: after.role, status: after.status, staffNo: after.staffNo, position: after.position, title: after.title, platformTitle: after.platformTitle, roleDescription: after.roleDescription, permissions: after.permissions },
    });
  });
  return getStaff(user, id);
}

/** Sends a staff member a link to set a new password. */
export async function resetStaffPassword(user: PublicUser, id: string) {
  const db = getDb();
  await assertManager(db, user);
  const member = await getStaff(user, id);
  if (member.status !== "ACTIVE") throw new ConflictError("Activate the account before resetting its password.");
  const [row] = await db.select({ sessionVersion: users.sessionVersion }).from(users).where(eq(users.id, id)).limit(1);
  const token = await createResetToken(id, row.sessionVersion);
  await sendPasswordReset({ id, email: member.email }, token);
  await audit(db, { action: "password_reset_requested", entityType: "staff", entityId: id, institutionId: institutionOf(user) });
  return { ok: true, ...(env.NODE_ENV !== "production" ? { devResetUrl: `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}` } : {}) };
}
