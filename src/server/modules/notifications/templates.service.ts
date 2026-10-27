import "server-only";
import { and, asc, eq, ilike, ne, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { NextRequest } from "next/server";
import type { PublicUser } from "@/lib/auth/users";
import { CHANNEL_LIMITS, EVENT_INDEX, PLACEHOLDERS, placeholdersIn, smsInfo } from "@/lib/admin/templates";
import { getDb, type Executor } from "@/server/db/client";
import { notificationTemplates, users } from "@/server/db/schema";
import { newId } from "@/server/db/ids";
import { audit } from "@/server/audit/audit";
import { ConflictError, NotFoundError, ValidationError } from "@/server/http/errors";
import { parseQuery, parseWith, requiredText, text } from "@/server/http/validate";

/**
 * Notification templates: the wording of every email, SMS and in-app
 * message, one per event and channel. Rules kept here, whatever screen or
 * client sends the change:
 *
 * - the event is one the platform raises, and the placeholders are ones
 *   that event fills; the ones it must carry (a login code) are there;
 * - at most one ACTIVE template per event and channel, so it is never
 *   ambiguous which wording goes out. Activating one with
 *   `replaceActive: true` deactivates the other in the same change;
 * - changing the wording makes a new version. Each message records the
 *   template and version it was written from.
 */

const CHANNELS = ["IN_APP", "EMAIL", "SMS"] as const;
const PLACEHOLDER_KEYS = new Set(PLACEHOLDERS.map((p) => p.key));

const createSchema = z.object({
  code: requiredText(60).transform((v) => v.toUpperCase()).pipe(z.string().regex(/^[A-Z0-9-]+$/, "Use capital letters, digits and hyphens only.")),
  name: requiredText(200),
  channel: z.enum(CHANNELS),
  event: requiredText(100),
  language: z.enum(["en", "fr"]).default("en"),
  subject: text(200).default(""),
  body: requiredText(5000),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  notes: text(1000).default(""),
  replaceActive: z.boolean().optional(),
});

const updateSchema = z.object({
  name: requiredText(200).optional(),
  subject: text(200).optional(),
  body: requiredText(5000).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  notes: text(1000).optional(),
  replaceActive: z.boolean().optional(),
});

type Row = typeof notificationTemplates.$inferSelect;

function checkContent(t: Pick<Row, "event" | "channel" | "subject" | "body">) {
  const ev = EVENT_INDEX.get(t.event);
  if (!ev) throw new ValidationError({ event: "Choose when this message is sent." });
  const errors: Record<string, string> = {};
  const used = placeholdersIn(`${t.channel === "SMS" ? "" : t.subject}\n${t.body}`);
  const unknown = used.filter((k) => !PLACEHOLDER_KEYS.has(k));
  const notForEvent = used.filter((k) => PLACEHOLDER_KEYS.has(k) && !ev.placeholders.includes(k));
  const missing = (ev.required ?? []).filter((k) => !used.includes(k));
  if (t.channel !== "SMS" && !t.subject.trim()) errors.subject = t.channel === "EMAIL" ? "Enter a subject line." : "Enter a title.";
  else if (t.channel === "EMAIL" && t.subject.length > CHANNEL_LIMITS.subjectEmail) errors.subject = `Keep it to ${CHANNEL_LIMITS.subjectEmail} characters or fewer.`;
  else if (t.channel === "IN_APP" && t.subject.length > CHANNEL_LIMITS.titleInApp) errors.subject = `Keep it to ${CHANNEL_LIMITS.titleInApp} characters or fewer.`;
  if (unknown.length) errors.body = `Unknown placeholder${unknown.length > 1 ? "s" : ""}: ${unknown.map((k) => `{{${k}}}`).join(", ")}.`;
  else if (notForEvent.length) errors.body = `${notForEvent.map((k) => `{{${k}}}`).join(", ")} ${notForEvent.length > 1 ? "aren't" : "isn't"} available for “${ev.label}”.`;
  else if (missing.length && t.channel !== "IN_APP") errors.body = `This message must include ${missing.map((k) => `{{${k}}}`).join(", ")}.`;
  else if (t.channel === "IN_APP" && t.body.length > CHANNEL_LIMITS.bodyInApp) errors.body = `In-app messages are limited to ${CHANNEL_LIMITS.bodyInApp} characters.`;
  else if (t.channel === "SMS" && smsInfo(t.body).segments > CHANNEL_LIMITS.smsMaxSegments) errors.body = `This SMS would be sent as more than ${CHANNEL_LIMITS.smsMaxSegments} messages. Shorten it.`;
  if (Object.keys(errors).length) throw new ValidationError(errors);
}

/** Makes sure `t` can be active: refuses if another is, or with `replace` deactivates that one. */
async function claimActive(tx: Executor, t: Pick<Row, "id" | "event" | "channel" | "language">, replace: boolean | undefined, actorId: string) {
  const [other] = await tx
    .select()
    .from(notificationTemplates)
    .where(and(eq(notificationTemplates.event, t.event), eq(notificationTemplates.channel, t.channel), eq(notificationTemplates.language, t.language), eq(notificationTemplates.status, "ACTIVE"), ne(notificationTemplates.id, t.id)))
    .limit(1);
  if (!other) return;
  if (!replace) throw new ValidationError({ status: `${other.name} is already active for this event on this channel in this language. Deactivate it first, or replace it.` });
  await tx.update(notificationTemplates).set({ status: "INACTIVE", updatedBy: actorId }).where(eq(notificationTemplates.id, other.id));
  await audit(tx, { action: "status", entityType: "notification-template", entityId: other.id, before: { status: "ACTIVE" }, after: { status: "INACTIVE", replacedBy: t.id } });
}

function select(db: Executor) {
  return db.select({ t: notificationTemplates, updatedByName: users.fullName }).from(notificationTemplates).leftJoin(users, eq(users.id, notificationTemplates.updatedBy));
}

const present = (r: { t: Row; updatedByName: string | null }) => ({ ...r.t, updatedByName: r.updatedByName ?? "" });

const listQuery = z.object({
  event: z.string().max(100).optional(),
  channel: z.enum(CHANNELS).optional(),
  language: z.enum(["en", "fr"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  q: z.string().trim().max(100).optional(),
});

export async function listTemplates(req: NextRequest) {
  const q = parseQuery(req, listQuery);
  const conditions: (SQL | undefined)[] = [
    q.event ? eq(notificationTemplates.event, q.event) : undefined,
    q.channel ? eq(notificationTemplates.channel, q.channel) : undefined,
    q.language ? eq(notificationTemplates.language, q.language) : undefined,
    q.status ? eq(notificationTemplates.status, q.status) : undefined,
    q.q ? or(ilike(notificationTemplates.name, `%${q.q}%`), ilike(notificationTemplates.code, `%${q.q}%`), ilike(notificationTemplates.body, `%${q.q}%`)) : undefined,
  ];
  const rows = await select(getDb())
    .where(and(...conditions))
    .orderBy(asc(notificationTemplates.event), asc(notificationTemplates.channel), asc(notificationTemplates.language), asc(notificationTemplates.code));
  return { data: rows.map(present), meta: { page: 1, pageSize: rows.length, total: rows.length } };
}

export async function getTemplate(id: string) {
  const [row] = await select(getDb()).where(eq(notificationTemplates.id, id)).limit(1);
  if (!row) throw new NotFoundError("Template");
  return present(row);
}

export async function createTemplate(user: PublicUser, input: unknown) {
  const v = parseWith(createSchema, input);
  checkContent(v);
  const id = newId("tpl");
  await getDb().transaction(async (tx) => {
    if (v.status === "ACTIVE") await claimActive(tx, { id, event: v.event, channel: v.channel, language: v.language }, v.replaceActive, user.id);
    const [inserted] = await tx
      .insert(notificationTemplates)
      .values({ id, code: v.code, name: v.name, channel: v.channel, event: v.event, language: v.language, subject: v.channel === "SMS" ? "" : v.subject, body: v.body, status: v.status, notes: v.notes, version: 1, updatedBy: user.id })
      .onConflictDoNothing({ target: notificationTemplates.code })
      .returning();
    if (!inserted) throw new ConflictError("Another template already uses this code.", { field: "code" });
    await audit(tx, { action: "create", entityType: "notification-template", entityId: id, after: { code: v.code, event: v.event, channel: v.channel, language: v.language, status: v.status } });
  });
  return getTemplate(id);
}

/** Event, channel, language and code are fixed once created: a different event or channel is a different template. */
export async function updateTemplate(user: PublicUser, id: string, input: unknown) {
  const v = parseWith(updateSchema, input);
  await getDb().transaction(async (tx) => {
    const [before] = await tx.select().from(notificationTemplates).where(eq(notificationTemplates.id, id)).limit(1);
    if (!before) throw new NotFoundError("Template");
    const next = { ...before, ...Object.fromEntries(Object.entries(v).filter(([k, x]) => x !== undefined && k !== "replaceActive")) } as Row;
    if (next.channel === "SMS") next.subject = "";
    checkContent(next);
    const wordingChanged = next.subject !== before.subject || next.body !== before.body;
    if (next.status === "ACTIVE" && before.status !== "ACTIVE") await claimActive(tx, before, v.replaceActive, user.id);
    await tx
      .update(notificationTemplates)
      .set({ name: next.name, subject: next.subject, body: next.body, status: next.status, notes: next.notes, version: wordingChanged ? before.version + 1 : before.version, updatedBy: user.id })
      .where(eq(notificationTemplates.id, id));
    await audit(tx, {
      action: v.status && v.status !== before.status && !wordingChanged ? "status" : "update",
      entityType: "notification-template",
      entityId: id,
      before: { status: before.status, version: before.version, subject: before.subject, body: before.body },
      after: { status: next.status, version: wordingChanged ? before.version + 1 : before.version, subject: next.subject, body: next.body },
    });
  });
  return getTemplate(id);
}
