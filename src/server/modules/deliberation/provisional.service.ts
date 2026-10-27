import "server-only";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { PublicUser } from "@/lib/auth/users";
import { letterDate } from "@/lib/admissions/letter";
import { getDb, type Executor } from "@/server/db/client";
import { admissions, applicationInstitutions, applications, deliberationResults, deliberationRuns, institutions, programs, users } from "@/server/db/schema";
import { newId, nextCounter } from "@/server/db/ids";
import { audit } from "@/server/audit/audit";
import { assertPermission } from "@/server/auth/access";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/http/errors";
import { parseWith } from "@/server/http/validate";
import { env } from "@/server/config/env";
import { notifyEvent } from "@/server/notifications/engine";
import { loadApplicationInstitution } from "@/server/modules/applications/applications.queries";
import { transition } from "@/server/modules/applications/applications.workflow";
import { assertCanDeliberate, chargeNames } from "./deliberation.service";

/**
 * Provisional admission: an offer made pending conditions the applicant
 * can't meet yet, typically results that aren't out.
 *
 * Admissions only ever come from deliberation, and so does this one: once
 * the institution's latest run is published, it can provisionally admit an
 * applicant that run did not admit, while the application is still on the
 * Deliberation List, to one of the applicant's own choices that still has
 * places, stating the conditions and the date they must be met by. It is
 * part of deliberation, so it needs the "Deliberation List" permission and
 * an active deliberation subscription.
 *
 * The applicant can take the offer up as usual (tuition and medical open as
 * for any admission), but can't be matriculated while it is provisional.
 * The institution then either
 *   - confirms the conditions met: the admission becomes FULL and a full
 *     admission letter is issued in place of the provisional one, or
 *   - withdraws it (conditions not met): the admission is WITHDRAWN, its
 *     place is freed, and the application is closed as not admitted.
 */

function institutionOf(user: PublicUser): string {
  if (!user.institutionId) throw new ForbiddenError("This account isn't linked to an institution.");
  return user.institutionId;
}

const assertAccess = (db: Executor, user: PublicUser) => assertPermission(db, user, "DELIBERATION", "Provisional admission needs the \"Deliberation List\" permission.");

/** Each program's places left: available spaces less offers outstanding or taken up (as the deliberation engine counts them). */
async function placesLeft(db: Executor, institutionId: string, programIds: string[]) {
  if (!programIds.length) return new Map<string, number>();
  const [progs, taken] = await Promise.all([
    db.select({ id: programs.id, spaces: programs.availableSpaces }).from(programs).where(and(eq(programs.institutionId, institutionId), inArray(programs.id, programIds))),
    db
      .select({ programId: admissions.programId, n: count() })
      .from(admissions)
      .innerJoin(applicationInstitutions, eq(applicationInstitutions.id, admissions.applicationInstitutionId))
      .where(and(eq(applicationInstitutions.institutionId, institutionId), inArray(admissions.programId, programIds), inArray(admissions.status, ["OFFERED", "ACCEPTED"]), inArray(applicationInstitutions.status, ["ACCEPTED", "A_ACKNOWLEDGED"])))
      .groupBy(admissions.programId),
  ]);
  return new Map(progs.map((p) => [p.id, Math.max(0, p.spaces - Number(taken.find((t) => t.programId === p.id)?.n ?? 0))]));
}

async function latestRun(db: Executor, institutionId: string) {
  const [run] = await db.select().from(deliberationRuns).where(eq(deliberationRuns.institutionId, institutionId)).orderBy(desc(deliberationRuns.runNumber)).limit(1);
  return run ?? null;
}

/**
 * Who can be provisionally admitted now: those the latest published run
 * did not admit who are still on the Deliberation List, each with their
 * choices and the places left on each.
 */
export async function provisionalCandidates(user: PublicUser) {
  const institutionId = institutionOf(user);
  const db = getDb();
  await assertAccess(db, user);
  await assertCanDeliberate(db, institutionId);
  const run = await latestRun(db, institutionId);
  if (!run || run.status !== "PUBLISHED") {
    return { run: run ? { id: run.id, runNumber: run.runNumber, status: run.status } : null, reason: run ? "Publish the latest deliberation run first." : "Run and publish a deliberation first.", candidates: [] };
  }
  const rows = await db
    .select({ r: deliberationResults, status: applicationInstitutions.status })
    .from(deliberationResults)
    .innerJoin(applicationInstitutions, eq(applicationInstitutions.id, deliberationResults.applicationInstitutionId))
    .where(and(eq(deliberationResults.deliberationRunId, run.id), eq(deliberationResults.outcome, "UNSUCCESSFUL"), eq(applicationInstitutions.status, "I_ACKNOWLEDGED")));
  const apps = await Promise.all(rows.map((x) => loadApplicationInstitution(db, x.r.applicationInstitutionId)));
  const left = await placesLeft(db, institutionId, [...new Set(apps.flatMap((a) => a.choices.map((c) => c.programId)))]);
  const names = apps.length
    ? await db
        .select({ id: applications.id, name: users.fullName })
        .from(applications)
        .innerJoin(users, eq(users.id, applications.applicantId))
        .where(inArray(applications.id, apps.map((a) => a.application.id)))
    : [];
  return {
    run: { id: run.id, runNumber: run.runNumber, status: run.status },
    reason: null,
    candidates: rows.map((x, i) => {
      const app = apps[i];
      return {
        resultId: x.r.id,
        applicationId: app.id,
        applicationNumber: app.applicationNumber ?? app.reference,
        applicant: names.find((n) => n.id === app.application.id)?.name ?? "",
        stoppedAt: x.r.failedAt,
        reason: x.r.note,
        choices: [...app.choices].sort((a, b) => a.rank - b.rank).map((c) => ({ rank: c.rank, programId: c.programId, program: c.programName, code: c.programCode, placesLeft: left.get(c.programId) ?? 0 })),
      };
    }),
  };
}

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Douala" }).format(new Date());

const admitSchema = z.object({
  resultId: z.string().min(1).max(100),
  programId: z.string().min(1).max(100),
  conditions: z.string({ error: "Say what the applicant still has to provide or achieve." }).trim().min(10, "Describe the conditions (at least 10 characters).").max(2000),
  deadline: z.iso.date({ error: "Give the date the conditions must be met by." }),
});

/** Makes a provisional offer to an applicant the latest published run didn't admit. */
export async function provisionalAdmit(user: PublicUser, input: unknown) {
  const v = parseWith(admitSchema, input);
  if (v.deadline < today()) throw new ValidationError({ deadline: "The deadline can't be in the past." });
  const institutionId = institutionOf(user);
  const db = getDb();
  await assertAccess(db, user);
  const id = await db.transaction(async (tx) => {
    const subscription = await assertCanDeliberate(tx, institutionId);
    const [hit] = await tx
      .select({ r: deliberationResults, run: deliberationRuns })
      .from(deliberationResults)
      .innerJoin(deliberationRuns, eq(deliberationRuns.id, deliberationResults.deliberationRunId))
      .where(and(eq(deliberationResults.id, v.resultId), eq(deliberationRuns.institutionId, institutionId)))
      .limit(1);
    if (!hit) throw new NotFoundError("Deliberation result");
    const latest = await latestRun(tx, institutionId);
    if (latest?.id !== hit.run.id) throw new ConflictError("A newer deliberation run has been made since. Use the latest run.");
    if (hit.run.status !== "PUBLISHED") throw new ConflictError("Publish this deliberation run before making provisional offers.");
    if (hit.r.outcome !== "UNSUCCESSFUL") throw new ConflictError("This applicant was admitted by the run; the offer was made when it was published.");
    const app = await loadApplicationInstitution(tx, hit.r.applicationInstitutionId);
    if (app.status !== "I_ACKNOWLEDGED") throw new ConflictError("This application is no longer on the Deliberation List.");
    const choice = app.choices.find((c) => c.programId === v.programId);
    if (!choice) throw new ValidationError({ programId: "Choose one of the programs the applicant applied for." });
    // Hold the program while its places are counted, so two offers at once can't both take the last place.
    await tx.select({ id: programs.id }).from(programs).where(eq(programs.id, v.programId)).for("update");
    if (((await placesLeft(tx, institutionId, [v.programId])).get(v.programId) ?? 0) < 1) throw new ConflictError(`${choice.programName} has no places left.`);

    await chargeNames(tx, institutionId, [app.id], subscription);
    await transition(tx, app, "ACCEPTED", "institution", { actorUserId: user.id, note: `Provisionally offered ${choice.programName} (choice ${choice.rank}) after deliberation run ${hit.run.runNumber}, pending: ${v.conditions}` });
    const at = new Date();
    const year = at.getUTCFullYear();
    const admissionNumber = `ADM-${year}-${String(await nextCounter(tx, `admission-number:${year}`)).padStart(6, "0")}`;
    const deadline = new Date(`${v.deadline}T23:59:59+01:00`);
    const values = {
      institutionId,
      programId: v.programId,
      choice: choice.rank,
      status: "OFFERED" as const,
      type: "PROVISIONAL" as const,
      conditions: v.conditions,
      conditionsDeadline: deadline,
      conditionStatus: "PENDING" as const,
      conditionsDecidedAt: null,
      conditionsDecidedBy: null,
      conditionsNote: null,
      deliberationRunId: hit.run.id,
      deliberationResultId: hit.r.id,
      admissionNumber,
      offeredAt: at,
      admittedBy: user.id,
      respondedAt: null,
      letterFileId: null,
      letterIssuedAt: null,
    };
    const [row] = await tx
      .insert(admissions)
      .values({ id: newId("adm"), applicationInstitutionId: app.id, ...values })
      .onConflictDoUpdate({ target: admissions.applicationInstitutionId, set: values })
      .returning();
    await audit(tx, {
      action: "create",
      entityType: "admission",
      entityId: row.id,
      institutionId,
      after: { admissionNumber, type: "PROVISIONAL", programId: v.programId, choice: choice.rank, applicationInstitutionId: app.id, deliberationRunId: hit.run.id, conditions: v.conditions, deadline: v.deadline, status: "OFFERED" },
    });
    await notifyEvent(tx, {
      event: "admission.provisional_offer",
      to: { userId: app.application.applicantId },
      applicationId: app.id,
      values: { "admission.number": admissionNumber, "letter.url": `${env.APP_URL}/student/application/status`, conditions: v.conditions, deadline: letterDate(deadline.toISOString()) },
      inApp: { title: `Provisional offer from ${app.institution.name}`, summary: `${app.institution.name} has offered you a provisional place (${admissionNumber}) on ${choice.programName}. Conditions, by ${letterDate(deadline.toISOString())}: ${v.conditions}`, category: "ADMISSION" },
      important: true,
      action: { label: "Answer the offer", href: "/student/application/status" },
    });
    return row.id;
  });
  return { id };
}

/** A provisional admission of the caller's institution, still waiting on its conditions. */
async function pendingProvisional(tx: Executor, user: PublicUser, id: string) {
  const [row] = await tx
    .select({ a: admissions, applicantId: applications.applicantId, institution: institutions.name, program: programs.name })
    .from(admissions)
    .innerJoin(applicationInstitutions, eq(applicationInstitutions.id, admissions.applicationInstitutionId))
    .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
    .innerJoin(institutions, eq(institutions.id, applicationInstitutions.institutionId))
    .innerJoin(programs, eq(programs.id, admissions.programId))
    .where(and(eq(admissions.id, id), eq(applicationInstitutions.institutionId, institutionOf(user))))
    .for("update", { of: admissions })
    .limit(1);
  if (!row) throw new NotFoundError("Admission");
  if (row.a.type !== "PROVISIONAL" || row.a.conditionStatus !== "PENDING") throw new ConflictError("This admission isn't waiting on conditions.");
  if (row.a.status === "REJECTED") throw new ConflictError("The applicant declined this offer.");
  return row;
}

const noteSchema = z.object({ note: z.string().trim().max(1000).optional() });

/** The conditions are met: the admission becomes full, and a full admission letter will be issued in place of the provisional one. */
export async function confirmConditions(user: PublicUser, id: string, input: unknown) {
  const { note } = parseWith(noteSchema, input ?? {});
  const db = getDb();
  await assertAccess(db, user);
  await db.transaction(async (tx) => {
    await assertCanDeliberate(tx, institutionOf(user));
    const row = await pendingProvisional(tx, user, id);
    const now = new Date();
    // Clearing the letter makes the next opening issue a full one; the provisional letter's file is kept, attached to nothing.
    await tx.update(admissions).set({ type: "FULL", conditionStatus: "MET", conditionsDecidedAt: now, conditionsDecidedBy: user.id, conditionsNote: note ?? null, letterFileId: null, letterIssuedAt: null }).where(eq(admissions.id, id));
    await audit(tx, {
      action: "confirm-conditions",
      entityType: "admission",
      entityId: id,
      institutionId: row.a.institutionId,
      before: { type: "PROVISIONAL", conditionStatus: "PENDING", letterFileId: row.a.letterFileId },
      after: { type: "FULL", conditionStatus: "MET" },
      meta: note ? { note } : undefined,
    });
    await notifyEvent(tx, {
      event: "admission.conditions_met",
      to: { userId: row.applicantId },
      applicationId: row.a.applicationInstitutionId,
      values: { "admission.number": row.a.admissionNumber ?? "", "letter.url": `${env.APP_URL}/student/application/status` },
      inApp: { title: `Admission confirmed by ${row.institution}`, summary: `The conditions of your provisional admission are met: your admission to ${row.program} (${row.a.admissionNumber}) is now full. Download your new admission letter from your application.`, category: "ADMISSION" },
      important: true,
      action: { label: "View your admission", href: "/student/application/status" },
    });
  });
  return { id };
}

const withdrawSchema = z.object({ note: z.string({ error: "Say why the offer is withdrawn." }).trim().min(3, "Say why the offer is withdrawn.").max(1000) });

/** The conditions weren't met: the offer is withdrawn, its place freed, and the application closed as not admitted. */
export async function withdrawProvisional(user: PublicUser, id: string, input: unknown) {
  const { note } = parseWith(withdrawSchema, input);
  const db = getDb();
  await assertAccess(db, user);
  await db.transaction(async (tx) => {
    await assertCanDeliberate(tx, institutionOf(user));
    const row = await pendingProvisional(tx, user, id);
    const now = new Date();
    await tx.update(admissions).set({ status: "WITHDRAWN", conditionStatus: "NOT_MET", conditionsDecidedAt: now, conditionsDecidedBy: user.id, conditionsNote: note }).where(eq(admissions.id, id));
    await audit(tx, {
      action: "withdraw",
      entityType: "admission",
      entityId: id,
      institutionId: row.a.institutionId,
      before: { status: row.a.status, conditionStatus: "PENDING" },
      after: { status: "WITHDRAWN", conditionStatus: "NOT_MET" },
      meta: { note },
    });
    const app = await loadApplicationInstitution(tx, row.a.applicationInstitutionId);
    if (app.status === "ACCEPTED" || app.status === "A_ACKNOWLEDGED") {
      await transition(tx, app, "I_REJECTED", "system", { actorUserId: user.id, note: `Provisional admission ${row.a.admissionNumber} withdrawn: conditions not met. ${note}` });
    }
    await notifyEvent(tx, {
      event: "admission.withdrawn",
      to: { userId: row.applicantId },
      applicationId: row.a.applicationInstitutionId,
      values: { "admission.number": row.a.admissionNumber ?? "", conditions: row.a.conditions ?? "", reason: note },
      inApp: { title: "Provisional admission withdrawn", summary: `${row.institution} has withdrawn your provisional admission to ${row.program} (${row.a.admissionNumber}): the conditions were not met. ${note}`, category: "ADMISSION" },
      important: true,
      action: { label: "View application", href: "/student/application/status" },
    });
  });
  return { id };
}
