import "server-only";
import { and, eq, notInArray } from "drizzle-orm";
import { PERMISSION_CATALOGUE, isAssignableTo, type PermissionDef, type PermissionKey } from "@/lib/auth/permissions";
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_PORTAL, type Role } from "@/lib/auth/roles";
import type { Executor } from "@/server/db/client";
import { permissions, rolePermissions, roles, userPermissions } from "@/server/db/schema";
import { ForbiddenError, ValidationError } from "@/server/http/errors";

/**
 * Roles and permissions at run time: keeping the catalogue tables in line
 * with the code, and answering "may this account do that?".
 */

const CATALOGUE: readonly PermissionDef[] = PERMISSION_CATALOGUE;

/**
 * Makes `roles`, `permissions` and `role_permissions` match
 * src/lib/auth/roles.ts and src/lib/auth/permissions.ts. Runs at every
 * start-up and before seeding, and is safe to repeat.
 *
 * A permission that has left the catalogue is deleted, along with every
 * grant of it. Roles are only ever added or updated, never deleted:
 * accounts point at them.
 */
export async function syncAccessCatalogue(db: Executor) {
  for (const key of ROLES) {
    const row = { name: ROLE_LABELS[key], description: ROLE_DESCRIPTIONS[key], portal: ROLE_PORTAL[key] };
    await db.insert(roles).values({ key, ...row }).onConflictDoUpdate({ target: roles.key, set: row });
  }

  for (const [i, p] of CATALOGUE.entries()) {
    const row = { label: p.label, assignable: !!p.assignableTo?.length, sortOrder: i };
    await db.insert(permissions).values({ key: p.key, ...row }).onConflictDoUpdate({ target: permissions.key, set: row });
  }

  const grants = CATALOGUE.flatMap((p) => p.roles.map((roleKey) => ({ roleKey, permissionKey: p.key })));
  await db.insert(rolePermissions).values(grants).onConflictDoNothing();

  // Drop role grants the catalogue no longer lists, then permissions it no longer has.
  const wanted = new Set(grants.map((g) => `${g.roleKey}\n${g.permissionKey}`));
  const existing = await db.select({ roleKey: rolePermissions.roleKey, permissionKey: rolePermissions.permissionKey }).from(rolePermissions);
  for (const g of existing) {
    if (wanted.has(`${g.roleKey}\n${g.permissionKey}`)) continue;
    await db.delete(rolePermissions).where(and(eq(rolePermissions.roleKey, g.roleKey), eq(rolePermissions.permissionKey, g.permissionKey)));
  }
  await db.delete(permissions).where(notInArray(permissions.key, CATALOGUE.map((p) => p.key)));
}

type Account = { id: string; role: Role | string };

/** Everything the account may do: its role's permissions plus its own grants. */
export async function permissionsOf(db: Executor, user: Account): Promise<Set<string>> {
  const [byRole, direct] = await Promise.all([
    db.select({ key: rolePermissions.permissionKey }).from(rolePermissions).where(eq(rolePermissions.roleKey, user.role)),
    db.select({ key: userPermissions.permissionKey }).from(userPermissions).where(eq(userPermissions.userId, user.id)),
  ]);
  return new Set([...byRole, ...direct].map((r) => r.key));
}

export async function hasPermission(db: Executor, user: Account, permission: PermissionKey): Promise<boolean> {
  const [viaRole] = await db
    .select({ key: rolePermissions.permissionKey })
    .from(rolePermissions)
    .where(and(eq(rolePermissions.roleKey, user.role), eq(rolePermissions.permissionKey, permission)))
    .limit(1);
  if (viaRole) return true;
  const [direct] = await db
    .select({ key: userPermissions.permissionKey })
    .from(userPermissions)
    .where(and(eq(userPermissions.userId, user.id), eq(userPermissions.permissionKey, permission)))
    .limit(1);
  return !!direct;
}

export async function assertPermission(db: Executor, user: Account, permission: PermissionKey, message = "Your account doesn't have permission for this.") {
  if (!(await hasPermission(db, user, permission))) throw new ForbiddenError(message);
}

/**
 * Replaces the permissions granted individually to one account. Only
 * permissions the catalogue marks as assignable to the account's role are
 * accepted, so this can't be used to hand, say, an applicant an
 * administration permission.
 */
export async function setUserPermissions(db: Executor, user: Account, keys: readonly string[], grantedBy: string | null) {
  const unique = [...new Set(keys)];
  const refused = unique.filter((k) => !isAssignableTo(k, user.role as Role));
  if (refused.length) throw new ValidationError({ permissions: `Not a permission this account can be given: ${refused.join(", ")}.` });

  await db.delete(userPermissions).where(unique.length ? and(eq(userPermissions.userId, user.id), notInArray(userPermissions.permissionKey, unique)) : eq(userPermissions.userId, user.id));
  if (unique.length) {
    await db
      .insert(userPermissions)
      .values(unique.map((permissionKey) => ({ userId: user.id, permissionKey, grantedBy })))
      .onConflictDoNothing();
  }
}

/** Removes every individual grant, e.g. when an account moves to another role. */
export async function clearUserPermissions(db: Executor, userId: string) {
  await db.delete(userPermissions).where(eq(userPermissions.userId, userId));
}
