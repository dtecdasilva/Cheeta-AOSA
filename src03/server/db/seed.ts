import "server-only";
import { randomBytes } from "node:crypto";
import { count, sql } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
import { DEMO_ACCOUNTS } from "@/lib/auth/users";
import { syncAccessCatalogue } from "@/server/auth/access";
import { assessApplicationFee } from "@/server/modules/applications/applications.queries";
import { INSTITUTION_TYPES } from "@/lib/data";
import { institutions as portalInstitutions } from "@/lib/data";
import { EDUCATION_LEVEL_SEED } from "@/lib/education/levels";
import { parameterStore, type ParamItem } from "@/lib/admin/parameters";
import { countryStore, currencyStore, rateStore } from "@/lib/admin/reference";
import { institutionStore, SEED_INSTITUTIONS } from "@/lib/admin/institutions";
import { departmentStore, facultyStore, programStore } from "@/lib/admin/academics";
import { paymentMethodStore } from "@/lib/admin/paymentMethods";
import { accountStore } from "@/lib/admin/access";
import { templateStore } from "@/lib/admin/templates";
import { seedAdminRecords } from "@/lib/admin/students";
import { feePaymentStore } from "@/lib/payments/applicationFees";
import { mockUploadRequirements } from "@/lib/mockData/uploadRequirements";
import { mockBillingConfigs } from "@/lib/mockData/billing";
import { logger } from "@/server/logging/logger";
import type { Db, Executor } from "./client";
import * as t from "./schema";

/**
 * Fills an empty database from the same seed data the frontend screens
 * show (each frontend collection returns its seed when there's no
 * browser), so nothing changes on screen when a screen moves from its
 * local store to the API.
 *
 * - Reference data (parameter lists, countries, currencies, rates,
 *   education levels, notification templates) is real configuration the
 *   platform needs; it's loaded into any empty database.
 * - Demo data (the sample institutions, demo accounts with known
 *   passwords, generated applicants and applications) is loaded only when
 *   SEED_DEMO_DATA is on, which it is by default outside production.
 *
 * Every insert ignores rows that already exist, so running it twice is
 * harmless.
 */

const log = logger.child({ module: "seed" });

async function insertChunks<T>(db: Executor, table: Parameters<Db["insert"]>[0], rows: T[], size = 200) {
  for (let i = 0; i < rows.length; i += size) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.insert(table).values(rows.slice(i, i + size) as any).onConflictDoNothing();
  }
}

const status = (s: string) => (s === "active" || s === "ACTIVE" ? "ACTIVE" : "INACTIVE") as "ACTIVE" | "INACTIVE";

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

async function seedReference(db: Executor) {
  // Parents before children (region → town → quarter), so parent_id references resolve.
  const items = parameterStore.getAll();
  const byId = new Map(items.map((p) => [p.id, p]));
  const depth = (p: ParamItem): number => (p.parentId && byId.has(p.parentId) ? 1 + depth(byId.get(p.parentId)!) : 0);
  const ordered = [...items].sort((a, b) => depth(a) - depth(b));
  await insertChunks(
    db,
    t.parameters,
    ordered.map((p) => ({
      id: p.id,
      category: p.category,
      code: p.code,
      label: p.label,
      description: p.description,
      status: p.status,
      sortOrder: p.order,
      parentId: p.parentId ?? null,
      attrs: p.attrs,
      createdAt: new Date(p.createdAt),
      updatedAt: new Date(p.updatedAt),
    }))
  );

  await insertChunks(
    db,
    t.countries,
    countryStore.getAll().map((c) => ({ id: c.id, name: c.name, iso2: c.iso2, iso3: c.iso3, sortOrder: c.sortOrder, dialCode: c.dialCode, region: c.region, currencyCode: c.currencyCode, nationality: c.nationality, residence: c.residence, status: c.status }))
  );
  await insertChunks(
    db,
    t.currencies,
    currencyStore.getAll().map((c) => ({ code: c.code, name: c.name, symbol: c.symbol, decimalDigits: c.decimalDigits, symbolPosition: c.symbolPosition, displayToApplicants: c.displayToApplicants, status: c.status }))
  );
  await insertChunks(
    db,
    t.exchangeRates,
    rateStore
      .getAll()
      .filter((r) => r.code !== "XAF")
      .map((r) => ({ id: `rate-seed-${r.code}`, currencyCode: r.code, xafPerUnit: r.xafPerUnit, source: r.source, asOf: new Date(r.asOf) }))
  );

  for (const [i, level] of EDUCATION_LEVEL_SEED.entries()) {
    const id = `edulvl-${level.name.toLowerCase().replace(/\W+/g, "-")}`;
    await db.insert(t.educationLevels).values({ id, name: level.name, sortOrder: i + 1 }).onConflictDoNothing();
    await insertChunks(
      db,
      t.educationQualifications,
      level.qualifications.map((label, j) => ({ id: `${id}-q${j + 1}`, educationLevelId: id, label }))
    );
  }

  await insertChunks(
    db,
    t.notificationTemplates,
    templateStore.getAll().map((tpl) => ({
      id: tpl.id,
      code: tpl.code,
      name: tpl.name,
      channel: tpl.channel,
      event: tpl.event,
      subject: tpl.subject,
      body: tpl.body,
      status: tpl.status,
      version: tpl.version,
      notes: tpl.notes,
      createdAt: new Date(tpl.createdAt),
      updatedAt: new Date(tpl.updatedAt),
    }))
  );
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

const TYPE_NAMES: Record<string, (typeof INSTITUTION_TYPES)[number]> = { UNI: "University", HS: "High School", SS: "Secondary School", VOC: "Vocational School", PRO: "Professional School" };

async function seedInstitutions(db: Executor) {
  await insertChunks(
    db,
    t.institutions,
    institutionStore.getAll().map((i) => ({ ...i, quarterId: i.quarterId || null, createdAt: new Date(i.createdAt), updatedAt: new Date(i.updatedAt) }))
  );
  await insertChunks(db, t.faculties, facultyStore.getAll().map((f) => ({ ...f, updatedAt: new Date(f.updatedAt) })));
  await insertChunks(db, t.departments, departmentStore.getAll().map((d) => ({ ...d, updatedAt: new Date(d.updatedAt) })));
  await insertChunks(db, t.programs, programStore.getAll().map((p) => ({ ...p, updatedAt: new Date(p.updatedAt) })));
  await insertChunks(db, t.institutionPaymentMethods, paymentMethodStore.getAll().map((m) => ({ ...m, updatedAt: new Date(m.updatedAt) })));

  // Upload requirements: the institution portal's, plus the documents each
  // sample institution lists (src/lib/data.ts) where it has none of its own.
  const requirements = mockUploadRequirements.map((r) => ({ id: r.id, institutionId: r.institutionId, name: r.name, description: r.description ?? "", required: r.required, fileTypes: r.fileTypes, maxSizeKb: r.maxSizeKB, status: status(r.status) }));
  for (const inst of portalInstitutions) {
    for (const [i, name] of inst.requiredDocuments.entries()) {
      if (requirements.some((r) => r.institutionId === inst.id && r.name === name)) continue;
      requirements.push({ id: `ur-${inst.id}-${i + 1}`, institutionId: inst.id, name, description: "", required: true, fileTypes: ["pdf", "jpg", "png"], maxSizeKb: 2048, status: "ACTIVE" });
    }
  }
  await insertChunks(db, t.uploadRequirements, requirements);

  // Fee schedules: the portal's billing configs, plus each sample institution's application fee.
  const fees = mockBillingConfigs.map((f) => ({ id: f.id, institutionId: f.institutionId, name: f.name, type: f.type, category: f.category, currency: f.currency, amount: f.amount, effectiveDate: f.effectiveDate.slice(0, 10), notes: f.notes ?? "", status: status(f.status) }));
  for (const inst of portalInstitutions) {
    if (fees.some((f) => f.institutionId === inst.id && f.type === "application" && f.category === "national")) continue;
    fees.push({ id: `fee-${inst.id}-app`, institutionId: inst.id, name: "Application fee", type: "application", category: "national", currency: "XAF", amount: inst.applicationFee, effectiveDate: "2026-01-01", notes: "", status: "ACTIVE" });
  }
  await insertChunks(db, t.feeConfigs, fees);
}

async function seedAccounts(db: Executor) {
  const demoPassword: Record<string, string> = { STUDENT: "Student123!", INSTITUTION_ADMIN: "Institution123!", INSTITUTION_ADMISSION_USER: "Institution123!", AOSA_ADMIN: "Aosa123!" };
  const accounts = [
    ...DEMO_ACCOUNTS.map((a) => ({ ...a, phone: a.mobileNumber ?? null, mfa: false, lastSignInAt: null as string | null })),
    // The Access management screen's other sample accounts, same demo passwords by role.
    ...accountStore
      .getAll()
      .filter((a) => !DEMO_ACCOUNTS.some((d) => d.id === a.id))
      .map((a) => ({ id: a.id, email: a.email, password: demoPassword[a.role], fullName: a.fullName, role: a.role, status: a.status, institutionId: a.institutionId || undefined, institutionType: undefined, mobileNumber: undefined, phone: a.phone, createdAt: a.createdAt, mfa: a.mfa, lastSignInAt: a.lastSignInAt })),
  ];
  const hashes = new Map<string, string>();
  const hashFor = (pw: string) => hashes.get(pw) ?? (hashes.set(pw, hashPassword(pw)), hashes.get(pw)!);

  await insertChunks(
    db,
    t.users,
    accounts.map((a) => ({
      id: a.id,
      email: a.email.toLowerCase(),
      passwordHash: hashFor(a.password),
      fullName: a.fullName,
      role: a.role,
      status: a.status,
      phone: a.phone ?? null,
      institutionId: a.institutionId ?? null,
      mfaEnabled: a.mfa,
      lastSignInAt: a.lastSignInAt ? new Date(a.lastSignInAt) : null,
      // Demo accounts are ready to use: treated as having confirmed their address when they were created.
      emailVerifiedAt: new Date(a.createdAt),
      createdAt: new Date(a.createdAt),
    }))
  );
  const year = new Date().getUTCFullYear();
  await insertChunks(
    db,
    t.applicantProfiles,
    accounts
      .filter((a) => a.role === "STUDENT")
      .map((a, i) => ({ userId: a.id, registrationNo: `CHT-${year}-D${String(i + 1).padStart(4, "0")}`, institutionType: a.institutionType ?? "University", mobileNumber: a.mobileNumber ?? a.phone ?? "" }))
  );
  await insertChunks(
    db,
    t.institutionStaff,
    accounts
      .filter((a) => a.institutionId && (a.role === "INSTITUTION_ADMIN" || a.role === "INSTITUTION_ADMISSION_USER"))
      .map((a, i) => ({
        userId: a.id,
        institutionId: a.institutionId!,
        staffNo: `STAFF-${String(i + 1).padStart(3, "0")}`,
        position: a.role === "INSTITUTION_ADMIN" ? "Head of Admissions" : "Admissions Officer",
      }))
  );
  // Institution administrators hold every staff permission through their role; admission users are granted theirs one by one.
  await insertChunks(
    db,
    t.userPermissions,
    accounts
      .filter((a) => a.role === "INSTITUTION_ADMISSION_USER")
      .flatMap((a) => (["PAYMENTS_UPLOADS", "ACKNOWLEDGED_APPS", "REJECTED_APPS"] as const).map((permissionKey) => ({ userId: a.id, permissionKey })))
  );
  await insertChunks(
    db,
    t.administratorProfiles,
    accounts.filter((a) => a.role === "AOSA_ADMIN").map((a) => ({ userId: a.id, position: "Platform administrator" }))
  );
}

/** The admin portal's generated applicants and applications, as real rows. */
async function seedApplications(db: Executor) {
  const { students, applications } = seedAdminRecords();
  const academicYearId = parameterStore.getAll().find((p) => p.category === "academic-years" && p.attrs.current === true)?.id ?? null;
  const programs = programStore.getAll();
  const instType = new Map(SEED_INSTITUTIONS.map((i) => [i.id, TYPE_NAMES[i.typeCode] ?? "University"]));
  // Generated applicants can't sign in: their password is random and never shown.
  const unusable = hashPassword(randomBytes(24).toString("hex"));

  await insertChunks(
    db,
    t.users,
    students.map((s) => ({ id: s.id, email: s.email.toLowerCase(), passwordHash: unusable, fullName: `${s.firstName} ${s.lastName}`, role: "STUDENT", phone: s.phone, emailVerifiedAt: new Date(s.registeredAt), createdAt: new Date(s.registeredAt) }))
  );
  const firstInstitution = new Map<string, string>();
  for (const a of applications) if (!firstInstitution.has(a.studentId)) firstInstitution.set(a.studentId, a.institutionId);
  await insertChunks(
    db,
    t.applicantProfiles,
    students.map((s) => ({
      userId: s.id,
      registrationNo: s.registrationNo,
      institutionType: instType.get(firstInstitution.get(s.id) ?? "") ?? "University",
      mobileNumber: s.phone,
      firstName: s.firstName,
      lastName: s.lastName,
      gender: s.gender,
      dateOfBirth: s.dateOfBirth.slice(0, 10),
      regionId: s.regionId,
      townId: s.townId,
      address: s.address,
      highestQualification: s.highestQualification,
      source: s.source,
      createdAt: new Date(s.registeredAt),
    }))
  );

  // One bundle per applicant for the current intake.
  const bundleOf = new Map<string, string>();
  const bundles: (typeof t.applications.$inferInsert)[] = [];
  for (const a of [...applications].sort((x, y) => x.createdAt.localeCompare(y.createdAt))) {
    if (bundleOf.has(a.studentId)) continue;
    const id = `bundle-${a.studentId}`;
    bundleOf.set(a.studentId, id);
    bundles.push({ id, applicantId: a.studentId, academicYearId, reference: `AOSA-SEED-${String(bundles.length + 1).padStart(5, "0")}`, createdAt: new Date(a.createdAt) });
  }
  await insertChunks(db, t.applications, bundles);

  await insertChunks(
    db,
    t.applicationInstitutions,
    applications.map((a) => {
      const submitted = a.history.find((h) => h.status === "SUBMITTED");
      const decided = [...a.history].reverse().find((h) => h.status === "I_REJECTED" || h.status === "ACCEPTED");
      return {
        id: a.id,
        applicationId: bundleOf.get(a.studentId)!,
        institutionId: a.institutionId,
        reference: a.reference,
        status: a.status,
        submittedAt: submitted ? new Date(submitted.at) : null,
        decidedAt: decided ? new Date(decided.at) : null,
        createdAt: new Date(a.createdAt),
        updatedAt: new Date(a.updatedAt),
      };
    })
  );
  await insertChunks(
    db,
    t.applicationStatusEvents,
    applications.flatMap((a) => a.history.map((h, i) => ({ id: `${a.id}-evt-${i}`, applicationInstitutionId: a.id, status: h.status, actor: h.actor, note: h.note, at: new Date(h.at) })))
  );
  await insertChunks(
    db,
    t.programChoices,
    applications.flatMap((a) => {
      const program = programs.find((p) => p.institutionId === a.institutionId && p.name === a.programName);
      return program ? [{ id: `${a.id}-choice-1`, applicationInstitutionId: a.id, programId: program.id, rank: 1 }] : [];
    })
  );

  const seeded = new Set(applications.map((a) => a.id));
  await insertChunks(
    db,
    t.feePayments,
    feePaymentStore
      .getAll()
      .filter((f) => seeded.has(f.applicationId))
      .map((f) => ({
        id: f.id,
        applicationInstitutionId: f.applicationId,
        method: f.method,
        reference: f.reference,
        applicationFee: f.applicationFee,
        webFee: f.webFee,
        amount: f.amount,
        paidAt: new Date(f.paidAt),
        submittedAt: new Date(f.submittedAt),
        approval: f.approval,
        bankCode: f.bankCode,
        reviewedAt: f.reviewedAt ? new Date(f.reviewedAt) : null,
        note: f.note,
      }))
  );

  // What each application costs. Where a payment was recorded, the fee is the one that was paid;
  // otherwise it is worked out exactly as the portal does when an institution is added.
  const paid = new Map(feePaymentStore.getAll().filter((f) => seeded.has(f.applicationId)).map((f) => [f.applicationId, f]));
  await insertChunks(
    db,
    t.applicationFees,
    applications
      .filter((a) => paid.has(a.id))
      .map((a) => {
        const f = paid.get(a.id)!;
        return { applicationInstitutionId: a.id, applicationFee: f.applicationFee, webFee: f.webFee, amount: f.applicationFee + f.webFee, assessedAt: new Date(f.submittedAt) };
      })
  );
  const webFeeOf = new Map(SEED_INSTITUTIONS.map((i) => [i.id, i.webFee]));
  for (const a of applications) {
    if (!paid.has(a.id)) await assessApplicationFee(db, { id: a.id, institutionId: a.institutionId, webFee: webFeeOf.get(a.institutionId) ?? 0 });
  }

  // Continue numbering after the seeded references, so new ones never collide.
  const maxSeq = (values: string[], re: RegExp) => values.reduce((m, v) => Math.max(m, Number(re.exec(v)?.[1] ?? 0)), 0);
  const counters: { key: string; value: number }[] = [];
  for (const yy of new Set(applications.map((a) => a.reference.slice(4, 6)))) {
    counters.push({ key: `application-institution:20${yy}`, value: maxSeq(applications.filter((a) => a.reference.slice(4, 6) === yy).map((a) => a.reference), /-(\d+)$/) });
  }
  for (const yyyy of new Set(students.map((s) => s.registrationNo.slice(4, 8)))) {
    counters.push({ key: `registration-no:${yyyy}`, value: maxSeq(students.filter((s) => s.registrationNo.slice(4, 8) === yyyy).map((s) => s.registrationNo), /-(\d+)$/) });
  }
  for (const c of counters) {
    await db
      .insert(t.counters)
      .values(c)
      .onConflictDoUpdate({ target: t.counters.key, set: { value: sql`greatest(${t.counters.value}, ${c.value})` } });
  }
  return { students: students.length, applications: applications.length };
}

export async function isDatabaseEmpty(db: Executor) {
  const [{ n }] = await db.select({ n: count() }).from(t.parameters);
  return n === 0;
}

export async function seedDatabase(db: Db, opts: { demo: boolean }) {
  const started = Date.now();
  await db.transaction(async (tx) => {
    // Roles first: every account row points at one.
    await syncAccessCatalogue(tx);
    await seedReference(tx);
    if (opts.demo) {
      await seedInstitutions(tx);
      await seedAccounts(tx);
      const counts = await seedApplications(tx);
      log.info("Demo data loaded", counts);
    }
  });
  log.info("Database seeded", { demo: opts.demo, ms: Date.now() - started });
}
