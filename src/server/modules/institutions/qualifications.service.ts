import "server-only";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { PublicUser } from "@/lib/auth/users";
import { getDb, type Executor } from "@/server/db/client";
import { institutionQualifications, institutions, parameters, programs } from "@/server/db/schema";
import { audit } from "@/server/audit/audit";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/http/errors";
import { parseWith } from "@/server/http/validate";

/**
 * An institution's "Anticipated Qualifications": the qualifications it
 * offers, picked from the platform's "Qualification types". A study program
 * can only lead to one of them, and one can't be taken off the list while
 * an active program still leads to it.
 */

export interface QualificationOption {
  id: string;
  label: string;
  code: string;
  /** Still offered by the platform. An inactive one stays on an institution's list until removed, but can't be added. */
  active: boolean;
}

export interface InstitutionQualifications {
  institutionId: string;
  /** Every qualification the platform offers, for the "List of Qualifications" side. */
  available: QualificationOption[];
  /** The institution's own list, with how many active programs lead to each. */
  offered: (QualificationOption & { activePrograms: number })[];
}

export function institutionOf(user: PublicUser) {
  if (!user.institutionId) throw new ForbiddenError("This account isn't linked to an institution.");
  return user.institutionId;
}

export async function offeredQualificationIds(db: Executor, institutionId: string): Promise<Set<string>> {
  const rows = await db.select({ id: institutionQualifications.qualificationId }).from(institutionQualifications).where(eq(institutionQualifications.institutionId, institutionId));
  return new Set(rows.map((r) => r.id));
}

export async function getQualifications(institutionId: string, db: Executor = getDb()): Promise<InstitutionQualifications> {
  const [inst] = await db.select({ id: institutions.id }).from(institutions).where(eq(institutions.id, institutionId)).limit(1);
  if (!inst) throw new NotFoundError("Institution");
  const [types, mine, used] = await Promise.all([
    db.select().from(parameters).where(eq(parameters.category, "qualification-types")).orderBy(asc(parameters.sortOrder), asc(parameters.label)),
    offeredQualificationIds(db, institutionId),
    db
      .select({ id: programs.qualificationId, n: count() })
      .from(programs)
      .where(and(eq(programs.institutionId, institutionId), eq(programs.status, "ACTIVE")))
      .groupBy(programs.qualificationId),
  ]);
  const option = (t: (typeof types)[number]): QualificationOption => ({ id: t.id, label: t.label, code: t.code, active: t.status === "ACTIVE" });
  const usedBy = new Map(used.map((u) => [u.id, Number(u.n)]));
  return {
    institutionId,
    available: types.filter((t) => t.status === "ACTIVE").map(option),
    offered: types.filter((t) => mine.has(t.id)).map((t) => ({ ...option(t), activePrograms: usedBy.get(t.id) ?? 0 })),
  };
}

const setSchema = z.object({
  qualificationIds: z.array(z.string().trim().min(1).max(100), { error: "Send the list of qualifications." }).max(200),
});

/** Replaces the institution's list. Refuses an unknown or withdrawn qualification, and removing one an active program leads to. */
export async function setQualifications(user: PublicUser, institutionId: string, input: unknown) {
  const ids = [...new Set(parseWith(setSchema, input).qualificationIds)];
  const db = getDb();
  await db.transaction(async (tx) => {
    const before = await offeredQualificationIds(tx, institutionId);
    const types = ids.length ? await tx.select().from(parameters).where(and(inArray(parameters.id, ids), eq(parameters.category, "qualification-types"))) : [];
    const byId = new Map(types.map((t) => [t.id, t]));
    const unknown = ids.filter((id) => !byId.has(id));
    if (unknown.length) throw new ValidationError({ qualificationIds: "Choose qualifications from the list." });
    // A qualification the platform has withdrawn can stay where it already is, but not be added.
    const withdrawn = ids.filter((id) => byId.get(id)!.status !== "ACTIVE" && !before.has(id));
    if (withdrawn.length) throw new ValidationError({ qualificationIds: `${withdrawn.map((id) => byId.get(id)!.label).join(", ")} is no longer offered by the platform.` });

    const removed = [...before].filter((id) => !ids.includes(id));
    if (removed.length) {
      const inUse = await tx
        .select({ qualificationId: programs.qualificationId, label: parameters.label })
        .from(programs)
        .innerJoin(parameters, eq(parameters.id, programs.qualificationId))
        .where(and(eq(programs.institutionId, institutionId), eq(programs.status, "ACTIVE"), inArray(programs.qualificationId, removed)));
      if (inUse.length) {
        const names = [...new Set(inUse.map((r) => r.label))].join(", ");
        throw new ValidationError({ qualificationIds: `Active study programs lead to ${names}. Deactivate those programs, or move them to another qualification, before removing it.` });
      }
      await tx.delete(institutionQualifications).where(and(eq(institutionQualifications.institutionId, institutionId), inArray(institutionQualifications.qualificationId, removed)));
    }
    const added = ids.filter((id) => !before.has(id));
    if (added.length) await tx.insert(institutionQualifications).values(added.map((qualificationId) => ({ institutionId, qualificationId }))).onConflictDoNothing();
    if (added.length || removed.length) {
      await audit(tx, { action: "update", entityType: "institution-qualifications", entityId: institutionId, institutionId, actorUserId: user.id, before: { qualificationIds: [...before].sort() }, after: { qualificationIds: [...ids].sort() } });
    }
  });
  return getQualifications(institutionId);
}
