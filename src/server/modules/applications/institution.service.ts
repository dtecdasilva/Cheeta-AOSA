import "server-only";
import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { AWAITING_REVIEW_STATUSES, EDITABLE_STATUSES, FINAL_STATUSES } from "@/lib/applications/statusFlow";
import { BASE_CURRENCY } from "@/lib/admin/reference";
import { ADMIN_STATUS_LABELS, ALL_STATUSES } from "@/lib/admin/status";
import type { PermissionKey } from "@/lib/auth/permissions";
import type { PublicUser } from "@/lib/auth/users";
import { maskAccountName, normalizeBankCode } from "@/lib/payments/privacy";
import type { ApplicationStatus } from "@/lib/types";
import { getDb, type Executor } from "@/server/db/client";
import { applicationComments, applicationDocuments, applicationInstitutions, applications, applicationStatusEvents, demographicProfiles, educationRecords, examinationResults, feePayments, parameters, programChoices, programs, users } from "@/server/db/schema";
import { newId } from "@/server/db/ids";
import { audit } from "@/server/audit/audit";
import { hasPermission } from "@/server/auth/access";
import { chargeNames } from "@/server/modules/deliberation/deliberation.service";
import { photoOf } from "@/server/modules/student/photo.service";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/http/errors";
import { pagination, parseQuery, parseWith } from "@/server/http/validate";
import { notify } from "@/server/notifications/notifications.service";
import { notifyEvent } from "@/server/notifications/engine";
import { mediaFor } from "@/server/modules/student/disability.service";
import { fileUrl, getFile } from "@/server/storage/files.service";
import { loadApplicationInstitution, type LoadedApplication } from "./applications.queries";
import { movesFor, transition } from "./applications.workflow";
import { getExamConfigurationData, loadExaminations } from "@/server/modules/student/examinations.service";

/**
 * The institution's side of applications, scoped to the caller's
 * institution. Applies the payment privacy rules (src/lib/payments/privacy.ts)
 * server-side, where they can't be bypassed:
 *
 * - the platform web fee is never included;
 * - until AOSA approves the fee, the applicant shows only as
 *   "<first name> <initial>." with no contact details, documents or program;
 * - after approval the payment is identified by its bank code.
 */

function institutionOf(user: PublicUser): string {
  if (!user.institutionId) throw new ForbiddenError("This account isn't linked to an institution.");
  return user.institutionId;
}

/** Institution admins hold every staff permission through their role; admission users need it granted to them. */
async function assertPermission(db: Executor, user: PublicUser, permission: PermissionKey) {
  if (!(await hasPermission(db, user, permission))) throw new ForbiddenError("Your staff account doesn't have permission for this.");
}

// ---------------------------------------------------------------------------
// Reviewing applications
// ---------------------------------------------------------------------------

/**
 * What a staff member may do, from their role and the permissions their
 * institution administrator has granted them. Sent with each application
 * so screens only offer what the server will accept; every action checks
 * again on the server.
 */
async function abilitiesOf(db: Executor, user: PublicUser) {
  const [review, paymentsUploads, acknowledge, reject, deliberation] = await Promise.all([
    hasPermission(db, user, "review"),
    hasPermission(db, user, "PAYMENTS_UPLOADS"),
    hasPermission(db, user, "ACKNOWLEDGED_APPS"),
    hasPermission(db, user, "REJECTED_APPS"),
    hasPermission(db, user, "DELIBERATION"),
  ]);
  return { review, verifyPayment: paymentsUploads, verifyUploads: paymentsUploads, acknowledge, reject, deliberation, comment: review };
}

type Abilities = Awaited<ReturnType<typeof abilitiesOf>>;

/**
 * Which applications a staff member may see, by status. Anyone who
 * reviews sees applications being prepared and those awaiting review.
 * Acknowledged ones need "Acknowledged Applications", rejected ones
 * "Rejected Applications", and those past deliberation (an offer made,
 * taken up or declined) "Deliberation List". An institution administrator
 * holds all three.
 */
const STATUS_PERMISSION: Partial<Record<ApplicationStatus, keyof Pick<Abilities, "acknowledge" | "reject" | "deliberation">>> = {
  I_ACKNOWLEDGED: "acknowledge",
  I_REJECTED: "reject",
  ACCEPTED: "deliberation",
  A_ACKNOWLEDGED: "deliberation",
  A_REJECTED: "deliberation",
};

const NEEDS: Record<"acknowledge" | "reject" | "deliberation", string> = {
  acknowledge: "Acknowledged Applications",
  reject: "Rejected Applications",
  deliberation: "Deliberation List",
};

function visibleStatuses(abilities: Abilities): ApplicationStatus[] {
  return (ALL_STATUSES as ApplicationStatus[]).filter((s) => {
    const needs = STATUS_PERMISSION[s];
    return !needs || abilities[needs];
  });
}

/** Refuses an application in a status the staff member's permissions don't cover, naming the permission. */
function assertCanSee(abilities: Abilities, status: string) {
  const needs = STATUS_PERMISSION[status as ApplicationStatus];
  if (needs && !abilities[needs]) throw new ForbiddenError(`Seeing ${status === "I_REJECTED" ? "rejected" : status === "I_ACKNOWLEDGED" ? "acknowledged" : "decided"} applications needs the "${NEEDS[needs]}" permission.`);
}

const listQuery = pagination.extend({
  status: z.enum(ALL_STATUSES as [ApplicationStatus, ...ApplicationStatus[]]).optional(),
  /** Applicant name or email (only for applicants whose fee is approved). */
  q: z.string().trim().max(100).optional(),
  /** Application ID, working reference or bank code. */
  reference: z.string().trim().max(60).optional(),
  /** Submitted on or after / on or before (YYYY-MM-DD). */
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

/**
 * Applications to the caller's institution, newest activity first:
 * ?status=, ?q=, ?reference=, ?from=, ?to=. Nothing of any other
 * institution's is ever included. Applicants whose fee isn't approved yet
 * show only as a masked name, and can't be found by searching for them.
 */
export async function listForInstitution(user: PublicUser, req: NextRequest) {
  const institutionId = institutionOf(user);
  const query = parseQuery(req, listQuery);
  const db = getDb();
  await assertPermission(db, user, "review");

  // At most one approved payment per application (enforced when payments are recorded and approved).
  const approved = db.$with("approved").as(
    db.select({ applicationInstitutionId: feePayments.applicationInstitutionId, bankCode: feePayments.bankCode, applicationFee: feePayments.applicationFee }).from(feePayments).where(eq(feePayments.approval, "APPROVED"))
  );

  const escape = (v: string) => `%${v.replace(/[%_\\]/g, "\\$&")}%`;
  const abilities = await abilitiesOf(db, user);
  if (query.status) assertCanSee(abilities, query.status);
  // Only the statuses this staff member's permissions cover, for the rows and for the counts alike.
  const scope = and(eq(applicationInstitutions.institutionId, institutionId), inArray(applicationInstitutions.status, visibleStatuses(abilities)));
  const conditions: (SQL | undefined)[] = [scope];
  if (query.status) conditions.push(eq(applicationInstitutions.status, query.status));
  // Names only match once the fee is approved, so a search can't reveal a masked applicant.
  if (query.q) conditions.push(and(isNotNull(approved.bankCode), or(ilike(users.fullName, escape(query.q)), ilike(users.email, escape(query.q)))));
  if (query.reference) conditions.push(or(ilike(applicationInstitutions.reference, escape(query.reference)), ilike(applicationInstitutions.applicationNumber, escape(query.reference)), ilike(approved.bankCode, escape(query.reference))));
  if (query.from) conditions.push(gte(applicationInstitutions.submittedAt, new Date(`${query.from}T00:00:00Z`)));
  if (query.to) conditions.push(lte(applicationInstitutions.submittedAt, new Date(`${query.to}T23:59:59.999Z`)));
  const where = and(...conditions);

  const [rows, [{ total }], byStatus] = await Promise.all([
    db
      .with(approved)
      .select({
        id: applicationInstitutions.id,
        reference: applicationInstitutions.reference,
        applicationNumber: applicationInstitutions.applicationNumber,
        status: applicationInstitutions.status,
        submittedAt: applicationInstitutions.submittedAt,
        updatedAt: applicationInstitutions.updatedAt,
        paymentVerification: applicationInstitutions.paymentVerification,
        fullName: users.fullName,
        email: users.email,
        bankCode: approved.bankCode,
        applicationFee: approved.applicationFee,
      })
      .from(applicationInstitutions)
      .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
      .innerJoin(users, eq(users.id, applications.applicantId))
      .leftJoin(approved, eq(approved.applicationInstitutionId, applicationInstitutions.id))
      .where(where)
      .orderBy(desc(applicationInstitutions.updatedAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db
      .with(approved)
      .select({ total: count() })
      .from(applicationInstitutions)
      .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
      .innerJoin(users, eq(users.id, applications.applicantId))
      .leftJoin(approved, eq(approved.applicationInstitutionId, applicationInstitutions.id))
      .where(where),
    db.select({ status: applicationInstitutions.status, n: count() }).from(applicationInstitutions).where(scope).groupBy(applicationInstitutions.status),
  ]);

  const paidIds = rows.filter((r) => r.bankCode).map((r) => r.id);
  const [programOf, docRows] = await Promise.all([
    firstChoicePrograms(db, paidIds),
    paidIds.length
      ? db
          .select({ applicationInstitutionId: applicationDocuments.applicationInstitutionId, reviewStatus: applicationDocuments.reviewStatus, n: count() })
          .from(applicationDocuments)
          .where(inArray(applicationDocuments.applicationInstitutionId, paidIds))
          .groupBy(applicationDocuments.applicationInstitutionId, applicationDocuments.reviewStatus)
      : [],
  ]);
  const docsOf = (id: string, state: string) => Number(docRows.find((d) => d.applicationInstitutionId === id && d.reviewStatus === state)?.n ?? 0);

  const data = rows.map((r) => {
    const paid = !!r.bankCode;
    const submitted = !EDITABLE_STATUSES.includes(r.status as ApplicationStatus);
    if (!paid) {
      return { id: r.id, reference: r.reference, applicationNumber: r.applicationNumber, status: r.status, submittedAt: r.submittedAt, updatedAt: r.updatedAt, masked: true, applicant: `${maskAccountName(r.fullName, r.email)} — awaiting payment` };
    }
    return {
      id: r.id,
      reference: r.reference,
      applicationNumber: r.applicationNumber,
      status: r.status,
      submittedAt: r.submittedAt,
      updatedAt: r.updatedAt,
      masked: false,
      applicant: r.fullName,
      email: r.email,
      // Fee and payment details are for staff with "Student Payments & Uploads".
      bankCode: abilities.verifyPayment ? r.bankCode : null,
      applicationFee: abilities.verifyPayment ? r.applicationFee : null,
      programName: programOf.get(r.id) ?? null,
      paymentVerification: r.paymentVerification,
      // Documents only count once the application has been submitted: before that they aren't the institution's to review.
      documents: submitted ? { pending: docsOf(r.id, "PENDING"), approved: docsOf(r.id, "APPROVED"), rejected: docsOf(r.id, "REJECTED") } : null,
    };
  });
  return { data, meta: { page: query.page, pageSize: query.pageSize, total }, counts: Object.fromEntries(byStatus.map((b) => [b.status, Number(b.n)])) };
}

async function loadForInstitution(db: Executor, user: PublicUser, id: string) {
  const app = await loadApplicationInstitution(db, id);
  // Another institution's application doesn't exist as far as this caller is concerned.
  if (app.institutionId !== institutionOf(user)) throw new NotFoundError("Application");
  return app;
}

/** What still stands between this application and being acknowledged, or null if nothing does. */
function acknowledgeBlocker(app: LoadedApplication): string | null {
  if (!movesFor(app.status, "institution").includes("I_ACKNOWLEDGED")) return `An application that is "${ADMIN_STATUS_LABELS[app.status as ApplicationStatus]}" can't be acknowledged.`;
  if (app.paymentVerification !== "VERIFIED") return "Verify the payment first: confirm the application fee reached your account.";
  const unreviewed = app.requirements.filter((r) => r.required && !app.documents.some((d) => d.requirementId === r.id && d.reviewStatus === "APPROVED"));
  if (unreviewed.length) return `Verify the uploads first. Not yet approved: ${unreviewed.map((r) => r.name).join(", ")}.`;
  return null;
}

/**
 * One application, as the caller's institution may see it.
 *
 * Until Cheeta administration approves the fee: a masked name and the
 * status, nothing else. After that: the applicant, their program choices
 * and the payment as the institution may know it (never the web fee).
 * Once submitted: everything the applicant sent (demographic information,
 * education, examinations and results, documents), the comments, and
 * what the caller may do next.
 */
export async function getForInstitution(user: PublicUser, id: string) {
  const db = getDb();
  await assertPermission(db, user, "review");
  const app = await loadForInstitution(db, user, id);
  const approved = app.payments.find((p) => p.approval === "APPROVED");
  const submitted = !EDITABLE_STATUSES.includes(app.status as ApplicationStatus);
  const [applicant] = await db.select({ id: users.id, fullName: users.fullName, email: users.email, phone: users.phone }).from(users).where(eq(users.id, app.application.applicantId)).limit(1);

  // Who did what, by name: reviewers of documents, the payment check, status changes and comments.
  const actorIds = [...new Set([...app.events.map((e) => e.actorUserId), ...app.documents.map((d) => d.reviewedBy), app.paymentVerifiedBy].filter((x): x is string => !!x))];
  const [actors, reasons] = await Promise.all([
    actorIds.length ? db.select({ id: users.id, name: users.fullName, role: users.role }).from(users).where(inArray(users.id, actorIds)) : [],
    db.select({ id: parameters.id, label: parameters.label }).from(parameters).where(inArray(parameters.id, app.events.map((e) => e.reasonId).filter((x): x is string => !!x).concat(["-"]))),
  ]);
  const nameOf = (userId: string | null) => {
    const a = actors.find((x) => x.id === userId);
    // The applicant appears by name only once the institution may see it; Cheeta administration as itself.
    if (!a) return null;
    if (a.role === "AOSA_ADMIN") return "Cheeta administration";
    if (a.role === "STUDENT") return approved ? a.name : "Applicant";
    return a.name;
  };

  const base = {
    id: app.id,
    reference: app.reference,
    applicationNumber: app.applicationNumber,
    status: app.status,
    submittedAt: app.submittedAt,
    decidedAt: app.decidedAt,
    history: app.events.map((e) => ({ status: e.status, actor: e.actor, by: nameOf(e.actorUserId), note: e.note, reason: reasons.find((r) => r.id === e.reasonId)?.label ?? null, at: e.at })),
  };
  const abilities = await abilitiesOf(db, user);
  assertCanSee(abilities, app.status);
  if (!approved) {
    return { ...base, masked: true as const, applicant: { displayName: `${maskAccountName(applicant.fullName, applicant.email)} — awaiting payment` } };
  }

  const [demographic, education, examinations, results, examConfig] = submitted
    ? await Promise.all([
        db.select().from(demographicProfiles).where(eq(demographicProfiles.userId, applicant.id)).limit(1),
        db.select().from(educationRecords).where(eq(educationRecords.userId, applicant.id)).orderBy(asc(educationRecords.startYear)),
        loadExaminations(db, applicant.id),
        db.select().from(examinationResults).where(eq(examinationResults.userId, applicant.id)).orderBy(asc(examinationResults.subject)),
        getExamConfigurationData(db),
      ])
    : [[], [], [], [], null];
  const documents = submitted
    ? await Promise.all(
        app.documents.map(async (d) => {
          const file = await getFile(db, d.fileId).catch(() => null);
          const requirement = app.requirements.find((r) => r.id === d.requirementId);
          return {
            id: d.id,
            requirementId: d.requirementId,
            requirementName: d.requirementName,
            documentTypeId: d.documentTypeId,
            required: requirement?.required ?? false,
            reviewStatus: d.reviewStatus,
            rejectionReason: d.rejectionReason,
            reviewedBy: nameOf(d.reviewedBy),
            reviewedAt: d.reviewedAt,
            uploadedAt: d.createdAt,
            // Opening a document needs "Student Payments & Uploads" (the file route checks the same).
            file: file && abilities.verifyUploads ? { name: file.originalName, size: file.sizeBytes, mimeType: file.mimeType, url: fileUrl(file) } : null,
          };
        })
      )
    : [];
  const typeLabel = (id: string) => examConfig?.types.find((t) => t.id === id)?.qualification ?? id;
  const resultTypeLabel = (id: string | null) => (id ? examConfig?.resultTypes.find((t) => t.id === id)?.label ?? null : null);
  const blocker = submitted ? acknowledgeBlocker(app) : "The application hasn't been submitted yet.";
  const awaitingReview = AWAITING_REVIEW_STATUSES.includes(app.status as ApplicationStatus);

  return {
    ...base,
    masked: false as const,
    applicant: { displayName: applicant.fullName, email: applicant.email, phone: applicant.phone },
    // The payment as the institution may know it: its own fee and what identifies the money in its account. Never the web fee.
    payment: abilities.verifyPayment ? {
      bankCode: approved.bankCode,
      applicationFee: approved.applicationFee,
      currency: approved.currency,
      reference: approved.reference,
      paidAt: approved.paidAt,
      paidFrom: approved.paidFrom,
      account: approved.paymentAccount ? { label: approved.paymentAccount.label, provider: approved.paymentAccount.provider, accountNumber: approved.paymentAccount.accountNumber } : null,
      approvedAt: approved.reviewedAt,
      verification: { status: app.paymentVerification, note: app.paymentVerificationNote, by: nameOf(app.paymentVerifiedBy), at: app.paymentVerifiedAt },
    } : null,
    // Without "Student Payments & Uploads" a reviewer still sees whether the payment has been checked, not its details.
    paymentVerification: app.paymentVerification,
    choices: app.choices,
    submitted,
    declaration: app.declarationAcceptedAt ? { acceptedAt: app.declarationAcceptedAt, version: app.declarationVersion } : null,
    demographic: demographic[0] ?? null,
    // Photos and a video the applicant added to help assess accommodation (only when they answered Yes).
    disabilityMedia: demographic[0]?.disability === "Yes" ? await mediaFor(db, applicant.id) : [],
    // Shown where the rest of the record is: the file itself opens only for staff the applicant has submitted to.
    photo: demographic[0] ? await photoOf(db, applicant.id) : null,
    education,
    examinations: examinations.map((e) => ({
      id: e.id,
      qualification: typeLabel(e.qualification),
      sittings: e.sittings.map((st) => ({
        sittingNo: st.sittingNo,
        year: st.examinationYear,
        candidateNumber: st.candidateNumber,
        centreNumber: st.centreNumber,
        results: results.filter((r) => r.sittingId === st.id).map((r) => ({ subject: r.subject, value: r.value || resultTypeLabel(r.resultTypeId) || "" })),
      })),
    })),
    documents,
    // Required documents the applicant hasn't uploaded (after submission there should be none, unless the institution added one since).
    missingDocuments: submitted ? app.requirements.filter((r) => r.required && !app.documents.some((d) => d.requirementId === r.id)).map((r) => r.name) : [],
    comments: app.comments.map((c) => ({ id: c.id, body: c.body, visibleToApplicant: c.visibleToApplicant, by: c.authorName, at: c.createdAt })),
    abilities,
    // What can be done now, and if not, why not. The server checks the same again when it is attempted.
    actions: {
      verifyPayment: abilities.verifyPayment && awaitingReview,
      verifyUploads: abilities.verifyUploads && submitted && !FINAL_STATUSES.includes(app.status as ApplicationStatus),
      acknowledge: { allowed: abilities.acknowledge && !blocker, reason: abilities.acknowledge ? blocker : "Your staff account doesn't have permission to acknowledge applications." },
      reject: { allowed: abilities.reject && movesFor(app.status, "institution").includes("I_REJECTED"), reason: !abilities.reject ? "Your staff account doesn't have permission to reject applications." : movesFor(app.status, "institution").includes("I_REJECTED") ? null : `An application that is "${ADMIN_STATUS_LABELS[app.status as ApplicationStatus]}" can't be rejected.` },
      comment: abilities.comment,
      cancelAcknowledgement: abilities.acknowledge && app.status === "I_ACKNOWLEDGED",
      cancelRejection: abilities.reject && app.status === "I_REJECTED",
    },
    // Who took the decision now standing, and when (acknowledged and rejected lists).
    decision: (() => {
      const last = [...app.events].reverse().find((e) => e.status === app.status);
      return last && (app.status === "I_ACKNOWLEDGED" || app.status === "I_REJECTED") ? { status: app.status, at: last.at, by: nameOf(last.actorUserId), note: last.note } : null;
    })(),
  };
}

export type InstitutionApplicationView = Awaited<ReturnType<typeof getForInstitution>>;

const decisionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("acknowledge"), note: z.string().trim().max(1000).optional() }),
  z.object({ action: z.literal("reject"), reasonId: z.string({ error: "Choose a rejection reason." }).trim().min(1, "Choose a rejection reason."), note: z.string().trim().max(1000).optional() }),
  z.object({ action: z.literal("cancel_acknowledgement"), note: z.string({ error: "Say why the acknowledgement is being cancelled." }).trim().min(1, "Say why the acknowledgement is being cancelled.").max(1000) }),
  z.object({ action: z.literal("cancel_rejection"), note: z.string({ error: "Say why the rejection is being cancelled." }).trim().min(1, "Say why the rejection is being cancelled.").max(1000) }),
]);

/** Where an application goes back to when its acknowledgement or rejection is cancelled: the review status it was in before the decision. */
async function reviewStatusBefore(db: Executor, applicationInstitutionId: string): Promise<"SUBMITTED" | "RESUBMITTED"> {
  const [last] = await db
    .select({ status: applicationStatusEvents.status })
    .from(applicationStatusEvents)
    .where(and(eq(applicationStatusEvents.applicationInstitutionId, applicationInstitutionId), inArray(applicationStatusEvents.status, ["SUBMITTED", "RESUBMITTED"])))
    .orderBy(desc(applicationStatusEvents.at))
    .limit(1);
  return last?.status === "RESUBMITTED" ? "RESUBMITTED" : "SUBMITTED";
}

/**
 * Acknowledge, reject or accept an application. Used by institution staff
 * and, with actor "admin", by Cheeta administration.
 *
 * Acknowledging needs the institution's own checks done first: the
 * payment verified as received, and every required upload approved.
 * Rejecting needs a reason from the platform's list; a comment can be
 * added to it. Every change goes through the status engine, which records
 * it and tells the applicant.
 */
export async function decide(user: PublicUser, id: string, input: unknown, actor: "institution" | "admin" = "institution") {
  // Admitting is never done here: an admission is only made by publishing a deliberation run.
  if (input && typeof input === "object" && (input as { action?: unknown }).action === "accept") {
    throw new ConflictError("Applicants are admitted by deliberation: run the deliberation and publish it to make offers.");
  }
  const v = parseWith(decisionSchema, input);
  const db = getDb();
  await db.transaction(async (tx) => {
    const app: LoadedApplication = actor === "admin" ? await loadApplicationInstitution(tx, id) : await loadForInstitution(tx, user, id);
    if (actor === "institution") {
      await assertPermission(tx, user, v.action === "reject" || v.action === "cancel_rejection" ? "REJECTED_APPS" : "ACKNOWLEDGED_APPS");
      assertCanSee(await abilitiesOf(tx, user), app.status);
    }
    if (v.action === "cancel_acknowledgement" || v.action === "cancel_rejection") {
      const from = v.action === "cancel_acknowledgement" ? "I_ACKNOWLEDGED" : "I_REJECTED";
      if (app.status !== from) throw new ConflictError(v.action === "cancel_acknowledgement" ? "Only an acknowledged application's acknowledgement can be cancelled." : "Only a rejected application's rejection can be cancelled.");
      const back = await reviewStatusBefore(tx, app.id);
      await transition(tx, app, back, actor, { actorUserId: user.id, note: `${v.action === "cancel_acknowledgement" ? "Acknowledgement cancelled" : "Rejection cancelled"}: ${v.note}` });
      return;
    }
    if (!app.payments.some((p) => p.approval === "APPROVED")) throw new ValidationError({ status: "The application fee hasn't been approved yet." });

    if (v.action === "acknowledge") {
      const blocker = acknowledgeBlocker(app);
      if (blocker && actor === "institution") throw new ConflictError(blocker);
      await transition(tx, app, "I_ACKNOWLEDGED", actor, { actorUserId: user.id, note: v.note });
      // Acknowledging puts the applicant's name on the Deliberation List. For an
      // institution with an active deliberation subscription, that name is charged for.
      await chargeNames(tx, app.institutionId, [app.id]);
    } else if (v.action === "reject") {
      const [reason] = await tx
        .select()
        .from(parameters)
        .where(and(eq(parameters.id, v.reasonId), eq(parameters.category, "rejection-reasons"), eq(parameters.status, "ACTIVE")))
        .limit(1);
      if (!reason) throw new ValidationError({ reasonId: "Choose a rejection reason from the list." });
      await transition(tx, app, "I_REJECTED", actor, { actorUserId: user.id, reasonId: reason.id, note: v.note ? `${reason.label}. ${v.note}` : reason.label });
    }
  });
  return actor === "admin" ? null : getForInstitution(user, id);
}

const paymentCheckSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("verify"), note: z.string().trim().max(1000).optional() }),
  z.object({ decision: z.literal("not_received"), note: z.string({ error: "Say what you found, for Cheeta administration to look into." }).trim().min(1, "Say what you found, for Cheeta administration to look into.").max(1000) }),
]);

/**
 * The institution's check that the application fee reached its own
 * account. Cheeta administration has already approved the payment; this
 * records whether the institution can see the money too. "Not received"
 * goes to Cheeta administration to look into, and the application can't
 * be acknowledged until the payment is verified.
 */
export async function verifyPayment(user: PublicUser, id: string, input: unknown) {
  const v = parseWith(paymentCheckSchema, input);
  const db = getDb();
  await db.transaction(async (tx) => {
    const app = await loadForInstitution(tx, user, id);
    await assertPermission(tx, user, "PAYMENTS_UPLOADS");
    if (!AWAITING_REVIEW_STATUSES.includes(app.status as ApplicationStatus)) throw new ConflictError("The payment is checked while the application is awaiting review.");
    const payment = app.payments.find((p) => p.approval === "APPROVED");
    if (!payment) throw new ConflictError("There is no approved payment to check.");
    const result = v.decision === "verify" ? "VERIFIED" : "NOT_RECEIVED";
    await tx
      .update(applicationInstitutions)
      .set({ paymentVerification: result, paymentVerifiedBy: user.id, paymentVerifiedAt: new Date(), paymentVerificationNote: v.note ?? "" })
      .where(eq(applicationInstitutions.id, app.id));
    await audit(tx, {
      action: "verify-payment",
      entityType: "application",
      entityId: app.id,
      institutionId: app.institutionId,
      before: { paymentVerification: app.paymentVerification },
      after: { paymentVerification: result },
      meta: { bankCode: payment.bankCode, ...(v.note ? { note: v.note } : {}) },
    });
    if (result === "VERIFIED") {
      await notifyEvent(tx, {
        event: "verification.payment_verified",
        to: { userId: app.application.applicantId },
        applicationId: app.id,
        values: { "payment.reference": payment.bankCode ?? "" },
        inApp: { title: `${app.institution.name} confirmed your fee`, summary: `${app.institution.name} has confirmed it received your application fee.`, category: "VERIFICATION" },
        action: { label: "View application", href: "/student/application/status" },
      });
    }
    if (result === "NOT_RECEIVED") {
      await notify(tx, {
        audience: "admin",
        category: "PAYMENT",
        title: `Payment not found by ${app.institution.name}: ${payment.bankCode}`,
        summary: `${app.reference}: the institution can't find this payment in its account. ${v.note ?? ""}`.trim(),
        important: true,
        reference: app.reference,
        action: { label: "Review payments", href: "/admin/payments" },
      });
    }
  });
  return getForInstitution(user, id);
}

const reviewSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve") }),
  z
    .object({ decision: z.literal("reject"), reasonId: z.string().trim().max(200).optional(), reason: z.string().trim().max(500).optional() })
    .refine((x) => x.reasonId || x.reason, { path: ["reason"], message: "Say why the document is rejected." }),
]);

/**
 * Approves or rejects one uploaded document. A rejection needs a reason
 * (a standard one from the list, words of the reviewer's own, or both),
 * which the applicant is shown so they can upload it again.
 */
export async function reviewDocument(user: PublicUser, id: string, documentId: string, input: unknown) {
  const v = parseWith(reviewSchema, input);
  const db = getDb();
  await db.transaction(async (tx) => {
    const app = await loadForInstitution(tx, user, id);
    await assertPermission(tx, user, "PAYMENTS_UPLOADS");
    if (EDITABLE_STATUSES.includes(app.status as ApplicationStatus)) throw new ValidationError({ status: "Documents are reviewed once the application is submitted." });
    if (FINAL_STATUSES.includes(app.status as ApplicationStatus)) throw new ConflictError("This application has been decided; its documents can't be reviewed again.");
    const doc = app.documents.find((d) => d.id === documentId);
    if (!doc) throw new NotFoundError("Document");

    let reason: string | null = null;
    let reasonId: string | null = null;
    if (v.decision === "reject") {
      if (v.reasonId) {
        const [standard] = await tx
          .select()
          .from(parameters)
          .where(and(eq(parameters.id, v.reasonId), eq(parameters.category, "rejection-reasons"), eq(parameters.status, "ACTIVE")))
          .limit(1);
        if (!standard || standard.attrs?.appliesTo !== "upload") throw new ValidationError({ reasonId: "Choose a reason from the list." });
        reasonId = standard.id;
        reason = v.reason ? `${standard.label}. ${v.reason}` : standard.label;
      } else reason = v.reason ?? "";
    }
    await tx
      .update(applicationDocuments)
      .set({ reviewStatus: v.decision === "approve" ? "APPROVED" : "REJECTED", rejectionReason: reason, rejectionReasonId: reasonId, reviewedBy: user.id, reviewedAt: new Date() })
      .where(eq(applicationDocuments.id, doc.id));
    await audit(tx, {
      action: "review",
      entityType: "application-document",
      entityId: doc.id,
      institutionId: app.institutionId,
      before: { reviewStatus: doc.reviewStatus },
      after: { reviewStatus: v.decision === "approve" ? "APPROVED" : "REJECTED", rejectionReason: reason },
    });
    if (v.decision === "reject") {
      await notifyEvent(tx, {
        event: "rejection.document_rejected",
        to: { userId: app.application.applicantId },
        applicationId: app.id,
        values: { "document.name": doc.requirementName, reason },
        inApp: { title: `${app.institution.name}: document rejected`, summary: `${doc.requirementName}: ${reason}`, category: "UPLOAD" },
        important: true,
        action: { label: "Upload again", href: "/student/institutions/upload" },
      });
    } else {
      // Once every document on the application is approved, the applicant hears it once.
      const docs = await tx.select({ status: applicationDocuments.reviewStatus }).from(applicationDocuments).where(eq(applicationDocuments.applicationInstitutionId, app.id));
      if (docs.length && docs.every((d) => d.status === "APPROVED")) {
        await notifyEvent(tx, {
          event: "verification.documents_verified",
          to: { userId: app.application.applicantId },
          applicationId: app.id,
          inApp: { title: `${app.institution.name} verified your documents`, summary: `${app.institution.name} has checked and accepted every document on your application.`, category: "VERIFICATION" },
          action: { label: "View application", href: "/student/application/status" },
        });
      }
    }
  });
  return getForInstitution(user, id);
}

const commentSchema = z.object({
  body: z.string({ error: "Write the comment." }).trim().min(1, "Write the comment.").max(2000),
  /** Share it with the applicant too. Off by default: comments are the institution's own notes. */
  visibleToApplicant: z.boolean().default(false),
});

/** Adds a comment to an application. Kept with the application, visible to the institution's staff (and the applicant, if shared). */
export async function addComment(user: PublicUser, id: string, input: unknown) {
  const v = parseWith(commentSchema, input);
  const db = getDb();
  await db.transaction(async (tx) => {
    const app = await loadForInstitution(tx, user, id);
    await assertPermission(tx, user, "review");
    assertCanSee(await abilitiesOf(tx, user), app.status);
    // Before the fee is approved the institution only sees a masked name, so there is nothing to comment on yet.
    if (!app.payments.some((p) => p.approval === "APPROVED")) throw new ConflictError("Comments can be added once the application fee is approved.");
    const commentId = newId("cmt");
    await tx.insert(applicationComments).values({ id: commentId, applicationInstitutionId: app.id, institutionId: app.institutionId, authorUserId: user.id, body: v.body, visibleToApplicant: v.visibleToApplicant });
    await audit(tx, { action: "comment", entityType: "application", entityId: app.id, institutionId: app.institutionId, meta: { commentId, visibleToApplicant: v.visibleToApplicant } });
    if (v.visibleToApplicant) {
      await notify(tx, {
        audience: "student",
        recipientUserId: app.application.applicantId,
        category: "APPLICATION",
        title: `${app.institution.name} commented on your application`,
        summary: v.body.length > 160 ? `${v.body.slice(0, 157)}…` : v.body,
        reference: app.reference,
        action: { label: "View application", href: "/student/application/status" },
      });
    }
  });
  return getForInstitution(user, id);
}

// ---------------------------------------------------------------------------
// Application fees, as the institution may see them
// ---------------------------------------------------------------------------

/** Everything before the surname, for searching masked applicants without matching (and so revealing) the surname. */
const firstNames = sql<string>`regexp_replace(${users.fullName}, '\\s+\\S+$', '')`;

/** The payments on applications to one institution, one row per application: its approved payment if it has one. */
function feeRows(db: Executor, institutionId: string) {
  const approved = db.$with("approved").as(
    db
      .select({ applicationInstitutionId: feePayments.applicationInstitutionId, bankCode: feePayments.bankCode, applicationFee: feePayments.applicationFee, currency: feePayments.currency, approvedAt: feePayments.reviewedAt })
      .from(feePayments)
      .where(eq(feePayments.approval, "APPROVED"))
  );
  // Only applications a payment has been recorded for. One with nothing paid isn't "awaiting payment approval".
  const hasPayment = sql`exists (select 1 from ${feePayments} where ${feePayments.applicationInstitutionId} = ${applicationInstitutions.id})`;
  return { approved, scope: and(eq(applicationInstitutions.institutionId, institutionId), hasPayment) };
}

type FeeRow = { id: string; reference: string; fullName: string; email: string; bankCode: string | null; applicationFee: number | null; currency: string | null; approvedAt: Date | null; programName?: string | null };

/**
 * What an institution is told about one application's fee. Paid (approved
 * by Cheeta administration): who, under which bank code, and the
 * institution's own fee. Anything else, whether the payment is still being
 * checked or was rejected, is one masked line with no amount, method,
 * reference or reason. The web fee is never included either way.
 */
function presentFee(r: FeeRow) {
  if (r.bankCode && r.approvedAt) {
    return { state: "PAID" as const, id: r.id, applicationReference: r.reference, displayName: r.fullName, programName: r.programName ?? null, bankCode: r.bankCode, applicationFee: r.applicationFee ?? 0, currency: r.currency ?? BASE_CURRENCY, approvedAt: r.approvedAt };
  }
  return { state: "AWAITING" as const, id: r.id, displayName: maskAccountName(r.fullName, r.email) };
}

async function firstChoicePrograms(db: Executor, applicationInstitutionIds: string[]) {
  if (!applicationInstitutionIds.length) return new Map<string, string>();
  const rows = await db
    .select({ applicationInstitutionId: programChoices.applicationInstitutionId, name: programs.name })
    .from(programChoices)
    .innerJoin(programs, eq(programs.id, programChoices.programId))
    .where(and(inArray(programChoices.applicationInstitutionId, applicationInstitutionIds), eq(programChoices.rank, 1)));
  return new Map(rows.map((r) => [r.applicationInstitutionId, r.name]));
}

/** ?state=AWAITING|PAID, ?q= (paid: name, application or bank code; awaiting: first names only). */
export async function listFeesForInstitution(user: PublicUser, req: NextRequest) {
  const institutionId = institutionOf(user);
  await assertPermission(getDb(), user, "PAYMENTS_UPLOADS");
  const query = parseQuery(req, pagination.extend({ state: z.enum(["AWAITING", "PAID"]).optional(), q: z.string().trim().max(100).optional() }));
  const db = getDb();
  const { approved, scope } = feeRows(db, institutionId);

  const conditions: (SQL | undefined)[] = [scope];
  if (query.state) conditions.push(query.state === "PAID" ? isNotNull(approved.bankCode) : isNull(approved.bankCode));
  if (query.q) {
    const like = `%${query.q.replace(/[%_\\]/g, "\\$&")}%`;
    conditions.push(or(and(isNotNull(approved.bankCode), or(ilike(users.fullName, like), ilike(applicationInstitutions.reference, like), ilike(approved.bankCode, like))), and(isNull(approved.bankCode), ilike(firstNames, like), sql`${users.fullName} <> split_part(${users.email}, '@', 1)`)));
  }
  const where = and(...conditions);
  const [rows, [{ total }], [summary]] = await Promise.all([
    db
      .with(approved)
      .select({ id: applicationInstitutions.id, reference: applicationInstitutions.reference, fullName: users.fullName, email: users.email, bankCode: approved.bankCode, applicationFee: approved.applicationFee, currency: approved.currency, approvedAt: approved.approvedAt })
      .from(applicationInstitutions)
      .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
      .innerJoin(users, eq(users.id, applications.applicantId))
      .leftJoin(approved, eq(approved.applicationInstitutionId, applicationInstitutions.id))
      .where(where)
      // Those still being checked first, then the paid, each by name.
      .orderBy(sql`${approved.bankCode} is not null`, asc(users.fullName))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db
      .with(approved)
      .select({ total: count() })
      .from(applicationInstitutions)
      .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
      .innerJoin(users, eq(users.id, applications.applicantId))
      .leftJoin(approved, eq(approved.applicationInstitutionId, applicationInstitutions.id))
      .where(where),
    // The totals are for the whole institution, whatever is being searched for.
    db
      .with(approved)
      .select({ paid: sql<number>`count(${approved.bankCode})::int`, all: sql<number>`count(*)::int`, fees: sql<number>`coalesce(sum(${approved.applicationFee}), 0)::float8` })
      .from(applicationInstitutions)
      .leftJoin(approved, eq(approved.applicationInstitutionId, applicationInstitutions.id))
      .where(scope),
  ]);
  const programOf = await firstChoicePrograms(db, rows.filter((r) => r.bankCode).map((r) => r.id));
  return {
    data: rows.map((r) => presentFee({ ...r, programName: programOf.get(r.id) })),
    meta: { page: query.page, pageSize: query.pageSize, total },
    summary: { awaiting: summary.all - summary.paid, paid: summary.paid, applicationFees: summary.fees, currency: BASE_CURRENCY },
  };
}

/**
 * Finds a paid applicant by the bank code issued on approval. Only an
 * approved payment at the caller's institution can be found; a code for
 * anything else finds nothing and the answer doesn't say which, so the
 * lookup can't be used to probe.
 */
export async function findFeeByBankCode(user: PublicUser, code: string) {
  const institutionId = institutionOf(user);
  await assertPermission(getDb(), user, "PAYMENTS_UPLOADS");
  const wanted = normalizeBankCode(code);
  if (!wanted) return null;
  const db = getDb();
  const [row] = await db
    .select({ id: applicationInstitutions.id, reference: applicationInstitutions.reference, fullName: users.fullName, email: users.email, bankCode: feePayments.bankCode, applicationFee: feePayments.applicationFee, currency: feePayments.currency, approvedAt: feePayments.reviewedAt })
    .from(feePayments)
    .innerJoin(applicationInstitutions, eq(applicationInstitutions.id, feePayments.applicationInstitutionId))
    .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
    .innerJoin(users, eq(users.id, applications.applicantId))
    .where(and(eq(applicationInstitutions.institutionId, institutionId), eq(feePayments.approval, "APPROVED"), eq(feePayments.bankCode, wanted)))
    .limit(1);
  if (!row) return null;
  const programOf = await firstChoicePrograms(db, [row.id]);
  return presentFee({ ...row, programName: programOf.get(row.id) });
}

/** Counts by status for the institution dashboard. */
export async function statusCounts(user: PublicUser) {
  const db = getDb();
  const visible = visibleStatuses(await abilitiesOf(db, user));
  const rows = await db
    .select({ status: applicationInstitutions.status, n: count() })
    .from(applicationInstitutions)
    .where(and(eq(applicationInstitutions.institutionId, institutionOf(user)), inArray(applicationInstitutions.status, visible)))
    .groupBy(applicationInstitutions.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}

/**
 * The institution dashboard's figures, from its own applications only. A
 * figure for applications the staff member's permissions don't cover is
 * null (shown as not available), so the dashboard never reveals more than
 * the applications table would.
 */
export async function dashboardCounts(user: PublicUser) {
  const db = getDb();
  const institutionId = institutionOf(user);
  const abilities = await abilitiesOf(db, user);
  const mine = eq(applicationInstitutions.institutionId, institutionId);
  const approvedFee = sql`EXISTS (SELECT 1 FROM fee_payments f WHERE f.application_institution_id = ${applicationInstitutions.id} AND f.approval = 'APPROVED')`;
  const [byStatus, [awaitingPayment], [paymentToCheck], [uploadsToVerify]] = await Promise.all([
    db.select({ status: applicationInstitutions.status, n: count() }).from(applicationInstitutions).where(and(mine, isNotNull(applicationInstitutions.submittedAt))).groupBy(applicationInstitutions.status),
    db
      .select({ n: count() })
      .from(applicationInstitutions)
      .where(and(mine, inArray(applicationInstitutions.status, AWAITING_REVIEW_STATUSES), sql`NOT ${approvedFee}`)),
    db
      .select({ n: count() })
      .from(applicationInstitutions)
      .where(and(mine, inArray(applicationInstitutions.status, AWAITING_REVIEW_STATUSES), approvedFee, eq(applicationInstitutions.paymentVerification, "PENDING"))),
    db
      .select({ n: count() })
      .from(applicationDocuments)
      .innerJoin(applicationInstitutions, eq(applicationInstitutions.id, applicationDocuments.applicationInstitutionId))
      .where(and(mine, inArray(applicationInstitutions.status, [...AWAITING_REVIEW_STATUSES, "I_ACKNOWLEDGED"]), approvedFee, eq(applicationDocuments.reviewStatus, "PENDING"))),
  ]);
  const n = (s: ApplicationStatus) => Number(byStatus.find((r) => r.status === s)?.n ?? 0);
  const visible = visibleStatuses(abilities);
  const total = byStatus.filter((r) => visible.includes(r.status as ApplicationStatus)).reduce((sum, r) => sum + Number(r.n), 0);
  return {
    total,
    awaitingReview: n("SUBMITTED") + n("RESUBMITTED"),
    awaitingPayment: Number(awaitingPayment.n),
    paymentToCheck: abilities.verifyPayment ? Number(paymentToCheck.n) : null,
    uploadsToVerify: abilities.verifyUploads ? Number(uploadsToVerify.n) : null,
    acknowledged: abilities.acknowledge ? n("I_ACKNOWLEDGED") : null,
    rejected: abilities.reject ? n("I_REJECTED") : null,
    offered: abilities.deliberation ? n("ACCEPTED") : null,
    takenUp: abilities.deliberation ? n("A_ACKNOWLEDGED") : null,
    declined: abilities.deliberation ? n("A_REJECTED") : null,
  };
}

export type InstitutionDashboardCounts = Awaited<ReturnType<typeof dashboardCounts>>;
