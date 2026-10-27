import "server-only";
import { and, count, desc, eq, gt, inArray, isNull, lte, sql, sum } from "drizzle-orm";
import { z } from "zod";
import type { PublicUser } from "@/lib/auth/users";
import { getDb, type Executor } from "@/server/db/client";
import { applicationInstitutions, applications, deliberationNameCharges, deliberationSubscriptions, institutions, programChoices, programs, users } from "@/server/db/schema";
import { newId } from "@/server/db/ids";
import { audit } from "@/server/audit/audit";
import { hasPermission } from "@/server/auth/access";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/http/errors";
import { parseWith } from "@/server/http/validate";
import { notify } from "@/server/notifications/notifications.service";
import { getSettings } from "@/server/modules/settings/settings.service";

/**
 * Deliberation as a paid service.
 *
 * - Every institution sees its Deliberation List, free: the applicants it
 *   has acknowledged and not yet decided on.
 * - Rejecting an application is always allowed.
 * - Admitting applicants through the platform is "deliberating", and needs
 *   an active subscription: an annual fee, plus a fee for each applicant
 *   name on the list while the subscription runs.
 * - Nothing here decides anything by itself. People do.
 *
 * The two prices are platform settings the administrator sets under
 * Payment configuration. Until both are set, nobody can subscribe.
 */

/** The status an application has while it is waiting on the institution's deliberation. */
const ON_LIST = "I_ACKNOWLEDGED";
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

type Subscription = typeof deliberationSubscriptions.$inferSelect;

export interface DeliberationFees {
  subscriptionFee: number | null;
  perNameFee: number | null;
  /** Both prices have been set, so institutions can subscribe. */
  set: boolean;
}

export async function getDeliberationFees(db: Executor = getDb()): Promise<DeliberationFees> {
  const s = await getSettings("payment", db);
  const subscriptionFee = s.deliberationSubscriptionFee ?? null;
  const perNameFee = s.deliberationPerNameFee ?? null;
  return { subscriptionFee, perNameFee, set: subscriptionFee !== null && perNameFee !== null };
}

function institutionOf(user: PublicUser): string {
  if (!user.institutionId) throw new ForbiddenError("This account isn't linked to an institution.");
  return user.institutionId;
}

/** The subscription that lets the institution deliberate right now, if it has one. */
export async function activeSubscription(db: Executor, institutionId: string): Promise<Subscription | undefined> {
  const now = new Date();
  const [row] = await db
    .select()
    .from(deliberationSubscriptions)
    .where(and(eq(deliberationSubscriptions.institutionId, institutionId), eq(deliberationSubscriptions.status, "ACTIVE"), lte(deliberationSubscriptions.startsAt, now), gt(deliberationSubscriptions.endsAt, now)))
    .orderBy(desc(deliberationSubscriptions.endsAt))
    .limit(1);
  return row;
}

/**
 * Refuses unless the institution may deliberate. Called before an
 * institution admits an applicant; rejecting never comes through here.
 */
export async function assertCanDeliberate(db: Executor, institutionId: string): Promise<Subscription> {
  const subscription = await activeSubscription(db, institutionId);
  if (!subscription) {
    throw new ForbiddenError("Admitting applicants is part of deliberation, which needs an active deliberation subscription. You can still reject applications without one.");
  }
  return subscription;
}

/**
 * Records the per-name charge for applicants on the institution's list,
 * if it has an active subscription. Each applicant is charged once per
 * subscription, so calling this again for the same name does nothing.
 */
export async function chargeNames(db: Executor, institutionId: string, applicationInstitutionIds: string[], subscription?: Subscription) {
  if (!applicationInstitutionIds.length) return;
  const sub = subscription ?? (await activeSubscription(db, institutionId));
  if (!sub) return;
  await db
    .insert(deliberationNameCharges)
    .values(applicationInstitutionIds.map((applicationInstitutionId) => ({ id: newId("dnc"), subscriptionId: sub.id, institutionId, applicationInstitutionId, fee: sub.perNameFee })))
    .onConflictDoNothing();
}

/** Starts the subscription's year and charges for every name already on the list. */
async function activate(tx: Executor, subscription: Subscription, decidedBy: string, note: string): Promise<Subscription> {
  const startsAt = new Date();
  const [active] = await tx
    .update(deliberationSubscriptions)
    .set({ status: "ACTIVE", startsAt, endsAt: new Date(startsAt.getTime() + YEAR_MS), decidedBy, decidedAt: startsAt, decisionNote: note, updatedAt: startsAt })
    .where(eq(deliberationSubscriptions.id, subscription.id))
    .returning();
  const listed = await tx
    .select({ id: applicationInstitutions.id })
    .from(applicationInstitutions)
    .where(and(eq(applicationInstitutions.institutionId, subscription.institutionId), eq(applicationInstitutions.status, ON_LIST)));
  await chargeNames(tx, subscription.institutionId, listed.map((l) => l.id), active);
  return active;
}

async function chargeSummary(db: Executor, where: ReturnType<typeof eq>) {
  const [row] = await db
    .select({
      names: count(),
      amount: sum(deliberationNameCharges.fee),
      unpaid: sql<string | null>`sum(case when ${deliberationNameCharges.paidAt} is null then ${deliberationNameCharges.fee} else 0 end)`,
    })
    .from(deliberationNameCharges)
    .where(where);
  return { names: row.names, amount: Number(row.amount ?? 0), unpaid: Number(row.unpaid ?? 0) };
}

function present(s: Subscription) {
  const now = Date.now();
  const running = s.status === "ACTIVE" && !!s.startsAt && !!s.endsAt && s.startsAt.getTime() <= now && s.endsAt.getTime() > now;
  return {
    id: s.id,
    institutionId: s.institutionId,
    /** ACTIVE subscriptions whose year has ended are reported as EXPIRED. */
    status: s.status === "ACTIVE" && !running ? ("EXPIRED" as const) : s.status,
    subscriptionFee: s.subscriptionFee,
    perNameFee: s.perNameFee,
    paymentReference: s.paymentReference,
    note: s.note,
    decisionNote: s.decisionNote,
    requestedAt: s.createdAt.toISOString(),
    decidedAt: s.decidedAt?.toISOString() ?? null,
    startsAt: s.startsAt?.toISOString() ?? null,
    endsAt: s.endsAt?.toISOString() ?? null,
  };
}

// ---------------------------------------------------------------------------
// Institution portal
// ---------------------------------------------------------------------------

/** Where the institution stands: the prices, its subscription, whether it may deliberate, and what it has been charged. */
export async function getDeliberationOverview(user: PublicUser) {
  const institutionId = institutionOf(user);
  const db = getDb();
  if (!(await hasPermission(db, user, "DELIBERATION"))) throw new ForbiddenError("Your staff account doesn't have access to the deliberation list.");
  const [fees, active, [latest], [{ listed }]] = await Promise.all([
    getDeliberationFees(db),
    activeSubscription(db, institutionId),
    db.select().from(deliberationSubscriptions).where(eq(deliberationSubscriptions.institutionId, institutionId)).orderBy(desc(deliberationSubscriptions.createdAt)).limit(1),
    db.select({ listed: count() }).from(applicationInstitutions).where(and(eq(applicationInstitutions.institutionId, institutionId), eq(applicationInstitutions.status, ON_LIST))),
  ]);
  const subscription = active ?? latest;
  return {
    fees,
    canDeliberate: !!active,
    /** The active subscription, or else the most recent request (pending, rejected or expired). */
    subscription: subscription ? present(subscription) : null,
    canRequest: user.role === "INSTITUTION_ADMIN" && fees.set && !active && latest?.status !== "PENDING",
    namesOnList: listed,
    charges: subscription ? await chargeSummary(db, eq(deliberationNameCharges.subscriptionId, subscription.id)) : { names: 0, amount: 0, unpaid: 0 },
  };
}

/**
 * The Deliberation List: this institution's acknowledged applicants
 * awaiting a decision, with the programs each chose. Every institution
 * gets it, subscribed or not.
 */
export async function getDeliberationList(user: PublicUser) {
  const institutionId = institutionOf(user);
  const db = getDb();
  if (!(await hasPermission(db, user, "DELIBERATION"))) throw new ForbiddenError("Your staff account doesn't have access to the deliberation list.");

  const rows = await db
    .select({ id: applicationInstitutions.id, reference: applicationInstitutions.reference, applicantName: users.fullName, acknowledgedAt: applicationInstitutions.updatedAt })
    .from(applicationInstitutions)
    .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
    .innerJoin(users, eq(users.id, applications.applicantId))
    .where(and(eq(applicationInstitutions.institutionId, institutionId), eq(applicationInstitutions.status, ON_LIST)))
    .orderBy(applicationInstitutions.updatedAt);
  const choices = rows.length
    ? await db
        .select({ applicationInstitutionId: programChoices.applicationInstitutionId, rank: programChoices.rank, programId: programChoices.programId, programName: programs.name })
        .from(programChoices)
        .innerJoin(programs, eq(programs.id, programChoices.programId))
        .where(inArray(programChoices.applicationInstitutionId, rows.map((r) => r.id)))
        .orderBy(programChoices.rank)
    : [];
  return rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    applicantName: r.applicantName,
    acknowledgedAt: r.acknowledgedAt.toISOString(),
    choices: choices.filter((c) => c.applicationInstitutionId === r.id).map((c) => ({ rank: c.rank, programId: c.programId, programName: c.programName })),
  }));
}

const requestSchema = z.object({
  paymentReference: z.string().trim().max(120).default(""),
  note: z.string().trim().max(500).default(""),
});

/** An institution administrator asks to subscribe. It starts once the Cheeta administrator confirms the annual fee was paid. */
export async function requestSubscription(user: PublicUser, input: unknown) {
  const institutionId = institutionOf(user);
  if (user.role !== "INSTITUTION_ADMIN") throw new ForbiddenError("Only an institution administrator can subscribe to deliberation.");
  const v = parseWith(requestSchema, input ?? {});

  return getDb().transaction(async (tx) => {
    const fees = await getDeliberationFees(tx);
    if (fees.subscriptionFee === null || fees.perNameFee === null) throw new ConflictError("Deliberation fees haven't been set yet, so subscriptions aren't open. Please check back later.");
    if (await activeSubscription(tx, institutionId)) throw new ConflictError("Your institution already has an active deliberation subscription.");
    const [pending] = await tx
      .select({ id: deliberationSubscriptions.id })
      .from(deliberationSubscriptions)
      .where(and(eq(deliberationSubscriptions.institutionId, institutionId), eq(deliberationSubscriptions.status, "PENDING")))
      .limit(1);
    if (pending) throw new ConflictError("A subscription request is already waiting for approval.");
    if (fees.subscriptionFee > 0 && !v.paymentReference) throw new ValidationError({ paymentReference: "Enter the reference of your payment for the annual fee." });

    const [created] = await tx
      .insert(deliberationSubscriptions)
      .values({ id: newId("dsub"), institutionId, subscriptionFee: fees.subscriptionFee, perNameFee: fees.perNameFee, paymentReference: v.paymentReference, note: v.note, requestedBy: user.id })
      .returning();
    await audit(tx, { action: "create", entityType: "deliberation-subscription", entityId: created.id, institutionId, before: null, after: created });

    // Nothing to pay for the year: there is nothing for the administrator to confirm.
    if (fees.subscriptionFee === 0) return present(await activate(tx, created, user.id, "No annual fee to pay."));

    const [inst] = await tx.select({ name: institutions.name }).from(institutions).where(eq(institutions.id, institutionId)).limit(1);
    await notify(tx, {
      audience: "admin",
      category: "PAYMENT",
      title: `Deliberation subscription to approve: ${inst?.name ?? institutionId}`,
      summary: `Annual fee ${fees.subscriptionFee} XAF, payment reference ${v.paymentReference}.`,
      action: { label: "Review", href: "/admin/payment-config" },
    });
    return present(created);
  });
}

// ---------------------------------------------------------------------------
// Administration portal
// ---------------------------------------------------------------------------

export async function listSubscriptions() {
  const db = getDb();
  const rows = await db
    .select({ s: deliberationSubscriptions, institutionName: institutions.name })
    .from(deliberationSubscriptions)
    .innerJoin(institutions, eq(institutions.id, deliberationSubscriptions.institutionId))
    .orderBy(desc(deliberationSubscriptions.createdAt));
  const totals = rows.length
    ? await db
        .select({
          subscriptionId: deliberationNameCharges.subscriptionId,
          names: count(),
          amount: sum(deliberationNameCharges.fee),
          unpaid: sql<string | null>`sum(case when ${deliberationNameCharges.paidAt} is null then ${deliberationNameCharges.fee} else 0 end)`,
        })
        .from(deliberationNameCharges)
        .groupBy(deliberationNameCharges.subscriptionId)
    : [];
  return rows.map(({ s, institutionName }) => {
    const t = totals.find((x) => x.subscriptionId === s.id);
    return { ...present(s), institutionName, charges: { names: t?.names ?? 0, amount: Number(t?.amount ?? 0), unpaid: Number(t?.unpaid ?? 0) } };
  });
}

const decisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve"), note: z.string().trim().max(500).default("") }),
  z.object({ decision: z.literal("reject"), note: z.string().trim().min(1, "Say why the request is rejected.").max(500) }),
]);

/** The administrator confirms the annual fee was paid (the year starts now) or turns the request down. */
export async function decideSubscription(user: PublicUser, id: string, input: unknown) {
  const v = parseWith(decisionSchema, input);
  return getDb().transaction(async (tx) => {
    const [existing] = await tx.select().from(deliberationSubscriptions).where(eq(deliberationSubscriptions.id, id)).limit(1);
    if (!existing) throw new NotFoundError("Deliberation subscription");
    if (existing.status !== "PENDING") throw new ConflictError("This request has already been decided.");

    const now = new Date();
    const updated =
      v.decision === "approve"
        ? await activate(tx, existing, user.id, v.note)
        : (await tx.update(deliberationSubscriptions).set({ status: "REJECTED", decidedBy: user.id, decidedAt: now, decisionNote: v.note, updatedAt: now }).where(eq(deliberationSubscriptions.id, id)).returning())[0];

    await audit(tx, { action: v.decision, entityType: "deliberation-subscription", entityId: id, institutionId: existing.institutionId, before: existing, after: updated });
    await notify(tx, {
      audience: "institution",
      institutionId: existing.institutionId,
      category: "PAYMENT",
      title: v.decision === "approve" ? "Deliberation subscription active" : "Deliberation subscription request rejected",
      summary: v.decision === "approve" ? "Your institution can now deliberate for the next 12 months." : v.note,
      important: v.decision === "reject",
      action: { label: "Open deliberation", href: "/institution/deliberations" },
    });
    return present(updated);
  });
}

const grantSchema = z.object({ institutionId: z.string().trim().min(1, "Choose an institution."), note: z.string().trim().max(500).default("") });

/** The administrator starts a subscription for an institution directly, for payments handled outside the platform. */
export async function grantSubscription(user: PublicUser, input: unknown) {
  const v = parseWith(grantSchema, input);
  return getDb().transaction(async (tx) => {
    const fees = await getDeliberationFees(tx);
    if (fees.subscriptionFee === null || fees.perNameFee === null) throw new ConflictError("Set the deliberation fees first.");
    const [inst] = await tx.select({ id: institutions.id }).from(institutions).where(eq(institutions.id, v.institutionId)).limit(1);
    if (!inst) throw new ValidationError({ institutionId: "Choose an institution from the list." });
    if (await activeSubscription(tx, v.institutionId)) throw new ConflictError("This institution already has an active deliberation subscription.");

    // A request that was waiting is the one that gets activated, rather than leaving it pending beside a new one.
    const [pending] = await tx
      .select()
      .from(deliberationSubscriptions)
      .where(and(eq(deliberationSubscriptions.institutionId, v.institutionId), eq(deliberationSubscriptions.status, "PENDING")))
      .limit(1);
    const base =
      pending ??
      (await tx.insert(deliberationSubscriptions).values({ id: newId("dsub"), institutionId: v.institutionId, subscriptionFee: fees.subscriptionFee, perNameFee: fees.perNameFee, requestedBy: user.id }).returning())[0];
    const active = await activate(tx, base, user.id, v.note || "Started by the administrator.");
    await audit(tx, { action: "grant", entityType: "deliberation-subscription", entityId: active.id, institutionId: v.institutionId, before: pending ?? null, after: active });
    return present(active);
  });
}

/** Records that the institution has paid the per-name charges raised so far on a subscription. */
export async function settleCharges(user: PublicUser, id: string) {
  return getDb().transaction(async (tx) => {
    const [existing] = await tx.select().from(deliberationSubscriptions).where(eq(deliberationSubscriptions.id, id)).limit(1);
    if (!existing) throw new NotFoundError("Deliberation subscription");
    const settled = await tx
      .update(deliberationNameCharges)
      .set({ paidAt: new Date() })
      .where(and(eq(deliberationNameCharges.subscriptionId, id), isNull(deliberationNameCharges.paidAt)))
      .returning({ fee: deliberationNameCharges.fee });
    const amount = settled.reduce((total, c) => total + c.fee, 0);
    await audit(tx, { action: "settle", entityType: "deliberation-subscription", entityId: id, institutionId: existing.institutionId, meta: { names: settled.length, amount } });
    return { names: settled.length, amount };
  });
}
