import "server-only";
import { count, eq } from "drizzle-orm";
import { ADMIN_STATUS_LABELS } from "@/lib/admin/status";
import { canTransition, type StatusActor } from "@/lib/applications/statusFlow";
import { demographicCompletion } from "@/lib/demographic/completion";
import type { ApplicationStatus } from "@/lib/types";
import type { Executor } from "@/server/db/client";
import { applicationInstitutions, applicationStatusEvents, demographicProfiles, educationRecords } from "@/server/db/schema";
import { newId } from "@/server/db/ids";
import { audit } from "@/server/audit/audit";
import { ValidationError } from "@/server/http/errors";
import { notify } from "@/server/notifications/notifications.service";
import type { LoadedApplication } from "./applications.queries";

/**
 * Status changes and the submission checklist, shared by every portal.
 */

/**
 * Moves an institution application to a new status, if the status flow
 * (src/lib/applications/statusFlow.ts) allows `actor` to. Records the
 * event, audits it, and notifies the other side.
 */
export async function transition(
  tx: Executor,
  app: Pick<LoadedApplication, "id" | "status" | "institutionId" | "reference" | "application" | "institution">,
  to: ApplicationStatus,
  actor: StatusActor,
  opts: { actorUserId?: string | null; note?: string; reasonId?: string | null } = {}
) {
  const from = app.status as ApplicationStatus;
  if (!canTransition(from, to, actor)) {
    throw new ValidationError({ status: `An application that is "${ADMIN_STATUS_LABELS[from]}" can't be moved to "${ADMIN_STATUS_LABELS[to]}" here.` });
  }
  const now = new Date();
  const decided = to === "I_REJECTED" || to === "ACCEPTED";
  await tx
    .update(applicationInstitutions)
    .set({ status: to, ...(to === "SUBMITTED" || to === "RESUBMITTED" ? { submittedAt: now } : {}), ...(decided ? { decidedAt: now } : {}) })
    .where(eq(applicationInstitutions.id, app.id));
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
  await audit(tx, { action: "status", entityType: "application", entityId: app.id, institutionId: app.institutionId, before: { status: from }, after: { status: to }, meta: opts.note ? { note: opts.note } : undefined });

  const label = ADMIN_STATUS_LABELS[to];
  if (actor === "applicant") {
    await notify(tx, {
      audience: "institution",
      institutionId: app.institutionId,
      category: to === "SUBMITTED" || to === "RESUBMITTED" ? "APPLICATION" : "ADMISSION",
      title: `${app.reference}: ${label}`,
      summary: `Application ${app.reference} is now "${label}".`,
      reference: app.reference,
      action: { label: "Open application", href: `/institution/applications/${app.id}` },
    });
  } else {
    await notify(tx, {
      audience: "student",
      recipientUserId: app.application.applicantId,
      category: to === "I_REJECTED" ? "REJECTION" : to === "ACCEPTED" ? "ADMISSION" : "VERIFICATION",
      title: `${app.institution.name}: ${label}`,
      summary: opts.note ? `${label}. ${opts.note}` : `Your application ${app.reference} is now "${label}".`,
      important: to === "ACCEPTED" || to === "I_REJECTED",
      reference: app.reference,
      action: { label: "View application", href: "/student/application/status" },
    });
  }
}

export interface ReadinessCheck {
  key: "personal" | "education" | "programs" | "documents" | "fee";
  label: string;
  ok: boolean;
  detail: string;
}

/** The checklist the Print/Submit screen shows, worked out from stored data. */
export async function readiness(db: Executor, app: LoadedApplication): Promise<{ ready: boolean; checks: ReadinessCheck[] }> {
  const applicantId = app.application.applicantId;
  const [[demoRow], [{ n: educationCount }]] = await Promise.all([
    db.select().from(demographicProfiles).where(eq(demographicProfiles.userId, applicantId)).limit(1),
    db.select({ n: count() }).from(educationRecords).where(eq(educationRecords.userId, applicantId)),
  ]);
  // The same completion status the demographic screens show, worked out from the stored record.
  const demographic = demographicCompletion(demoRow ?? null, demoRow?.submittedAt?.toISOString() ?? null);
  const demo = demographic.status === "COMPLETE";

  const required = app.requirements.filter((r) => r.required);
  const missing = required.filter((r) => !app.documents.some((d) => d.requirementId === r.id));
  const rejected = app.documents.filter((d) => d.reviewStatus === "REJECTED");
  const approvedPayment = app.payments.find((p) => p.approval === "APPROVED");
  const awaitingPayment = app.payments.find((p) => p.approval === "AWAITING");

  const checks: ReadinessCheck[] = [
    {
      key: "personal",
      label: "Personal details",
      ok: demo,
      detail: demo
        ? "Submitted"
        : demographic.missingFields.length
        ? `Still needed: ${demographic.missingFields.map((f) => f.label).join(", ")}`
        : "Submit your demographic information.",
    },
    { key: "education", label: "Education", ok: educationCount > 0, detail: educationCount ? `${educationCount} school${educationCount === 1 ? "" : "s"} recorded` : "Add at least one school." },
    { key: "programs", label: "Study programs", ok: app.choices.length > 0, detail: app.choices.length ? `${app.choices.length} chosen` : "Choose at least one program." },
    {
      key: "documents",
      label: "Documents",
      ok: missing.length === 0 && rejected.length === 0,
      detail: missing.length ? `Missing: ${missing.map((r) => r.name).join(", ")}` : rejected.length ? `Rejected: ${rejected.map((d) => d.requirementName).join(", ")}` : `All ${required.length} uploaded`,
    },
    {
      key: "fee",
      label: "Application fee",
      ok: !!approvedPayment,
      detail: approvedPayment ? `Approved, bank code ${approvedPayment.bankCode}` : awaitingPayment ? "Payment recorded, awaiting AOSA approval." : "Not paid yet.",
    },
  ];
  return { ready: checks.every((c) => c.ok), checks };
}
