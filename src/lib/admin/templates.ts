import { createCollection } from "./store";
import type { Audience, Channel, NotificationCategory } from "@/lib/notifications/center";

/**
 * Notification templates: the wording of every email, SMS and in-app
 * message the platform sends. Each template is tied to one event (what
 * triggers it) and one channel. Placeholders like {{student.firstName}}
 * are filled in when the message is sent; the preview fills them with
 * sample data.
 *
 * Rule enforced by the screens: at most one ACTIVE template per event and
 * channel, so it's never ambiguous which wording goes out.
 */

export type TemplateStatus = "ACTIVE" | "INACTIVE";

export interface NotificationTemplate {
  id: string;
  code: string;
  name: string;
  channel: Channel;
  event: string;
  /** Email subject, or in-app title. Unused for SMS. */
  subject: string;
  body: string;
  status: TemplateStatus;
  version: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

// ---------------------------------------------------------------------------
// Placeholders
// ---------------------------------------------------------------------------

export interface PlaceholderDef {
  key: string;
  label: string;
}

export const PLACEHOLDERS: PlaceholderDef[] = [
  { key: "student.firstName", label: "Student's first name" },
  { key: "student.lastName", label: "Student's last name" },
  { key: "student.fullName", label: "Student's full name" },
  { key: "student.email", label: "Student's email" },
  { key: "student.phone", label: "Student's phone" },
  { key: "platform.name", label: "Platform name" },
  { key: "portal.url", label: "Sign-in address" },
  { key: "login.code", label: "Temporary login code" },
  { key: "application.reference", label: "Application reference" },
  { key: "application.program", label: "Program applied for" },
  { key: "academicYear", label: "Academic year" },
  { key: "institution.name", label: "Institution name" },
  { key: "document.name", label: "Document name" },
  { key: "payment.amount", label: "Amount paid" },
  { key: "payment.method", label: "Payment method" },
  { key: "payment.reference", label: "Payment reference" },
  { key: "tuition.amount", label: "Tuition for the year" },
  { key: "tuition.outstanding", label: "Tuition still to pay" },
  { key: "reason", label: "Reason given by the reviewer" },
  { key: "deadline", label: "Deadline" },
];

const COMMON = ["student.firstName", "student.lastName", "student.fullName", "student.email", "student.phone", "platform.name", "portal.url"];
const APP = [...COMMON, "application.reference", "application.program", "institution.name", "academicYear"];

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export interface TemplateEvent {
  key: string;
  label: string;
  category: NotificationCategory;
  audience: Audience;
  placeholders: string[];
}

export const TEMPLATE_EVENTS: TemplateEvent[] = [
  { key: "registration.account_created", label: "Account created", category: "REGISTRATION", audience: "student", placeholders: [...COMMON, "login.code"] },
  { key: "registration.password_reset", label: "Password reset requested", category: "REGISTRATION", audience: "student", placeholders: [...COMMON, "login.code"] },
  { key: "application.submitted", label: "Application submitted", category: "APPLICATION", audience: "student", placeholders: APP },
  { key: "application.deadline_reminder", label: "Application deadline reminder", category: "APPLICATION", audience: "student", placeholders: [...APP, "deadline"] },
  { key: "payment.received", label: "Fee payment received", category: "PAYMENT", audience: "student", placeholders: [...APP, "payment.amount", "payment.method", "payment.reference"] },
  { key: "payment.failed", label: "Fee payment failed", category: "PAYMENT", audience: "student", placeholders: [...APP, "payment.amount", "payment.method"] },
  { key: "tuition.payment_recorded", label: "Tuition payment recorded", category: "PAYMENT", audience: "student", placeholders: [...APP, "payment.amount", "payment.method", "payment.reference", "tuition.outstanding"] },
  { key: "upload.received", label: "Document received", category: "UPLOAD", audience: "student", placeholders: [...APP, "document.name"] },
  { key: "verification.application_acknowledged", label: "Application acknowledged", category: "VERIFICATION", audience: "student", placeholders: APP },
  { key: "verification.documents_verified", label: "Documents verified", category: "VERIFICATION", audience: "student", placeholders: APP },
  { key: "verification.tuition_verified", label: "Tuition payment verified", category: "VERIFICATION", audience: "student", placeholders: [...APP, "payment.amount", "payment.reference", "tuition.amount", "tuition.outstanding"] },
  { key: "rejection.application_rejected", label: "Application rejected", category: "REJECTION", audience: "student", placeholders: [...APP, "reason"] },
  { key: "rejection.document_rejected", label: "Document rejected", category: "REJECTION", audience: "student", placeholders: [...APP, "document.name", "reason", "deadline"] },
  { key: "rejection.tuition_rejected", label: "Tuition payment rejected", category: "REJECTION", audience: "student", placeholders: [...APP, "payment.amount", "payment.reference", "reason"] },
  { key: "resubmission.requested", label: "Resubmission requested", category: "RESUBMISSION", audience: "student", placeholders: [...APP, "document.name", "reason", "deadline"] },
  { key: "resubmission.received", label: "Resubmission received", category: "RESUBMISSION", audience: "institution", placeholders: [...APP, "document.name"] },
  { key: "admission.offer", label: "Offer of admission", category: "ADMISSION", audience: "student", placeholders: [...APP, "tuition.amount", "deadline"] },
  { key: "admission.registration_open", label: "Registration open", category: "ADMISSION", audience: "student", placeholders: [...APP, "deadline"] },
];

export const EVENT_INDEX = new Map(TEMPLATE_EVENTS.map((e) => [e.key, e]));

// ---------------------------------------------------------------------------
// Sample data for previews
// ---------------------------------------------------------------------------

export interface SampleProfile {
  key: string;
  label: string;
  values: Record<string, string>;
}

const BASE = { "platform.name": "Cheeta AOSA", "portal.url": "https://aosa.cheeta.cm", academicYear: "2026/2027" };

export const SAMPLE_PROFILES: SampleProfile[] = [
  {
    key: "nadege",
    label: "Nadège Mbarga — Mont Fébé University",
    values: {
      ...BASE,
      "student.firstName": "Nadège",
      "student.lastName": "Mbarga",
      "student.fullName": "Nadège Mbarga",
      "student.email": "nadege.mbarga@example.cm",
      "student.phone": "+237 677 21 43 90",
      "login.code": "K7P-2QX",
      "application.reference": "APP-26-01042",
      "application.program": "BSc Computer Science",
      "institution.name": "Mont Fébé University",
      "document.name": "Birth certificate",
      "payment.amount": "200 000 XAF",
      "payment.method": "Bank deposit",
      "payment.reference": "AFB-77120394",
      "tuition.amount": "450 000 XAF",
      "tuition.outstanding": "250 000 XAF",
      reason: "The document can't be read",
      deadline: "12 Oct 2026",
    },
  },
  {
    key: "aissatou",
    label: "Aïssatou Hamadou — Sanaga Polytechnic Institute",
    values: {
      ...BASE,
      "student.firstName": "Aïssatou",
      "student.lastName": "Hamadou",
      "student.fullName": "Aïssatou Hamadou",
      "student.email": "a.hamadou@example.cm",
      "student.phone": "+237 690 55 18 07",
      "login.code": "M3R-9TZ",
      "application.reference": "APP-26-00388",
      "application.program": "HND Electrical Engineering",
      "institution.name": "Sanaga Polytechnic Institute",
      "document.name": "GCE A/L result slip",
      "payment.amount": "150 000 XAF",
      "payment.method": "Orange Money",
      "payment.reference": "OM-26-551873",
      "tuition.amount": "380 000 XAF",
      "tuition.outstanding": "230 000 XAF",
      reason: "No matching payment was found in our account",
      deadline: "20 Oct 2026",
    },
  },
];

// ---------------------------------------------------------------------------
// Rendering and checks
// ---------------------------------------------------------------------------

const TOKEN = /\{\{\s*([a-zA-Z][\w.]*)\s*\}\}/g;

export function placeholdersIn(text: string): string[] {
  return [...new Set([...text.matchAll(TOKEN)].map((m) => m[1]))];
}

export type RenderPart = { text: string; kind: "text" | "value" | "missing" };

/** Splits text into literal text and filled-in placeholders, for highlighting. */
export function renderParts(text: string, values: Record<string, string>): RenderPart[] {
  const out: RenderPart[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index), kind: "text" });
    const v = values[m[1]];
    out.push(v !== undefined ? { text: v, kind: "value" } : { text: m[0], kind: "missing" });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), kind: "text" });
  return out;
}

export function renderText(text: string, values: Record<string, string>): string {
  return renderParts(text, values)
    .map((p) => p.text)
    .join("");
}

// GSM 03.38 basic character set (plus the extension table, which costs 2).
const GSM_BASIC = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXT = "^{}\\[~]|€";

export interface SmsInfo {
  encoding: "GSM-7" | "Unicode";
  length: number;
  segments: number;
  perSegment: number;
  /** Characters forcing Unicode, if any. */
  offending: string[];
}

export function smsInfo(text: string): SmsInfo {
  const chars = [...text];
  const offending = [...new Set(chars.filter((c) => !GSM_BASIC.includes(c) && !GSM_EXT.includes(c)))];
  if (offending.length) {
    const length = chars.length;
    return { encoding: "Unicode", length, segments: length <= 70 ? 1 : Math.ceil(length / 67), perSegment: length <= 70 ? 70 : 67, offending };
  }
  const length = chars.reduce((n, c) => n + (GSM_EXT.includes(c) ? 2 : 1), 0);
  return { encoding: "GSM-7", length, segments: length <= 160 ? 1 : Math.ceil(length / 153), perSegment: length <= 160 ? 160 : 153, offending };
}

export const CHANNEL_LIMITS = { subjectEmail: 120, titleInApp: 80, bodyInApp: 600, smsMaxSegments: 4 };

// ---------------------------------------------------------------------------
// Seeds
// ---------------------------------------------------------------------------

const AT = "2026-03-02T08:30:00.000Z";

function t(
  code: string,
  name: string,
  channel: Channel,
  event: string,
  subject: string,
  body: string,
  opts: { inactive?: boolean; version?: number; updatedAt?: string; notes?: string } = {}
): NotificationTemplate {
  return {
    id: `tpl-${code.toLowerCase()}`,
    code,
    name,
    channel,
    event,
    subject,
    body,
    status: opts.inactive ? "INACTIVE" : "ACTIVE",
    version: opts.version ?? 1,
    notes: opts.notes ?? "",
    createdAt: AT,
    updatedAt: opts.updatedAt ?? AT,
    updatedBy: "Chantal Biya-Fouda",
  };
}

function seedTemplates(): NotificationTemplate[] {
  return [
    t("REG-WELCOME-EMAIL", "Welcome and login details", "EMAIL", "registration.account_created", "Your {{platform.name}} login details",
      "Hello {{student.firstName}},\n\nYour account on {{platform.name}} is ready.\n\nEmail: {{student.email}}\nTemporary login code: {{login.code}}\n\nSign in at {{portal.url}} and use this code as your password. You'll be asked to choose a new one.\n\nThe {{platform.name}} team", { version: 3, updatedAt: "2026-05-18T10:12:00.000Z" }),
    t("REG-WELCOME-SMS", "Welcome SMS", "SMS", "registration.account_created", "",
      "{{platform.name}}: your account is ready. Check {{student.email}} for your login details."),
    t("REG-RESET-EMAIL", "Password reset", "EMAIL", "registration.password_reset", "Reset your {{platform.name}} password",
      "Hello {{student.firstName}},\n\nSomeone asked to reset the password for {{student.email}}. Your reset code is {{login.code}}. It expires in 30 minutes.\n\nIf this wasn't you, ignore this email. Your password won't change."),
    t("APP-SUBMITTED-EMAIL", "Application submitted", "EMAIL", "application.submitted", "Application {{application.reference}} submitted to {{institution.name}}",
      "Hello {{student.firstName}},\n\nYour application {{application.reference}} for {{application.program}} has been submitted to {{institution.name}}.\n\nWe'll let you know when the institution acknowledges it. You can follow its progress at {{portal.url}}.", { version: 2, updatedAt: "2026-04-09T15:40:00.000Z" }),
    t("APP-SUBMITTED-INAPP", "Application submitted (in-app)", "IN_APP", "application.submitted", "Application submitted to {{institution.name}}",
      "Your application {{application.reference}} for {{application.program}} has been submitted. We'll tell you when {{institution.name}} acknowledges it."),
    t("APP-DEADLINE-SMS", "Deadline reminder SMS", "SMS", "application.deadline_reminder", "",
      "{{platform.name}}: applications for {{academicYear}} close on {{deadline}}. Add institutions and pay fees before then."),
    t("PAY-RECEIVED-EMAIL", "Fee payment receipt", "EMAIL", "payment.received", "Payment received: {{payment.amount}}",
      "Hello {{student.firstName}},\n\nWe've received {{payment.amount}} by {{payment.method}} (reference {{payment.reference}}) for application {{application.reference}} to {{institution.name}}.\n\nKeep this email as your receipt."),
    t("PAY-RECEIVED-SMS", "Fee payment SMS", "SMS", "payment.received", "",
      "{{platform.name}}: {{payment.amount}} received, ref {{payment.reference}}. Thank you."),
    t("PAY-FAILED-SMS", "Fee payment failed SMS", "SMS", "payment.failed", "",
      "{{platform.name}}: your {{payment.method}} payment of {{payment.amount}} didn't go through. No money was taken. Please try again."),
    t("TUI-RECORDED-INAPP", "Tuition payment recorded", "IN_APP", "tuition.payment_recorded", "Tuition payment recorded",
      "We've recorded your payment of {{payment.amount}} ({{payment.reference}}). {{institution.name}} will verify it before it counts towards your tuition."),
    t("UPLOAD-RECEIVED-INAPP", "Document received", "IN_APP", "upload.received", "{{document.name}} received",
      "We've received your {{document.name}} for {{institution.name}}. The institution will check it when it reviews your application."),
    t("VER-ACK-EMAIL", "Application acknowledged", "EMAIL", "verification.application_acknowledged", "{{institution.name}} is reviewing your application",
      "Hello {{student.firstName}},\n\n{{institution.name}} has acknowledged application {{application.reference}} and started reviewing it."),
    t("TUI-VERIFIED-SMS", "Tuition verified SMS", "SMS", "verification.tuition_verified", "",
      "{{platform.name}}: {{institution.name}} verified your tuition payment of {{payment.amount}}. Still to pay: {{tuition.outstanding}}."),
    t("TUI-VERIFIED-EMAIL", "Tuition verified email", "EMAIL", "verification.tuition_verified", "Tuition payment verified",
      "Hello {{student.firstName}},\n\n{{institution.name}} has verified your tuition payment of {{payment.amount}} (reference {{payment.reference}}).\n\nTuition for {{academicYear}}: {{tuition.amount}}\nStill to pay: {{tuition.outstanding}}"),
    t("APP-REJECTED-EMAIL", "Application not successful", "EMAIL", "rejection.application_rejected", "Your application to {{institution.name}}",
      "Hello {{student.firstName}},\n\nWe're sorry — {{institution.name}} can't offer you a place on {{application.program}}.\n\nReason: {{reason}}\n\nThis doesn't affect your other applications."),
    t("UPLOAD-REJECTED-EMAIL", "Document rejected", "EMAIL", "rejection.document_rejected", "Action needed: {{document.name}}",
      "Hello {{student.firstName}},\n\n{{institution.name}} couldn't accept your {{document.name}}: {{reason}}.\n\nUpload a new copy by {{deadline}} at {{portal.url}}."),
    t("TUI-REJECTED-EMAIL", "Tuition payment rejected", "EMAIL", "rejection.tuition_rejected", "We couldn't verify your tuition payment",
      "Hello {{student.firstName}},\n\n{{institution.name}} couldn't verify your payment of {{payment.amount}} (reference {{payment.reference}}).\n\nReason: {{reason}}\n\nCheck the details and record the payment again, or contact the institution's bursary."),
    t("RESUB-REQUEST-EMAIL", "Resubmission requested", "EMAIL", "resubmission.requested", "Please resubmit your {{document.name}}",
      "Hello {{student.firstName}},\n\n{{institution.name}} has asked you to resubmit your {{document.name}} by {{deadline}}.\n\nReason: {{reason}}"),
    t("RESUB-REQUEST-SMS", "Resubmission SMS (old wording)", "SMS", "resubmission.requested", "",
      "Cheeta: pls resubmit {{document.name}} b4 {{deadline}}.", { inactive: true, notes: "Replaced by the email version; kept for reference." }),
    t("ADM-OFFER-EMAIL", "Offer of admission", "EMAIL", "admission.offer", "Offer of admission — {{application.program}}",
      "Dear {{student.fullName}},\n\nCongratulations! {{institution.name}} is pleased to offer you a place on {{application.program}} for {{academicYear}}.\n\nTuition for the year is {{tuition.amount}}. To secure your place, pay at least the first instalment by {{deadline}} and record the payment in your portal.\n\nThe institution verifies every tuition payment before your registration is confirmed.", { version: 4, updatedAt: "2026-08-21T09:05:00.000Z" }),
    t("ADM-OFFER-SMS", "Offer of admission SMS", "SMS", "admission.offer", "",
      "{{platform.name}}: congratulations {{student.firstName}}! {{institution.name}} has offered you a place. Details at {{portal.url}}"),
    t("ADM-OFFER-INAPP", "Offer of admission (in-app)", "IN_APP", "admission.offer", "Offer of admission from {{institution.name}}",
      "{{application.program}}, {{academicYear}} intake. Pay your first tuition instalment by {{deadline}} to secure your place."),
  ];
}

export const templateStore = createCollection<NotificationTemplate>("notification-templates", seedTemplates);

export function eventLabel(key: string) {
  return EVENT_INDEX.get(key)?.label ?? key;
}

/** The other ACTIVE template for the same event and channel, if any. */
export function activeConflict(all: NotificationTemplate[], t: Pick<NotificationTemplate, "id" | "event" | "channel">) {
  return all.find((o) => o.id !== t.id && o.status === "ACTIVE" && o.event === t.event && o.channel === t.channel);
}
