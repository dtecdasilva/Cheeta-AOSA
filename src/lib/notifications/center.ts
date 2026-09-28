import { useCallback, useEffect, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { createCollection, mockAnchor } from "@/lib/admin/store";

/**
 * Notification centre data for all three portals.
 *
 * Mock notifications are seeded per audience (student, institution,
 * admin) and kept in the shared client store, so read / unread / archive
 * state survives a refresh. Notifications the student portal raises for
 * real (AppContext, e.g. "Application submitted") are copied in by
 * useNotifications("student"), so one centre shows both.
 *
 * Replacing this with an API later means swapping the store for fetches;
 * the hook's shape stays the same.
 */

export type NotificationCategory =
  | "REGISTRATION"
  | "APPLICATION"
  | "PAYMENT"
  | "UPLOAD"
  | "VERIFICATION"
  | "REJECTION"
  | "RESUBMISSION"
  | "ADMISSION";

export type Audience = "student" | "institution" | "admin";
export type Channel = "IN_APP" | "EMAIL" | "SMS";
export type DeliveryStatus = "DELIVERED" | "SENT" | "FAILED";

export const CATEGORY_META: Record<NotificationCategory, { label: string; description: string; tone: "neutral" | "info" | "amber" | "success" | "danger" }> = {
  REGISTRATION: { label: "Registration", description: "Account creation and sign-in details", tone: "neutral" },
  APPLICATION: { label: "Application", description: "Starting, completing and submitting applications", tone: "info" },
  PAYMENT: { label: "Payment", description: "Fees and tuition payments", tone: "info" },
  UPLOAD: { label: "Upload", description: "Documents received", tone: "neutral" },
  VERIFICATION: { label: "Verification", description: "Applications, documents and payments checked", tone: "success" },
  REJECTION: { label: "Rejection", description: "Something was not accepted", tone: "danger" },
  RESUBMISSION: { label: "Resubmission", description: "Corrections requested or received", tone: "amber" },
  ADMISSION: { label: "Admission", description: "Offers and next steps after admission", tone: "success" },
};

export const CATEGORIES = Object.keys(CATEGORY_META) as NotificationCategory[];

export const CHANNEL_LABELS: Record<Channel, string> = { IN_APP: "In-app", EMAIL: "Email", SMS: "SMS" };

export interface Delivery {
  channel: Channel;
  to: string;
  status: DeliveryStatus;
  at: string;
  detail?: string;
}

export type HistoryKind = "CREATED" | "DELIVERED" | "FAILED" | "READ" | "UNREAD" | "ARCHIVED" | "RESTORED";

export interface HistoryEvent {
  kind: HistoryKind;
  at: string;
  channel?: Channel;
  note?: string;
}

export interface CentreNotification {
  id: string;
  audience: Audience;
  category: NotificationCategory;
  title: string;
  /** One line for the list. */
  summary: string;
  /** Full message; blank lines separate paragraphs. */
  body: string;
  createdAt: string;
  readAt: string | null;
  archivedAt: string | null;
  important: boolean;
  action?: { label: string; href: string };
  reference?: string;
  institutionName?: string;
  templateCode?: string;
  deliveries: Delivery[];
  history: HistoryEvent[];
}

// ---------------------------------------------------------------------------
// Seeds
// ---------------------------------------------------------------------------

const HOUR = 3_600_000;

type SeedInput = Omit<CentreNotification, "id" | "audience" | "createdAt" | "readAt" | "archivedAt" | "deliveries" | "history"> & {
  hoursAgo: number;
  /** Hours after creation it was read; omit for unread. */
  readAfter?: number;
  archivedAfter?: number;
  channels: Channel[];
  failed?: Channel;
};

const CONTACT: Record<Audience, Record<Channel, string>> = {
  student: { IN_APP: "Student portal", EMAIL: "nadege.mbarga@example.cm", SMS: "+237 677 21 43 90" },
  institution: { IN_APP: "Institution portal", EMAIL: "admissions@montfebe.cm", SMS: "+237 699 10 20 30" },
  admin: { IN_APP: "Administration portal", EMAIL: "root@aosa.cheeta.local", SMS: "+237 655 00 11 22" },
};

function build(audience: Audience, rows: SeedInput[]): CentreNotification[] {
  // Relative to UTC midnight so server and browser seeds match exactly.
  const anchor = mockAnchor().getTime();
  return rows.map((r, i) => {
    const created = anchor - r.hoursAgo * HOUR;
    const iso = (t: number) => new Date(t).toISOString();
    const deliveries: Delivery[] = r.channels.map((channel, k) => {
      const at = created + (k + 1) * 45_000;
      const failed = r.failed === channel;
      return {
        channel,
        to: CONTACT[audience][channel],
        status: failed ? "FAILED" : channel === "SMS" ? "SENT" : "DELIVERED",
        at: iso(at),
        detail: failed ? "Handset unreachable after 3 attempts" : undefined,
      };
    });
    const history: HistoryEvent[] = [{ kind: "CREATED", at: iso(created), note: r.templateCode ? `From template ${r.templateCode}` : undefined }];
    deliveries.forEach((d) =>
      history.push({ kind: d.status === "FAILED" ? "FAILED" : "DELIVERED", at: d.at, channel: d.channel, note: d.detail })
    );
    const readAt = r.readAfter !== undefined ? iso(created + r.readAfter * HOUR) : null;
    if (readAt) history.push({ kind: "READ", at: readAt });
    const archivedAt = r.archivedAfter !== undefined ? iso(created + r.archivedAfter * HOUR) : null;
    if (archivedAt) history.push({ kind: "ARCHIVED", at: archivedAt });

    const { hoursAgo: _h, readAfter: _r, archivedAfter: _a, channels: _c, failed: _f, ...rest } = r;
    void _h; void _r; void _a; void _c; void _f;
    return {
      ...rest,
      id: `ntf-${audience}-${String(i + 1).padStart(3, "0")}`,
      audience,
      createdAt: iso(created),
      readAt,
      archivedAt,
      deliveries,
      history,
    };
  });
}

const MFU = "Mont Fébé University";
const SPI = "Sanaga Polytechnic Institute";

function studentSeed(): SeedInput[] {
  return [
    {
      category: "REGISTRATION", title: "Welcome to Cheeta AOSA", summary: "Your applicant account is ready.",
      body: "Hello Nadège,\n\nYour account on the Cheeta Academia Online School Application Platform is ready. You can now start an application, add institutions and upload your documents.\n\nKeep your temporary login code private. You'll be asked to change it the first time you sign in.",
      important: false, hoursAgo: 58 * 24, readAfter: 0.2, archivedAfter: 72, channels: ["IN_APP", "EMAIL", "SMS"], templateCode: "REG-WELCOME-EMAIL",
    },
    {
      category: "REGISTRATION", title: "Email address confirmed", summary: "You'll receive updates at nadege.mbarga@example.cm.",
      body: "Your email address has been confirmed. Application updates, payment receipts and admission offers will be sent there as well as to this notification centre.",
      important: false, hoursAgo: 58 * 24 - 1, readAfter: 1, archivedAfter: 72, channels: ["IN_APP", "EMAIL"],
    },
    {
      category: "APPLICATION", title: "Application started", summary: "Application APP-26-01042 has been created.",
      body: "You've started application APP-26-01042 for the 2026/2027 intake. Complete the demographic, education, examination and results steps, then add the institutions you want to apply to.",
      important: false, hoursAgo: 50 * 24, readAfter: 0.1, channels: ["IN_APP"], reference: "APP-26-01042", action: { label: "Continue application", href: "/student/application/summary" },
    },
    {
      category: "UPLOAD", title: "Birth certificate received", summary: `Uploaded for ${MFU}.`,
      body: `We've received your birth certificate for ${MFU}. The institution will check it when it reviews your application.`,
      important: false, hoursAgo: 47 * 24, readAfter: 2, channels: ["IN_APP"], reference: "APP-26-01042", institutionName: MFU, templateCode: "UPLOAD-RECEIVED-INAPP",
    },
    {
      category: "PAYMENT", title: "Payment failed", summary: "Your MTN Mobile Money payment of 17 500 XAF didn't go through.",
      body: "Your MTN Mobile Money payment of 17 500 XAF for application APP-26-01042 was declined by the operator. No money was taken from your account.\n\nYou can try again or choose a different payment method.",
      important: true, hoursAgo: 46 * 24, readAfter: 0.5, archivedAfter: 30, channels: ["IN_APP", "SMS"], reference: "APP-26-01042", action: { label: "View payment options", href: "/student/fees/payment-options" },
    },
    {
      category: "PAYMENT", title: "Payment received", summary: "17 500 XAF for application and web fees.",
      body: `We've received 17 500 XAF by Orange Money (reference OM-26-884120): 15 000 XAF application fee for ${MFU} and 2 500 XAF web processing fee.\n\nKeep this message as your receipt.`,
      important: false, hoursAgo: 45 * 24 + 3, readAfter: 1, channels: ["IN_APP", "EMAIL", "SMS"], reference: "APP-26-01042", institutionName: MFU, templateCode: "PAY-RECEIVED-EMAIL", action: { label: "View fee summary", href: "/student/fees/summary" },
    },
    {
      category: "APPLICATION", title: `Application submitted to ${MFU}`, summary: "The institution will acknowledge it within 5 working days.",
      body: `Your application APP-26-01042 has been submitted to ${MFU} for BSc Computer Science. You can't change it now unless the institution asks you to.\n\nWe'll let you know as soon as the institution acknowledges it.`,
      important: false, hoursAgo: 45 * 24, readAfter: 1, channels: ["IN_APP", "EMAIL"], reference: "APP-26-01042", institutionName: MFU, templateCode: "APP-SUBMITTED-EMAIL", action: { label: "Track status", href: "/student/application/status" },
    },
    {
      category: "VERIFICATION", title: `${MFU} acknowledged your application`, summary: "Your application is now under review.",
      body: `${MFU} has acknowledged application APP-26-01042 and started reviewing it. Reviewers check your documents first, then your results.`,
      important: false, hoursAgo: 40 * 24, readAfter: 5, channels: ["IN_APP", "EMAIL"], reference: "APP-26-01042", institutionName: MFU, templateCode: "VER-ACK-EMAIL",
    },
    {
      category: "REJECTION", title: "Document rejected: Birth certificate", summary: "The document can't be read.",
      body: `${MFU} couldn't accept your birth certificate: the document can't be read.\n\nScan it again in good light, check every word is legible, and upload it within 14 days. Your application stays under review in the meantime.`,
      important: true, hoursAgo: 38 * 24 + 2, readAfter: 3, channels: ["IN_APP", "EMAIL", "SMS"], failed: "SMS", reference: "APP-26-01042", institutionName: MFU, templateCode: "UPLOAD-REJECTED-EMAIL", action: { label: "Upload again", href: "/student/institutions/upload" },
    },
    {
      category: "RESUBMISSION", title: "Resubmission requested", summary: "Upload a new birth certificate by the deadline.",
      body: `${MFU} has asked you to resubmit your birth certificate. You have 14 days. After that the institution may decide on your application without it.`,
      important: true, hoursAgo: 38 * 24, readAfter: 3, channels: ["IN_APP", "EMAIL"], reference: "APP-26-01042", institutionName: MFU, templateCode: "RESUB-REQUEST-EMAIL", action: { label: "Upload again", href: "/student/institutions/upload" },
    },
    {
      category: "RESUBMISSION", title: "Resubmission received", summary: `Your new birth certificate was sent to ${MFU}.`,
      body: `Thanks — your new birth certificate has been sent to ${MFU}. The reviewer who asked for it has been told.`,
      important: false, hoursAgo: 35 * 24, readAfter: 0.1, channels: ["IN_APP"], reference: "APP-26-01042", institutionName: MFU,
    },
    {
      category: "VERIFICATION", title: "Documents verified", summary: `${MFU} has verified all your documents.`,
      body: `All the documents on application APP-26-01042 have been verified by ${MFU}. The admissions committee will now consider your results.`,
      important: false, hoursAgo: 30 * 24, readAfter: 12, channels: ["IN_APP", "EMAIL"], reference: "APP-26-01042", institutionName: MFU,
    },
    {
      category: "APPLICATION", title: `Application submitted to ${SPI}`, summary: "HND Electrical Engineering.",
      body: `Your application APP-26-01042 has also been submitted to ${SPI} for HND Electrical Engineering.`,
      important: false, hoursAgo: 28 * 24, readAfter: 2, channels: ["IN_APP", "EMAIL"], reference: "APP-26-01042", institutionName: SPI, templateCode: "APP-SUBMITTED-EMAIL",
    },
    {
      category: "REJECTION", title: `Application to ${SPI} not successful`, summary: "The program has no places left.",
      body: `We're sorry — ${SPI} can't offer you a place on HND Electrical Engineering this year because the program has no places left.\n\nThis doesn't affect your other applications.`,
      important: true, hoursAgo: 12 * 24, readAfter: 4, channels: ["IN_APP", "EMAIL", "SMS"], reference: "APP-26-01042", institutionName: SPI, templateCode: "APP-REJECTED-EMAIL",
    },
    {
      category: "APPLICATION", title: "Applications close in 7 days", summary: "You can still add institutions until 31 October.",
      body: "Applications for the 2026/2027 intake close on 31 October. If you'd like to apply to more institutions, add them and pay their fees before then.",
      important: false, hoursAgo: 9 * 24, channels: ["IN_APP", "EMAIL"], action: { label: "Add an institution", href: "/student/institutions/add" },
    },
    {
      category: "ADMISSION", title: `Offer of admission from ${MFU}`, summary: "BSc Computer Science, 2026/2027 intake.",
      body: `Congratulations! ${MFU} has offered you a place on BSc Computer Science for the 2026/2027 academic year.\n\nTo secure your place, pay at least the first tuition instalment and upload your receipt. The institution verifies every tuition payment before your registration is confirmed.`,
      important: true, hoursAgo: 6 * 24, readAfter: 0.3, channels: ["IN_APP", "EMAIL", "SMS"], reference: "APP-26-01042", institutionName: MFU, templateCode: "ADM-OFFER-EMAIL", action: { label: "View tuition", href: "/student/tuition" },
    },
    {
      category: "PAYMENT", title: "Tuition payment recorded", summary: "200 000 XAF by bank deposit, awaiting verification.",
      body: `We've recorded your tuition payment of 200 000 XAF (bank slip AFB-77120394) for ${MFU}. It isn't counted towards your balance until the institution verifies it.`,
      important: false, hoursAgo: 3 * 24, readAfter: 1, channels: ["IN_APP", "EMAIL"], reference: "APP-26-01042", institutionName: MFU, action: { label: "View tuition", href: "/student/tuition" },
    },
    {
      category: "ADMISSION", title: "Registration opens for admitted students", summary: "Complete your registration by 15 November.",
      body: `${MFU} opens registration for admitted students on 1 November. Your tuition must be at least partly verified before you can register.`,
      important: false, hoursAgo: 2 * 24, channels: ["IN_APP", "EMAIL"], institutionName: MFU,
    },
    {
      category: "VERIFICATION", title: "Tuition payment verified", summary: "200 000 XAF now counts towards your tuition.",
      body: `${MFU} has verified your tuition payment of 200 000 XAF. Your outstanding tuition is now 250 000 XAF.`,
      important: false, hoursAgo: 20, channels: ["IN_APP", "EMAIL", "SMS"], reference: "APP-26-01042", institutionName: MFU, templateCode: "TUI-VERIFIED-SMS", action: { label: "View tuition", href: "/student/tuition" },
    },
    {
      category: "UPLOAD", title: "Medical certificate received", summary: `Uploaded for ${MFU} registration.`,
      body: `We've received your medical certificate. ${MFU} will check it as part of your registration.`,
      important: false, hoursAgo: 4, channels: ["IN_APP"], institutionName: MFU, templateCode: "UPLOAD-RECEIVED-INAPP",
    },
  ];
}

function institutionSeed(): SeedInput[] {
  return [
    { category: "REGISTRATION", title: "Staff account created", summary: "Admission officer account for Brenda Ngwa.", body: "An admission officer account has been created for Brenda Ngwa (b.ngwa@montfebe.cm). She'll receive her sign-in details by email.", important: false, hoursAgo: 40 * 24, readAfter: 2, archivedAfter: 48, channels: ["IN_APP", "EMAIL"], action: { label: "View staff", href: "/institution/staff" } },
    { category: "APPLICATION", title: "14 new applications this week", summary: "BSc Computer Science received the most (6).", body: "You received 14 new applications in the last 7 days: 6 for BSc Computer Science, 4 for BSc Management, 3 for LLB Law and 1 for BSc Biology.", important: false, hoursAgo: 7 * 24, readAfter: 3, channels: ["IN_APP", "EMAIL"], action: { label: "Review applications", href: "/institution/applications" } },
    { category: "PAYMENT", title: "Application fees received", summary: "9 payments totalling 135 000 XAF.", body: "9 application fee payments totalling 135 000 XAF were confirmed yesterday. They are included in your next settlement.", important: false, hoursAgo: 6 * 24, readAfter: 20, channels: ["IN_APP"] },
    { category: "UPLOAD", title: "Documents waiting for review", summary: "23 uploaded documents haven't been reviewed.", body: "23 documents uploaded by applicants are waiting for review. The oldest was uploaded 4 days ago.", important: false, hoursAgo: 5 * 24, readAfter: 1, channels: ["IN_APP"], action: { label: "Review applications", href: "/institution/applications" } },
    { category: "RESUBMISSION", title: "Applicant resubmitted a document", summary: "Nadège Mbarga uploaded a new birth certificate.", body: "Nadège Mbarga (APP-26-01042) resubmitted her birth certificate after it was rejected as illegible. It's ready for review.", important: false, hoursAgo: 35 * 24, readAfter: 4, channels: ["IN_APP"], reference: "APP-26-01042" },
    { category: "REJECTION", title: "Payment rejected by AOSA", summary: "A tuition receipt was flagged as a duplicate.", body: "The AOSA administration rejected a tuition payment record (reference MTN-26-5530021) because the reference had already been used on another account. The student has been told.", important: true, hoursAgo: 4 * 24, readAfter: 6, channels: ["IN_APP", "EMAIL"], action: { label: "Open tuition verification", href: "/institution/tuition" } },
    { category: "ADMISSION", title: "Offer accepted", summary: "Nadège Mbarga accepted BSc Computer Science.", body: "Nadège Mbarga has accepted your offer for BSc Computer Science. Tuition verification is the next step.", important: false, hoursAgo: 5 * 24, readAfter: 1, channels: ["IN_APP"], reference: "APP-26-01042" },
    { category: "VERIFICATION", title: "Tuition payments to verify", summary: "7 tuition payments are waiting for you.", body: "7 tuition payments from admitted students are waiting for verification. Your target is 3 working days; 2 are already older than that.", important: true, hoursAgo: 26, channels: ["IN_APP", "EMAIL"], action: { label: "Open tuition verification", href: "/institution/tuition" } },
    { category: "PAYMENT", title: "New tuition payment recorded", summary: "Aïssatou Bello recorded 150 000 XAF by Orange Money.", body: "Aïssatou Bello recorded a tuition payment of 150 000 XAF by Orange Money. Check it against your account statement before verifying.", important: false, hoursAgo: 5, channels: ["IN_APP"], action: { label: "Open tuition verification", href: "/institution/tuition" } },
  ];
}

function adminSeed(): SeedInput[] {
  return [
    { category: "REGISTRATION", title: "New institution registered", summary: "Limbe Nautical School was added and is inactive.", body: "Limbe Nautical School was added by an administrator and is inactive until its accreditation is checked.", important: false, hoursAgo: 30 * 24, readAfter: 1, archivedAfter: 24, channels: ["IN_APP", "EMAIL"], action: { label: "View institutions", href: "/admin/institutions" } },
    { category: "REGISTRATION", title: "Registrations up 18% this week", summary: "63 new student accounts in 7 days.", body: "63 students registered in the last 7 days, 18% more than the week before. Most came from the Centre and Littoral regions.", important: false, hoursAgo: 7 * 24, readAfter: 5, channels: ["IN_APP", "EMAIL"], action: { label: "Student summary", href: "/admin/students/summary" } },
    { category: "APPLICATION", title: "Submission peak expected", summary: "Applications close on 31 October.", body: "Past intakes saw 40% of applications submitted in the final 10 days. Check that payment methods and templates are ready.", important: false, hoursAgo: 10 * 24, readAfter: 30, channels: ["IN_APP"] },
    { category: "PAYMENT", title: "3 failed payments in the last hour", summary: "All through MTN Mobile Money.", body: "3 application-fee payments failed through MTN Mobile Money within an hour. If this continues, consider a notice to applicants.", important: true, hoursAgo: 3 * 24, readAfter: 1, channels: ["IN_APP", "EMAIL", "SMS"], action: { label: "Applications with failed payments", href: "/admin/applications?payment=FAILED" } },
    { category: "UPLOAD", title: "Upload rejections rising at one institution", summary: "Bamenda Professional School of Health rejected 31% of uploads.", body: "Bamenda Professional School of Health has rejected 31% of uploaded documents this month, against 9% platform-wide. Most rejections cite uncertified copies.", important: false, hoursAgo: 8 * 24, readAfter: 50, channels: ["IN_APP"] },
    { category: "REJECTION", title: "Duplicate tuition reference blocked", summary: "MTN-26-5530021 appeared on two accounts.", body: "The same payment reference, MTN-26-5530021, was recorded on two different tuition accounts. The second record was rejected.", important: true, hoursAgo: 4 * 24, readAfter: 2, channels: ["IN_APP", "EMAIL"], action: { label: "Tuition verification", href: "/admin/tuition" } },
    { category: "RESUBMISSION", title: "Resubmission windows closing", summary: "5 applicants have 2 days left to resubmit.", body: "5 applicants have 2 days left to resubmit documents an institution rejected. A reminder goes out automatically tomorrow.", important: false, hoursAgo: 2 * 24, channels: ["IN_APP"] },
    { category: "ADMISSION", title: "Offers published", summary: "Mont Fébé University published 41 offers.", body: "Mont Fébé University published 41 admission offers for the 2026/2027 intake. Admitted students can now record tuition payments.", important: false, hoursAgo: 6 * 24, readAfter: 3, channels: ["IN_APP", "EMAIL"] },
    { category: "VERIFICATION", title: "Tuition verification overdue", summary: "12 payments are past the 3-day target.", body: "12 tuition payments across 4 institutions have waited more than 3 working days for verification.", important: true, hoursAgo: 14, channels: ["IN_APP", "EMAIL"], action: { label: "Tuition verification", href: "/admin/tuition" } },
  ];
}

function seedNotifications(): CentreNotification[] {
  return [...build("student", studentSeed()), ...build("institution", institutionSeed()), ...build("admin", adminSeed())];
}

export const notificationStore = createCollection<CentreNotification>("notifications", seedNotifications);

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

function byNewest(a: CentreNotification, b: CentreNotification) {
  return b.createdAt.localeCompare(a.createdAt);
}

function appendHistory(n: CentreNotification, kind: HistoryKind): HistoryEvent[] {
  return [...n.history, { kind, at: new Date().toISOString() }];
}

/** Guess a category for notifications raised by the student portal itself. */
function categoryFor(title: string): NotificationCategory {
  const t = title.toLowerCase();
  if (t.includes("payment") || t.includes("fee")) return "PAYMENT";
  if (t.includes("upload") || t.includes("document")) return "UPLOAD";
  if (t.includes("reject")) return "REJECTION";
  if (t.includes("admi") || t.includes("offer")) return "ADMISSION";
  return "APPLICATION";
}

export function useNotifications(audience: Audience) {
  const all = notificationStore.useItems();
  const { notifications: live } = useApp();

  // Copy notifications the student portal raised (AppContext) into the
  // centre once, so they get categories, history and archive like the rest.
  useEffect(() => {
    if (audience !== "student" || live.length === 0) return;
    const known = new Set(notificationStore.getAll().map((n) => n.id));
    live
      .filter((n) => !known.has(n.id))
      .forEach((n) =>
        notificationStore.add({
          id: n.id,
          audience: "student",
          category: categoryFor(n.title),
          title: n.title,
          summary: n.body,
          body: n.body,
          createdAt: n.createdAt,
          readAt: n.read ? n.createdAt : null,
          archivedAt: null,
          important: false,
          action: { label: "Track status", href: "/student/application/status" },
          deliveries: [{ channel: "IN_APP", to: CONTACT.student.IN_APP, status: "DELIVERED", at: n.createdAt }],
          history: [
            { kind: "CREATED", at: n.createdAt },
            { kind: "DELIVERED", at: n.createdAt, channel: "IN_APP" },
          ],
        })
      );
  }, [audience, live]);

  const mine = useMemo(() => all.filter((n) => n.audience === audience).sort(byNewest), [all, audience]);
  const inbox = useMemo(() => mine.filter((n) => !n.archivedAt), [mine]);
  const unreadCount = inbox.filter((n) => !n.readAt).length;

  const markRead = useCallback((id: string) => {
    const n = notificationStore.getAll().find((x) => x.id === id);
    if (!n || n.readAt) return;
    notificationStore.update(id, { readAt: new Date().toISOString(), history: appendHistory(n, "READ") });
  }, []);
  const markUnread = useCallback((id: string) => {
    const n = notificationStore.getAll().find((x) => x.id === id);
    if (!n || !n.readAt) return;
    notificationStore.update(id, { readAt: null, history: appendHistory(n, "UNREAD") });
  }, []);
  const archive = useCallback((id: string) => {
    const n = notificationStore.getAll().find((x) => x.id === id);
    if (!n || n.archivedAt) return;
    const now = new Date().toISOString();
    notificationStore.update(id, { archivedAt: now, readAt: n.readAt ?? now, history: appendHistory(n, "ARCHIVED") });
  }, []);
  const restore = useCallback((id: string) => {
    const n = notificationStore.getAll().find((x) => x.id === id);
    if (!n || !n.archivedAt) return;
    notificationStore.update(id, { archivedAt: null, history: appendHistory(n, "RESTORED") });
  }, []);
  const markAllRead = useCallback((ids: string[]) => ids.forEach(markRead), [markRead]);

  return { all: mine, inbox, unreadCount, markRead, markUnread, archive, restore, markAllRead };
}

export const HISTORY_LABELS: Record<HistoryKind, string> = {
  CREATED: "Created",
  DELIVERED: "Delivered",
  FAILED: "Delivery failed",
  READ: "Read",
  UNREAD: "Marked unread",
  ARCHIVED: "Archived",
  RESTORED: "Restored to inbox",
};
