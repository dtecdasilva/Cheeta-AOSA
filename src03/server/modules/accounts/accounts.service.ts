import "server-only";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { ROLES, type Role } from "@/lib/auth/roles";
import { generateTemporaryCode, hashPassword } from "@/lib/auth/password";
import { createResetToken } from "@/lib/auth/session";
import { getDb, type Executor } from "@/server/db/client";
import { administratorProfiles, institutions, users } from "@/server/db/schema";
import { newId } from "@/server/db/ids";
import { audit } from "@/server/audit/audit";
import { clearUserPermissions } from "@/server/auth/access";
import { ConflictError, NotFoundError, ValidationError } from "@/server/http/errors";
import { requiredText } from "@/server/http/validate";
import type { ResourceDef } from "@/server/modules/resource";
import { sendLoginCredentials, recordPasswordResetSent } from "@/server/notifications/delivery";
import { env } from "@/server/config/env";

/**
 * Platform accounts for Access management. Listing and reading go through
 * the generic resource layer; creating (an invitation with a temporary
 * code), updating and password resets are here because they touch
 * credentials and sessions.
 */

const isInstitutionRole = (r: string) => r === "INSTITUTION_ADMIN" || r === "INSTITUTION_ADMISSION_USER";

/** Never send credentials or lockout internals to the client. */
function present(row: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, sessionVersion, failedLoginCount, ...rest } = row;
  return rest;
}

export const accountResource: ResourceDef<z.ZodObject> = {
  name: "account",
  table: users,
  idColumn: users.id,
  idPrefix: "usr",
  create: z.object({}),
  searchColumns: [users.fullName, users.email, users.phone],
  filters: { role: users.role, institutionId: users.institutionId },
  orderBy: [users.role, users.fullName],
  statusColumn: users.status,
  institutionColumn: users.institutionId,
  present,
};

const roleEnum = z.enum(ROLES as [Role, ...Role[]]);

const inviteSchema = z
  .object({
    fullName: requiredText(200),
    email: z.email().transform((v) => v.trim().toLowerCase()),
    phone: z.string().trim().max(40).optional(),
    role: roleEnum,
    institutionId: z.string().trim().optional(),
    mfaEnabled: z.boolean().default(false),
  })
  .refine((v) => !isInstitutionRole(v.role) || !!v.institutionId, { path: ["institutionId"], message: "Choose the institution." });

const updateSchema = z.object({
  fullName: requiredText(200).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  role: roleEnum.optional(),
  institutionId: z.string().trim().nullable().optional(),
  mfaEnabled: z.boolean().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

async function assertInstitution(id: string | null | undefined, db: Executor = getDb()) {
  if (!id) return;
  const [row] = await db.select({ id: institutions.id }).from(institutions).where(eq(institutions.id, id)).limit(1);
  if (!row) throw new ValidationError({ institutionId: "Choose an institution from the list." });
}

export async function inviteAccount(input: unknown) {
  const v = inviteSchema.parse(input);
  if (v.role === "STUDENT") throw new ValidationError({ role: "Applicants register themselves; invite staff accounts here." });
  await assertInstitution(v.institutionId);
  const temporaryCode = generateTemporaryCode();
  const id = newId("usr");
  const row = await getDb().transaction(async (tx) => {
    const [inserted] = await tx
      .insert(users)
      .values({
        id,
        email: v.email,
        passwordHash: hashPassword(temporaryCode),
        fullName: v.fullName,
        role: v.role,
        phone: v.phone || null,
        institutionId: isInstitutionRole(v.role) ? v.institutionId! : null,
        mfaEnabled: v.mfaEnabled,
      })
      .onConflictDoNothing({ target: users.email })
      .returning();
    if (!inserted) throw new ConflictError("Another account already uses this email.", { field: "email" });
    if (v.role === "AOSA_ADMIN") await tx.insert(administratorProfiles).values({ userId: id });
    await audit(tx, { action: "create", entityType: "account", entityId: id, institutionId: inserted.institutionId, before: null, after: present(inserted) });
    return inserted;
  });
  const delivery = await sendLoginCredentials({ id, email: v.email, fullName: v.fullName, mobileNumber: v.phone }, temporaryCode);
  return { data: present(row), ...delivery };
}

export async function updateAccount(id: string, input: unknown, actorId: string) {
  const patch = updateSchema.parse(input);
  const db = getDb();
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(users).where(eq(users.id, id)).limit(1);
    if (!existing) throw new NotFoundError("Account");

    const role = patch.role ?? existing.role;
    const institutionId = patch.institutionId !== undefined ? patch.institutionId : existing.institutionId;
    if (isInstitutionRole(role) && !institutionId) throw new ValidationError({ institutionId: "Choose the institution." });
    // On the transaction's own connection: embedded PGlite has only one, so a second would wait forever.
    if (patch.institutionId) await assertInstitution(patch.institutionId, tx);
    if ((patch.role && patch.role !== existing.role) || patch.institutionId !== undefined) {
      if (existing.role === "STUDENT" || patch.role === "STUDENT") throw new ValidationError({ role: "Applicant accounts can't be turned into staff accounts, or the reverse." });
    }

    const losingAdmin = existing.role === "AOSA_ADMIN" && existing.status === "ACTIVE" && (patch.status === "INACTIVE" || (patch.role && patch.role !== "AOSA_ADMIN"));
    if (losingAdmin) {
      const [other] = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, "AOSA_ADMIN"), eq(users.status, "ACTIVE"), ne(users.id, id)))
        .limit(1);
      if (!other) throw new ValidationError({ status: "The last active administrator can't be deactivated or demoted." });
    }
    if (id === actorId && patch.status === "INACTIVE") throw new ValidationError({ status: "You can't deactivate your own account." });

    // Losing access or changing what the account can do ends its sessions.
    const endSessions = patch.status === "INACTIVE" || (patch.role && patch.role !== existing.role) || (patch.institutionId !== undefined && patch.institutionId !== existing.institutionId);
    const [updated] = await tx
      .update(users)
      .set({
        ...patch,
        institutionId: isInstitutionRole(role) ? institutionId : null,
        ...(endSessions ? { sessionVersion: sql`${users.sessionVersion} + 1` } : {}),
      })
      .where(eq(users.id, id))
      .returning();

    if (role !== existing.role) {
      // Individual grants and the administrator profile belong to the old role.
      await clearUserPermissions(tx, id);
      if (role === "AOSA_ADMIN") await tx.insert(administratorProfiles).values({ userId: id }).onConflictDoNothing();
      else await tx.delete(administratorProfiles).where(eq(administratorProfiles.userId, id));
    }
    await audit(tx, { action: Object.keys(patch).length === 1 && patch.status ? "status" : "update", entityType: "account", entityId: id, institutionId: updated.institutionId, before: present(existing), after: present(updated) });
    return present(updated);
  });
}

/** Issues a reset link for an account. Returned outside production because no email provider is connected. */
export async function sendPasswordReset(id: string) {
  const [user] = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) throw new NotFoundError("Account");
  if (user.status !== "ACTIVE") throw new ValidationError({ status: "Activate the account before resetting its password." });
  const token = await createResetToken(user.id, user.sessionVersion);
  const resetUrl = `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  await recordPasswordResetSent(user.id, user.email);
  await audit(getDb(), { action: "password_reset_requested", entityType: "account", entityId: id, institutionId: user.institutionId });
  return { ok: true, ...(env.NODE_ENV !== "production" ? { devResetUrl: resetUrl } : {}) };
}
