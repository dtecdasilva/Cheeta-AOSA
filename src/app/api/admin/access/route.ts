import { count } from "drizzle-orm";
import { ROLE_LABELS, ROLES } from "@/lib/auth/roles";
import { PERMISSION_CATALOGUE, type PermissionDef } from "@/lib/auth/permissions";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";

/**
 * Access management overview: each role, what it may do, and how many
 * active and inactive accounts hold it. The accounts themselves are at
 * /api/admin/accounts; institution staff permissions, which are granted
 * person by person, at /api/institution/staff.
 *
 * What a role may do is fixed in code, where the server enforces it on
 * every request; it is listed here, not edited, so a setting can never
 * widen what a role can reach.
 */
export const GET = handler({ auth: ["AOSA_ADMIN"] }, async () => {
  const counts = await getDb().select({ role: users.role, status: users.status, n: count() }).from(users).groupBy(users.role, users.status);
  const permissions = PERMISSION_CATALOGUE as readonly PermissionDef[];
  return ok({
    data: {
      roles: ROLES.map((role) => ({
        role,
        label: ROLE_LABELS[role],
        accounts: {
          active: Number(counts.find((c) => c.role === role && c.status === "ACTIVE")?.n ?? 0),
          inactive: Number(counts.find((c) => c.role === role && c.status !== "ACTIVE")?.n ?? 0),
        },
        permissions: permissions.filter((p) => !p.assignableTo && (p.roles as readonly string[]).includes(role)).map((p) => p.key),
        grantable: permissions.filter((p) => (p.assignableTo as readonly string[] | undefined)?.includes(role)).map((p) => p.key),
      })),
      permissions: permissions.map((p) => ({ key: p.key, label: p.label, roles: [...p.roles], grantedIndividually: !!p.assignableTo })),
    },
  });
});
