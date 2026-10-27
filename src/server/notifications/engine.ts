import "server-only";
import { after } from "next/server";
import { and, asc, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { EVENT_INDEX, SEED_TEMPLATES, renderText } from "@/lib/admin/templates";
import type { NotificationCategory } from "@/lib/notifications/center";
import { env } from "@/server/config/env";
import { getDb, type Executor } from "@/server/db/client";
import {
  admissions,
  applicationInstitutions,
  applications,
  institutions,
  notificationDeliveries,
  notifications,
  notificationTemplates,
  parameters,
  programChoices,
  programs,
  users,
} from "@/server/db/schema";
import { newId } from "@/server/db/ids";
import { logger } from "@/server/logging/logger";
import { getSettings } from "@/server/modules/settings/settings.service";
import { emailProvider, smsProvider } from "./providers";

/**
 * The notification engine.
 *
 * Something happens (an application is submitted, a payment approved) and
 * the code that made it happen calls `notifyEvent` with the event's key,
 * who it is for and the facts of the case. The engine:
 *
 *  1. takes the active templates for that event, one per channel, from
 *     Cheeta administration's template list (Notifications → Templates);
 *  2. fills their placeholders with the recipient, the application and
 *     the values given;
 *  3. shows the in-app notification at once, and writes each email and SMS
 *     to the delivery records as QUEUED, all in the caller's transaction;
 *  4. once the request has answered (and so the transaction has
 *     committed), sends what is queued through the configured providers,
 *     retrying failures a few times.
 *
 * With no active in-app template for the event, the in-app text the caller
 * gave is used, so no event goes unannounced. With no active email or SMS
 * template, nothing is sent on that channel: administration decides.
 * Except for login details and links, which must always go out: for those
 * the seeded wording stands in for a missing template.
 */

export type EventKey =
  | "registration.account_created"
  | "registration.email_verification"
  | "registration.password_reset"
  | "application.submitted"
  | "payment.received"
  | "payment.rejected"
  | "verification.payment_verified"
  | "verification.application_acknowledged"
  | "verification.documents_verified"
  | "rejection.application_rejected"
  | "rejection.document_rejected"
  | "resubmission.requested"
  | "resubmission.received"
  | "admission.offer"
  | "admission.provisional_offer"
  | "admission.conditions_met"
  | "admission.withdrawn"
  | "tuition.payment_recorded"
  | "verification.tuition_verified"
  | "rejection.tuition_rejected";

export type Recipient = { userId: string } | { institutionId: string } | { admins: true };

export interface InAppText {
  title: string;
  summary: string;
  body?: string;
  category?: NotificationCategory;
}

export interface EventInput {
  event: EventKey;
  to: Recipient;
  /** The application it is about (application_institutions.id): fills application.*, institution.name, academicYear. */
  applicationId?: string;
  /** Anything else the templates may use: "reason", "payment.amount", ... */
  values?: Record<string, string | number | null | undefined>;
  /** In-app wording when there is no active in-app template for the event. */
  inApp?: InAppText;
  action?: { label: string; href: string };
  important?: boolean;
  reference?: string;
}

const MAX_ATTEMPTS = 3;
const RETRY_MINUTES = [1, 5, 30];
/** Messages with these placeholders hold a login code or a working link, so they are sent at once and never stored as written. */
const SECRET_KEYS = ["login.code", "reset.url", "verify.url"];
const MASK = "••••••";

type Template = typeof notificationTemplates.$inferSelect;
type Values = Record<string, string>;

// ---------------------------------------------------------------------------
// What goes into the messages
// ---------------------------------------------------------------------------

async function platformValues(db: Executor): Promise<Values> {
  const s = await getSettings("system", db);
  return { "platform.name": s.platformName, "portal.url": env.APP_URL };
}

async function personValues(db: Executor, userId: string) {
  const [u] = await db.select({ id: users.id, fullName: users.fullName, email: users.email, phone: users.phone, language: users.language }).from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return null;
  const [first, ...rest] = u.fullName.trim().split(/\s+/);
  return {
    user: u,
    values: { "student.firstName": first ?? "", "student.lastName": rest.join(" "), "student.fullName": u.fullName, "student.email": u.email, "student.phone": u.phone ?? "" } as Values,
  };
}

async function applicationValues(db: Executor, applicationInstitutionId: string): Promise<Values & { _applicantId?: string }> {
  const [a] = await db
    .select({
      number: applicationInstitutions.applicationNumber,
      reference: applicationInstitutions.reference,
      institution: institutions.name,
      applicantId: applications.applicantId,
      year: parameters.label,
    })
    .from(applicationInstitutions)
    .innerJoin(applications, eq(applications.id, applicationInstitutions.applicationId))
    .innerJoin(institutions, eq(institutions.id, applicationInstitutions.institutionId))
    .leftJoin(parameters, eq(parameters.id, applications.academicYearId))
    .where(eq(applicationInstitutions.id, applicationInstitutionId))
    .limit(1);
  if (!a) return {};
  // The admitted program once there is one, otherwise the first choice.
  const [admitted] = await db
    .select({ name: programs.name, number: admissions.admissionNumber })
    .from(admissions)
    .innerJoin(programs, eq(programs.id, admissions.programId))
    .where(eq(admissions.applicationInstitutionId, applicationInstitutionId))
    .limit(1);
  const [first] = admitted
    ? [admitted]
    : await db
        .select({ name: programs.name })
        .from(programChoices)
        .innerJoin(programs, eq(programs.id, programChoices.programId))
        .where(eq(programChoices.applicationInstitutionId, applicationInstitutionId))
        .orderBy(asc(programChoices.rank))
        .limit(1);
  return {
    "application.reference": a.number ?? a.reference,
    "application.program": first?.name ?? "",
    "institution.name": a.institution,
    academicYear: a.year ?? "",
    ...(admitted?.number ? { "admission.number": admitted.number } : {}),
    _applicantId: a.applicantId,
  };
}

function stringify(values: EventInput["values"]): Values {
  return Object.fromEntries(Object.entries(values ?? {}).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => [k, String(v)]));
}

/** Fills placeholders. One the template uses but the event has no value for comes out empty, not as "{{...}}". */
function render(text: string, values: Values): string {
  return renderText(text, values)
    .replace(/\{\{\s*[\w.]+\s*\}\}/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function mask(text: string, values: Values): string {
  let out = text;
  for (const k of SECRET_KEYS) if (values[k]) out = out.split(values[k]).join(MASK);
  return out;
}

/** The active template for each channel, in `language` where there is one, otherwise the English. */
async function activeTemplates(db: Executor, event: EventKey, language: "en" | "fr" = "en"): Promise<Map<string, Template>> {
  const rows = await db
    .select()
    .from(notificationTemplates)
    .where(and(eq(notificationTemplates.event, event), eq(notificationTemplates.status, "ACTIVE")));
  const out = new Map<string, Template>();
  for (const r of rows.filter((x) => x.language === "en")) out.set(r.channel, r);
  if (language !== "en") for (const r of rows.filter((x) => x.language === language)) out.set(r.channel, r);
  // Login details and links must reach the person even if administration switched the email off by mistake.
  if (EVENT_INDEX.get(event)?.required?.length && !out.has("EMAIL")) {
    const seed = SEED_TEMPLATES.find((t) => t.event === event && t.channel === "EMAIL" && t.language === language) ?? SEED_TEMPLATES.find((t) => t.event === event && t.channel === "EMAIL" && t.language === "en");
    if (seed) out.set("EMAIL", { ...seed, id: null as unknown as string, code: `${seed.code} (built-in)`, createdAt: new Date(), updatedAt: new Date(), updatedBy: null } as unknown as Template);
  }
  // A template that leaves out a required placeholder would send a message nobody can act on: add it at the end.
  for (const [channel, t] of out) {
    const missing = (EVENT_INDEX.get(event)?.required ?? []).filter((k) => !t.body.includes(`{{${k}}}`));
    if (missing.length && channel !== "IN_APP") out.set(channel, { ...t, body: `${t.body}\n\n${missing.map((k) => `{{${k}}}`).join("\n")}` });
  }
  return out;
}

interface Prepared {
  templates: Map<string, Template>;
  values: Values;
  person: Awaited<ReturnType<typeof personValues>>;
  applicantId?: string;
  settings: Awaited<ReturnType<typeof getSettings<"system">>>;
}

async function prepare(db: Executor, input: EventInput): Promise<Prepared> {
  const [platform, app, settings] = await Promise.all([
    platformValues(db),
    input.applicationId ? applicationValues(db, input.applicationId) : Promise.resolve({} as Values & { _applicantId?: string }),
    getSettings("system", db),
  ]);
  const { _applicantId, ...appValues } = app;
  // For a message to an institution, the student.* placeholders are the applicant's.
  const aboutUser = "userId" in input.to ? input.to.userId : _applicantId;
  const person = aboutUser ? await personValues(db, aboutUser) : null;
  // A message to a person is in their language; one to an institution or administration, in English.
  const templates = await activeTemplates(db, input.event, "userId" in input.to && person?.user.language === "fr" ? "fr" : "en");
  return { templates, settings, person, applicantId: _applicantId, values: { ...platform, ...(person?.values ?? {}), ...appValues, ...stringify(input.values) } };
}

function summarise(body: string): string {
  const line = body.split(/\n+/).find((l) => l.trim() && !/^(hello|dear)\b/i.test(l.trim())) ?? body;
  return line.length > 200 ? `${line.slice(0, 197)}…` : line;
}

// ---------------------------------------------------------------------------
// Raising an event
// ---------------------------------------------------------------------------

/**
 * Raises an event inside the transaction that caused it: the in-app
 * notification and the queued email and SMS land with the change, or not
 * at all. Sending happens after the request.
 */
export async function notifyEvent(tx: Executor, input: EventInput): Promise<{ notificationId: string | null }> {
  const def = EVENT_INDEX.get(input.event);
  const p = await prepare(tx, input);
  const notificationId = await createInApp(tx, input, p, def?.category);

  if ("userId" in input.to && p.person) {
    let queued = false;
    for (const channel of ["EMAIL", "SMS"] as const) {
      const t = p.templates.get(channel);
      if (!t) continue;
      const destination = channel === "EMAIL" ? p.person.user.email : p.person.user.phone ?? "";
      const off = channel === "EMAIL" ? !p.settings.emailEnabled : !p.settings.smsEnabled;
      const skip = off ? `${channel === "EMAIL" ? "Email" : "SMS"} is switched off in the system settings.` : !destination ? "No mobile number on the account." : null;
      await tx.insert(notificationDeliveries).values({
        id: newId("dlv"),
        notificationId,
        recipientUserId: p.person.user.id,
        institutionId: institutionOf(input),
        event: input.event,
        templateId: t.id,
        templateCode: t.code,
        templateVersion: t.version,
        channel,
        destination: destination || "—",
        subject: channel === "EMAIL" ? render(t.subject, p.values) : "",
        body: render(t.body, p.values),
        status: skip ? "SKIPPED" : "QUEUED",
        detail: skip,
        nextAttemptAt: skip ? null : new Date(),
      });
      queued ||= !skip;
    }
    if (queued) scheduleFlush();
  }
  return { notificationId };
}

function institutionOf(input: EventInput): string | null {
  return "institutionId" in input.to ? input.to.institutionId : null;
}

async function createInApp(db: Executor, input: EventInput, p: Prepared, category?: NotificationCategory, secret = false): Promise<string | null> {
  const t = p.templates.get("IN_APP");
  let title: string, body: string, summary: string;
  if (t) {
    title = render(t.subject, p.values);
    body = render(t.body, p.values);
    summary = summarise(body);
  } else if (input.inApp) {
    ({ title, summary } = input.inApp);
    body = input.inApp.body ?? input.inApp.summary;
  } else return null;
  if (secret) [title, body, summary] = [title, body, summary].map((x) => mask(x, p.values));

  const id = newId("ntf");
  const audience = "userId" in input.to ? (await audienceOf(db, input.to.userId)) : "institutionId" in input.to ? "institution" : "admin";
  await db.insert(notifications).values({
    id,
    audience,
    recipientUserId: "userId" in input.to ? input.to.userId : null,
    institutionId: "institutionId" in input.to ? input.to.institutionId : null,
    category: input.inApp?.category ?? category ?? "APPLICATION",
    title,
    summary,
    body,
    important: input.important ?? false,
    action: input.action ?? null,
    reference: input.reference ?? p.values["application.reference"] ?? null,
    templateCode: t?.code ?? null,
  });
  await db.insert(notificationDeliveries).values({
    id: newId("dlv"),
    notificationId: id,
    recipientUserId: "userId" in input.to ? input.to.userId : null,
    institutionId: institutionOf(input),
    event: input.event,
    templateId: t?.id ?? null,
    templateCode: t?.code ?? null,
    templateVersion: t?.version ?? null,
    channel: "IN_APP",
    destination: audience === "student" ? "Applicant portal" : audience === "institution" ? "Institution portal" : "Administration portal",
    subject: title,
    body,
    status: "DELIVERED",
    sentAt: new Date(),
  });
  return id;
}

async function audienceOf(db: Executor, userId: string): Promise<"student" | "institution" | "admin"> {
  const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  return u?.role === "AOSA_ADMIN" ? "admin" : u?.role === "STUDENT" || !u ? "student" : "institution";
}

export interface SendNowResult {
  /** What was sent, unmasked, outside production only: the registration screen shows it while there is no real provider. */
  devEmailPreview?: { to: string; subject: string; body: string };
  devSmsPreview?: { to: string; message: string };
  email: "SENT" | "FAILED" | "SKIPPED" | null;
}

/**
 * For messages that carry a login code or a working link: rendered, sent
 * now (outside any transaction), and recorded with those values masked.
 * They can't be retried from the record; the person asks again instead.
 */
export async function sendNow(input: EventInput): Promise<SendNowResult> {
  const db = getDb();
  const def = EVENT_INDEX.get(input.event);
  const p = await prepare(db, input);
  await createInApp(db, input, p, def?.category, true);
  const out: SendNowResult = { email: null };
  if (!("userId" in input.to) || !p.person) return out;

  for (const channel of ["EMAIL", "SMS"] as const) {
    const t = p.templates.get(channel);
    if (!t) continue;
    const destination = channel === "EMAIL" ? p.person.user.email : p.person.user.phone ?? "";
    const subject = channel === "EMAIL" ? render(t.subject, p.values) : "";
    const body = render(t.body, p.values);
    const off = channel === "EMAIL" ? !p.settings.emailEnabled && !def?.required?.length : !p.settings.smsEnabled;
    let status: "SENT" | "FAILED" | "SKIPPED" = "SENT";
    let detail: string | null = null;
    let providerRef: string | undefined;
    const provider = channel === "EMAIL" ? emailProvider() : smsProvider();
    if (off) [status, detail] = ["SKIPPED", "Switched off in the system settings."];
    else if (!destination) [status, detail] = ["SKIPPED", "No mobile number on the account."];
    else {
      try {
        providerRef =
          channel === "EMAIL"
            ? (await emailProvider().send({ to: destination, subject, text: body, fromName: p.settings.emailSenderName })).providerRef
            : (await smsProvider().send({ to: destination, text: body, senderId: p.settings.smsSenderId })).providerRef;
      } catch (err) {
        status = "FAILED";
        detail = err instanceof Error ? err.message.slice(0, 500) : "The provider refused the message.";
        logger.error("Notification send failed", { event: input.event, channel, err });
      }
    }
    await db.insert(notificationDeliveries).values({
      id: newId("dlv"),
      recipientUserId: p.person.user.id,
      event: input.event,
      templateId: t.id,
      templateCode: t.code,
      templateVersion: t.version,
      channel,
      destination: destination || "—",
      subject: mask(subject, p.values),
      body: mask(body, p.values),
      status,
      provider: status === "SKIPPED" ? null : provider.name,
      providerRef: providerRef ?? null,
      detail,
      attempts: status === "SKIPPED" ? 0 : 1,
      sentAt: status === "SENT" ? new Date() : null,
    });
    if (channel === "EMAIL") {
      out.email = status;
      if (env.NODE_ENV !== "production" && status === "SENT") out.devEmailPreview = { to: destination, subject, body };
    } else if (env.NODE_ENV !== "production" && status === "SENT") out.devSmsPreview = { to: destination, message: body };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sending what is queued
// ---------------------------------------------------------------------------

/** Sends after the current request has answered, when its transaction has committed. Outside a request, soon. */
export function scheduleFlush() {
  try {
    after(() => flushDeliveries().then(() => undefined));
  } catch {
    setTimeout(() => void flushDeliveries().catch((err) => logger.error("Notification flush failed", { err })), 50);
  }
}

/**
 * Sends queued email and SMS that are due, oldest first. Each is claimed
 * before sending, so two flushes at once never send the same message
 * twice. A failure is tried again after 1, then 5 minutes; after the third
 * attempt it stays FAILED, for administration to retry.
 */
export async function flushDeliveries(limit = 25): Promise<{ sent: number; failed: number; retrying: number }> {
  const db = getDb();
  const now = new Date();
  // Anything stuck mid-send (the server stopped) goes back in the queue.
  await db
    .update(notificationDeliveries)
    .set({ status: "QUEUED" })
    .where(and(eq(notificationDeliveries.status, "SENDING"), lt(notificationDeliveries.nextAttemptAt, new Date(now.getTime() - 10 * 60_000))));
  const due = await db
    .select({ id: notificationDeliveries.id })
    .from(notificationDeliveries)
    .where(and(eq(notificationDeliveries.status, "QUEUED"), or(isNull(notificationDeliveries.nextAttemptAt), lte(notificationDeliveries.nextAttemptAt, now))))
    .orderBy(asc(notificationDeliveries.at))
    .limit(limit);
  if (!due.length) return { sent: 0, failed: 0, retrying: 0 };
  const settings = await getSettings("system", db);
  const result = { sent: 0, failed: 0, retrying: 0 };

  for (const { id } of due) {
    const [d] = await db
      .update(notificationDeliveries)
      .set({ status: "SENDING", attempts: sql`${notificationDeliveries.attempts} + 1`, nextAttemptAt: new Date() })
      .where(and(eq(notificationDeliveries.id, id), eq(notificationDeliveries.status, "QUEUED")))
      .returning();
    if (!d) continue; // Another flush took it.
    const provider = d.channel === "EMAIL" ? emailProvider() : smsProvider();
    try {
      const { providerRef } =
        d.channel === "EMAIL"
          ? await emailProvider().send({ to: d.destination, subject: d.subject, text: d.body, fromName: settings.emailSenderName })
          : await smsProvider().send({ to: d.destination, text: d.body, senderId: settings.smsSenderId });
      await db
        .update(notificationDeliveries)
        .set({ status: "SENT", provider: provider.name, providerRef: providerRef ?? null, sentAt: new Date(), detail: null, nextAttemptAt: null })
        .where(eq(notificationDeliveries.id, id));
      result.sent++;
    } catch (err) {
      const detail = err instanceof Error ? err.message.slice(0, 500) : "The provider refused the message.";
      const last = d.attempts >= MAX_ATTEMPTS;
      await db
        .update(notificationDeliveries)
        .set({
          status: last ? "FAILED" : "QUEUED",
          provider: provider.name,
          detail,
          nextAttemptAt: last ? null : new Date(Date.now() + RETRY_MINUTES[d.attempts - 1] * 60_000),
        })
        .where(eq(notificationDeliveries.id, id));
      logger.warn("Notification send failed", { id, channel: d.channel, attempt: d.attempts, last, err: detail });
      if (last) result.failed++;
      else result.retrying++;
    }
  }
  return result;
}

/** Puts failed messages back in the queue to be sent again now. Messages that carried a login code or link can't be: the person asks again. */
export async function retryDeliveries(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const rows = await getDb()
    .update(notificationDeliveries)
    .set({ status: "QUEUED", attempts: 0, nextAttemptAt: new Date(), detail: null })
    .where(and(inArray(notificationDeliveries.id, ids), inArray(notificationDeliveries.status, ["FAILED"]), sql`${notificationDeliveries.body} NOT LIKE ${`%${MASK}%`}`))
    .returning({ id: notificationDeliveries.id });
  if (rows.length) scheduleFlush();
  return rows.length;
}
