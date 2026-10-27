import "server-only";
import { and, count, eq, inArray } from "drizzle-orm";
import { ADMIN_STATUS_LABELS } from "@/lib/admin/status";
import { EDITABLE_STATUSES, canTransition, nextStatuses, type StatusActor } from "@/lib/applications/statusFlow";
import { demographicCompletion } from "@/lib/demographic/completion";
import type { ApplicationStatus } from "@/lib/types";
import type { Executor } from "@/server/db/client";
import { applicationFees, applicationInstitutions, applicationStatusEvents, applications, demographicProfiles, educationRecords, files, parameters, programs } from "@/server/db/schema";
import { newId } from "@/server/db/ids";
import { audit } from "@/server/audit/audit";
import { ConflictError } from "@/server/http/errors";
import { notify } from "@/server/notifications/notifications.service";
import { notifyEvent } from "@/server/notifications/engine";
import { getSettings } from "@/server/modules/settings/settings.service";
import { getExamConfigurationData, loadExaminations } from "@/server/modules/student/examinations.service";
import { currentAcademicYear, loadApplicationInstitution, maxProgramChoicesFor, type LoadedApplication } from "./applications.queries";

/**
 * The application status engine and the submission checklist, shared by
 * every portal.
 *
 * Every change of status goes through `transition`: it checks the move
 * against the status table (src/lib/applications/statusFlow.ts), makes it
 * only if the application is still in the status it was read in (so two
 * people acting at once can't both move it), records it as a status event
 * and in the audit trail, and tells the other side.
 */

type TransitionTarget = Pick<LoadedApplication, "id" | "status" | "institutionId" | "reference" | "application" | "institution">;

export async function transition(tx: Executor, app: TransitionTarget, to: ApplicationStatus, actor: StatusActor, opts: { actorUserId?: string | null; note?: string; reasonId?: string | null } = {}) {
  const from = app.status as ApplicationStatus;
  if (!canTransition(from, to, actor)) {
    throw new ConflictError(`An application that is "${ADMIN_STATUS_LABELS[from]}" can't be moved to "${ADMIN_STATUS_LABELS[to]}".`, { fieldErrors: { status: `Can't move from "${ADMIN_STATUS_LABELS[from]}" to "${ADMIN_STATUS_LABELS[to]}".` } });
  }
  const now = new Date();
  const decided = to === "I_REJECTED" || to === "ACCEPTED";
  const [moved] = await tx
    .update(applicationInstitutions)
    // Submission time is the applicant's: an institution cancelling its decision puts the application back under review without changing it.
    .set({ status: to, ...((to === "SUBMITTED" || to === "RESUBMITTED") && actor === "applicant" ? { submittedAt: now } : {}), ...(decided ? { decidedAt: now } : to === "SUBMITTED" || to === "RESUBMITTED" ? { decidedAt: null } : {}) })
    // Only from the status it was read in: if someone else has moved it meanwhile, nothing is changed.
    .where(and(eq(applicationInstitutions.id, app.id), eq(applicationInstitutions.status, from)))
    .returning({ id: applicationInstitutions.id });
  if (!moved) throw new ConflictError("This application has just been changed by someone else. Reload it and try again.");
  await tx.insert(applicationStatusEvents).values({
    id: newId("evt"),
    applicationInstitutionId: app.id,
    status: to,
    actor,
    actorUserId: opts.actorUserId ?? null,
    note: opts.note ?? "",
    reasonId: opts.reasonId ?? null,
    at: now,
  });
  await audit(tx, {
    action: "status",
    entityType: "application",
    entityId: app.id,
    institutionId: app.institutionId,
    before: { status: from },
    after: { status: to },
    meta: { actor, ...(opts.note ? { note: opts.note } : {}), ...(opts.reasonId ? { reasonId: opts.reasonId } : {}) },
    ...(actor === "system" ? {} : opts.actorUserId ? { actorUserId: opts.actorUserId } : {}),
  });
  app.status = to;

  const label = ADMIN_STATUS_LABELS[to];
  const applicant = { userId: app.application.applicantId };
  const view = { label: "View application", href: "/student/application/status" };
  if (actor === "applicant") {
    if (to === "RESUBMITTED") {
      await notifyEvent(tx, {
        event: "resubmission.received",
        to: { institutionId: app.institutionId },
        applicationId: app.id,
        inApp: { title: `${app.reference}: ${label}`, summary: `Application ${app.reference} was corrected and sent again.`, category: "RESUBMISSION" },
        action: { label: "Open application", href: `/institution/applications/${app.id}` },
      });
    } else {
      await notify(tx, {
        audience: "institution",
        institutionId: app.institutionId,
        category: to === "SUBMITTED" ? "APPLICATION" : "ADMISSION",
        title: `${app.reference}: ${label}`,
        summary: `Application ${app.reference} is now "${label}".`,
        reference: app.reference,
        action: { label: "Open application", href: `/institution/applications/${app.id}` },
      });
    }
    if (to === "SUBMITTED" || to === "RESUBMITTED") {
      await notifyEvent(tx, {
        event: "application.submitted",
        to: applicant,
        applicationId: app.id,
        inApp: { title: `Application sent to ${app.institution.name}`, summary: `Your application to ${app.institution.name} has been ${to === "RESUBMITTED" ? "sent again" : "submitted"}. We'll tell you when the institution acknowledges it.` },
        action: view,
      });
    }
  } else if (actor === "system" && to === "I_REJECTED") {
    // A provisional offer withdrawn: the withdrawal sends its own notice, with the conditions.
  } else if (actor === "system") {
    await notify(tx, {
      audience: "student",
      recipientUserId: app.application.applicantId,
      category: "APPLICATION",
      title: to === "COMPLETED" ? `${app.institution.name}: ready to submit` : `${app.institution.name}: something is missing`,
      summary: to === "COMPLETED" ? `Everything your application to ${app.institution.name} needs is in place. You can submit it.` : `Your application to ${app.institution.name} needs attention before it can be submitted.`,
      reference: app.reference,
      action: { label: to === "COMPLETED" ? "Submit your application" : "See what is missing", href: "/student/submit/print-submit" },
    });
  } else if (to === "ACCEPTED") {
    // The offer is announced when its admission record is made (deliberation publishing), with the admission number.
  } else {
    const inApp = { title: `${app.institution.name}: ${label}`, summary: opts.note ? `${label}. ${opts.note}` : `Your application ${app.reference} is now "${label}".` };
    if (to === "I_ACKNOWLEDGED") {
      await notifyEvent(tx, { event: "verification.application_acknowledged", to: applicant, applicationId: app.id, inApp, action: view });
    } else if (to === "I_REJECTED") {
      // A reason marked "correct and resubmit" asks for a correction; any other is final.
      const [reason] = opts.reasonId ? await tx.select({ attrs: parameters.attrs }).from(parameters).where(eq(parameters.id, opts.reasonId)).limit(1) : [];
      const resubmit = reason?.attrs?.resubmit === true;
      await notifyEvent(tx, {
        event: resubmit ? "resubmission.requested" : "rejection.application_rejected",
        to: applicant,
        applicationId: app.id,
        values: { reason: opts.note ?? "" },
        inApp: { ...inApp, category: resubmit ? "RESUBMISSION" : "REJECTION" },
        important: true,
        action: resubmit ? { label: "Correct and resubmit", href: "/student/submit/print-submit" } : view,
      });
    } else {
      await notify(tx, { audience: "student", recipientUserId: app.application.applicantId, category: "VERIFICATION", ...inApp, reference: app.reference, action: view });
    }
  }
}

/** The moves `actor` could make from the application's current status (before any other condition is checked). */
export function movesFor(status: string, actor: StatusActor) {
  return nextStatuses(status as ApplicationStatus, actor);
}

// ---------------------------------------------------------------------------
// The submission checklist
// ---------------------------------------------------------------------------

export type ReadinessKey = "personal" | "education" | "examinations" | "results" | "institution" | "programs" | "documents" | "fee" | "payment";

export interface ReadinessCheck {
  key: ReadinessKey;
  label: string;
  ok: boolean;
  detail: string;
}

/**
 * Everything an application must have before it can be submitted, worked
 * out from what is stored, never from what a screen says. The same
 * checklist is shown on the Print/Submit screen, decides whether the
 * application is COMPLETED, and is applied again at the moment of
 * submission. The declaration is the one thing not on it: it is
 * confirmed with the submission itself.
 */
export async function readiness(db: Executor, app: LoadedApplication, opts: { resubmission?: boolean } = {}): Promise<{ ready: boolean; checks: ReadinessCheck[] }> {
  const applicantId = app.application.applicantId;
  const [[demoRow], [{ n: educationCount }], examinations, examConfig, year, system, payment, maxChoices, [fee]] = await Promise.all([
    db.select().from(demographicProfiles).where(eq(demographicProfiles.userId, applicantId)).limit(1),
    db.select({ n: count() }).from(educationRecords).where(eq(educationRecords.userId, applicantId)),
    loadExaminations(db, applicantId),
    getExamConfigurationData(db),
    currentAcademicYear(db),
    // Read through the same connection: inside a transaction, a read on another would wait for this one to finish.
    getSettings("system", db),
    getSettings("payment", db),
    maxProgramChoicesFor(db, app.institutionId),
    db.select().from(applicationFees).where(eq(applicationFees.applicationInstitutionId, app.id)).limit(1),
  ]);

  // Personal details: the same completion the demographic screens show, worked out from the stored record.
  const demographic = demographicCompletion(demoRow ?? null, demoRow?.submittedAt?.toISOString() ?? null);
  const demo = demographic.status === "COMPLETE";

  // Examinations and their results: at least one examination, and a result recorded for each.
  const examName = (id: string) => examConfig.types.find((t) => t.id === id)?.qualification ?? id;
  const withoutResults = examinations.filter((e) => !e.sittings.some((s) => s.resultCount > 0));
  const resultCount = examinations.reduce((sum, e) => sum + e.sittings.reduce((n, s) => n + s.resultCount, 0), 0);

  // The institution: still taking applications, for the intake this application is for.
  const today = new Date().toISOString().slice(0, 10);
  const closes = String(year?.attrs?.closesOn ?? "");
  // A correction the institution asked for can be sent back after the intake has closed; a first submission can't.
  const intakeClosed = !opts.resubmission && !!closes && today > closes && !system.allowLateSubmissions;
  const sameIntake = opts.resubmission || (!!year && app.application.academicYearId === year.id);
  const institutionOk = app.institution.status === "ACTIVE" && sameIntake && !intakeClosed;

  // Study choices: at least one, no more than the institution allows, each still offered.
  const offered = app.choices.length
    ? await db
        .select({ id: programs.id })
        .from(programs)
        .where(and(inArray(programs.id, app.choices.map((c) => c.programId)), eq(programs.institutionId, app.institutionId), eq(programs.status, "ACTIVE")))
    : [];
  const withdrawn = app.choices.filter((c) => !offered.some((o) => o.id === c.programId));

  // Uploads: every required document there, its file still stored, and none the institution rejected.
  const required = app.requirements.filter((r) => r.required);
  const stored = app.documents.length
    ? await db
        .select({ id: files.id, deletedAt: files.deletedAt })
        .from(files)
        .where(inArray(files.id, app.documents.map((d) => d.fileId)))
    : [];
  const present = app.documents.filter((d) => stored.some((f) => f.id === d.fileId && !f.deletedAt));
  const missing = required.filter((r) => !present.some((d) => d.requirementId === r.id));
  const rejected = app.documents.filter((d) => d.reviewStatus === "REJECTED");

  // Fee and payment: the fee could be worked out, and Cheeta administration has approved a payment of it.
  const approved = app.payments.find((p) => p.approval === "APPROVED");
  const awaiting = app.payments.find((p) => p.approval === "AWAITING");
  const lastRejected = app.payments.find((p) => p.approval === "REJECTED");
  const feeOk = !!fee || !!approved;
  const evidenceMissing = !!approved && payment.requireReceipt && !approved.receiptFileId;

  const checks: ReadinessCheck[] = [
    {
      key: "personal",
      label: "Demographic information",
      ok: demo,
      detail: demo ? "Submitted" : demographic.missingFields.length ? `Still needed: ${demographic.missingFields.map((f) => f.label).join(", ")}` : "Submit your demographic information.",
    },
    { key: "education", label: "Education", ok: educationCount > 0, detail: educationCount ? `${educationCount} school${educationCount === 1 ? "" : "s"} recorded` : "Add at least one school." },
    {
      key: "examinations",
      label: "Examinations",
      ok: examinations.length > 0,
      detail: examinations.length ? `${examinations.length} examination${examinations.length === 1 ? "" : "s"} recorded` : "Add at least one examination you have sat.",
    },
    {
      key: "results",
      label: "Results",
      ok: examinations.length > 0 && withoutResults.length === 0,
      detail: !examinations.length ? "Add an examination first, then its results." : withoutResults.length ? `No results yet for: ${withoutResults.map((e) => examName(e.qualification)).join(", ")}` : `${resultCount} result${resultCount === 1 ? "" : "s"} recorded`,
    },
    {
      key: "institution",
      label: "Institution",
      ok: institutionOk,
      detail:
        app.institution.status !== "ACTIVE"
          ? `${app.institution.name} isn't accepting applications at the moment.`
          : !sameIntake
          ? "This application is for an intake that is no longer open."
          : intakeClosed
          ? `Applications closed on ${closes}.`
          : `${app.institution.name}, ${year?.label ?? "current intake"}`,
    },
    {
      key: "programs",
      label: "Study choices",
      ok: app.choices.length > 0 && app.choices.length <= maxChoices && withdrawn.length === 0,
      detail: !app.choices.length
        ? "Choose at least one program."
        : withdrawn.length
        ? `No longer offered: ${withdrawn.map((c) => c.programName).join(", ")}. Choose again.`
        : app.choices.length > maxChoices
        ? `${app.institution.name} accepts up to ${maxChoices} choice${maxChoices === 1 ? "" : "s"}.`
        : `${app.choices.length} of ${maxChoices} chosen`,
    },
    {
      key: "documents",
      label: "Required uploads",
      ok: missing.length === 0 && rejected.length === 0,
      detail: missing.length ? `Missing: ${missing.map((r) => r.name).join(", ")}` : rejected.length ? `Rejected, upload again: ${rejected.map((d) => d.requirementName).join(", ")}` : `All ${required.length} uploaded`,
    },
    {
      key: "fee",
      label: "Application fee",
      ok: feeOk,
      detail: approved ? `${approved.amount} ${approved.currency}` : fee ? `${fee.amount} ${fee.currency} to pay` : "The fee can't be worked out at the moment. Try again later.",
    },
    {
      key: "payment",
      label: "Payment",
      ok: !!approved && !evidenceMissing,
      detail: approved
        ? evidenceMissing
          ? "The payment receipt is missing."
          : `Approved, bank code ${approved.bankCode}`
        : awaiting
        ? "Payment recorded, awaiting approval by Cheeta administration."
        : lastRejected
        ? `Last payment rejected${lastRejected.rejectionReason ? `: ${lastRejected.rejectionReason}` : ""}. Record the payment again.`
        : "Not paid yet.",
    },
  ];
  return { ready: checks.every((c) => c.ok), checks };
}

// ---------------------------------------------------------------------------
// Keeping INCOMPLETE and COMPLETED true to what is stored
// ---------------------------------------------------------------------------

/**
 * Moves an application that hasn't been submitted between INCOMPLETE and
 * COMPLETED to match its checklist, recording the move like any other.
 * Called after anything that can change the checklist; a no-op when the
 * status already matches or the application has been submitted.
 */
export async function syncCompletion(tx: Executor, appOrId: LoadedApplication | string): Promise<LoadedApplication> {
  const app = typeof appOrId === "string" ? await loadApplicationInstitution(tx, appOrId) : appOrId;
  if (!EDITABLE_STATUSES.includes(app.status as ApplicationStatus)) return app;
  const { ready } = await readiness(tx, app);
  const want: ApplicationStatus = ready ? "COMPLETED" : "INCOMPLETE";
  if (app.status === want) return app;
  await transition(tx, app, want, "system");
  // Read again, so what is returned includes the move just recorded.
  return loadApplicationInstitution(tx, app.id);
}

/** The same, for every unsubmitted application of one applicant: after a change to a section all of them share. */
export async function syncApplicantCompletion(tx: Executor, applicantId: string) {
  const rows = await tx
    .select({ id: applicationInstitutions.id })
    .from(applicationInstitutions)
    .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
    .where(and(eq(applications.applicantId, applicantId), inArray(applicationInstitutions.status, EDITABLE_STATUSES)));
  for (const row of rows) await syncCompletion(tx, row.id);
}
