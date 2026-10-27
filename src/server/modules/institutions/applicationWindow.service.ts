import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { PublicUser } from "@/lib/auth/users";
import { windowState, type ApplicationWindow } from "@/lib/institution/applicationWindow";
import { getDb, type Executor } from "@/server/db/client";
import { institutions } from "@/server/db/schema";
import { audit } from "@/server/audit/audit";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/http/errors";
import { parseWith, text } from "@/server/http/validate";

/** An institution's application window, and whether it is accepting applications now. */

type InstitutionRow = typeof institutions.$inferSelect;

export function windowOf(row: Pick<InstitutionRow, "applicationsMode" | "applicationsOpenAt" | "applicationsCloseAt" | "applicationsMessage">): ApplicationWindow {
  return { mode: row.applicationsMode, opensAt: row.applicationsOpenAt?.toISOString() ?? null, closesAt: row.applicationsCloseAt?.toISOString() ?? null, message: row.applicationsMessage };
}

export function stateOf(row: InstitutionRow) {
  return windowState(windowOf(row), row.name);
}

/** Refuses, with the reason applicants see, when the institution isn't accepting applications. */
export async function assertAcceptingApplications(db: Executor, institutionId: string) {
  const [row] = await db.select().from(institutions).where(eq(institutions.id, institutionId)).limit(1);
  if (!row) throw new NotFoundError("Institution");
  const s = stateOf(row);
  if (!s.open) throw new ConflictError(s.reason!, { field: "institutionId", applications: s.label });
}

const isoDateTime = z.iso.datetime({ offset: true, error: "Enter a date and time." });
const schema = z
  .object({
    mode: z.enum(["OPEN", "CLOSED", "SCHEDULED"]),
    opensAt: isoDateTime.nullable().default(null),
    closesAt: isoDateTime.nullable().default(null),
    message: text(300).default(""),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "SCHEDULED" && !v.opensAt) ctx.addIssue({ code: "custom", path: ["opensAt"], message: "Choose when applications open." });
    if (v.mode === "SCHEDULED" && !v.closesAt) ctx.addIssue({ code: "custom", path: ["closesAt"], message: "Choose when applications close." });
    if (v.opensAt && v.closesAt && v.closesAt <= v.opensAt) ctx.addIssue({ code: "custom", path: ["closesAt"], message: "Closing must come after opening." });
    if (v.mode === "OPEN" && v.closesAt && new Date(v.closesAt) <= new Date()) ctx.addIssue({ code: "custom", path: ["closesAt"], message: "The closing date has passed. Choose a later one, or close applications now." });
  });

function targetOf(user: PublicUser, institutionId?: string): string {
  if (user.role === "AOSA_ADMIN") {
    if (!institutionId) throw new NotFoundError("Institution");
    return institutionId;
  }
  if (!user.institutionId) throw new ForbiddenError("This account isn't linked to an institution.");
  return user.institutionId;
}

export async function getWindow(user: PublicUser, institutionId?: string) {
  const id = targetOf(user, institutionId);
  const [row] = await getDb().select().from(institutions).where(eq(institutions.id, id)).limit(1);
  if (!row) throw new NotFoundError("Institution");
  return stateOf(row);
}

/** Opens, closes or schedules applications. The institution's administrator, or Cheeta administration. */
export async function setWindow(user: PublicUser, input: unknown, institutionId?: string) {
  if (user.role !== "INSTITUTION_ADMIN" && user.role !== "AOSA_ADMIN") throw new ForbiddenError("Only the institution's administrator can open or close applications.");
  const id = targetOf(user, institutionId);
  const v = parseWith(schema, input);
  const db = getDb();
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(institutions).where(eq(institutions.id, id)).limit(1);
    if (!before) throw new NotFoundError("Institution");
    const next = {
      applicationsMode: v.mode,
      // A schedule's dates are kept; OPEN keeps only a closing date; CLOSED keeps none.
      applicationsOpenAt: v.mode === "SCHEDULED" && v.opensAt ? new Date(v.opensAt) : null,
      applicationsCloseAt: v.mode !== "CLOSED" && v.closesAt ? new Date(v.closesAt) : null,
      applicationsMessage: v.message.trim(),
    };
    await tx.update(institutions).set(next).where(eq(institutions.id, id));
    await audit(tx, {
      action: "update",
      entityType: "institution",
      entityId: id,
      institutionId: id,
      before: { applicationsMode: before.applicationsMode, applicationsOpenAt: before.applicationsOpenAt, applicationsCloseAt: before.applicationsCloseAt, applicationsMessage: before.applicationsMessage },
      after: next,
      meta: { what: "application window" },
    });
  });
  return getWindow(user, id);
}
