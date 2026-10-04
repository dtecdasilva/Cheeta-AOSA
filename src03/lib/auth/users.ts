import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { hashPassword, generateTemporaryCode } from "./password";
import { AccountStatus, Role } from "./roles";
import { InstitutionType } from "@/lib/types";
import { getDb, type Executor } from "@/server/db/client";
import { applicantProfiles, institutions, users } from "@/server/db/schema";
import { newId, nextCounter } from "@/server/db/ids";

/**
 * The account directory, backed by the `users` table (with
 * `applicant_profiles` for applicants). Same exports as the in-memory
 * version it replaced, so the session guard, the auth routes and the
 * portals' `PublicUser` type didn't change.
 */

export interface AuthUser {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: Role;
  status: AccountStatus;
  institutionId?: string;
  institutionName?: string;
  /** Applicant-only: the kind of institution they're applying to. */
  institutionType?: InstitutionType;
  /** Applicant-only: used for SMS notifications. */
  mobileNumber?: string;
  registrationNo?: string;
  /** ISO time the email address was proved, or null if it hasn't been yet. */
  emailVerifiedAt: string | null;
  sessionVersion: number;
  failedLoginCount: number;
  lockedUntil: Date | null;
  createdAt: string;
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

function selectUsers(db: Executor) {
  return db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      fullName: users.fullName,
      role: users.role,
      status: users.status,
      phone: users.phone,
      institutionId: users.institutionId,
      institutionName: institutions.name,
      institutionType: applicantProfiles.institutionType,
      mobileNumber: applicantProfiles.mobileNumber,
      registrationNo: applicantProfiles.registrationNo,
      emailVerifiedAt: users.emailVerifiedAt,
      sessionVersion: users.sessionVersion,
      failedLoginCount: users.failedLoginCount,
      lockedUntil: users.lockedUntil,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(applicantProfiles, eq(applicantProfiles.userId, users.id))
    .leftJoin(institutions, eq(institutions.id, users.institutionId));
}

type Row = Awaited<ReturnType<ReturnType<typeof selectUsers>["execute"]>>[number];

function toAuthUser(r: Row): AuthUser {
  return {
    id: r.id,
    email: r.email,
    passwordHash: r.passwordHash,
    fullName: r.fullName,
    role: r.role as Role,
    status: r.status,
    institutionId: r.institutionId ?? undefined,
    institutionName: r.institutionName ?? undefined,
    institutionType: (r.institutionType as InstitutionType | null) ?? undefined,
    mobileNumber: r.mobileNumber ?? r.phone ?? undefined,
    registrationNo: r.registrationNo ?? undefined,
    emailVerifiedAt: r.emailVerifiedAt ? r.emailVerifiedAt.toISOString() : null,
    sessionVersion: r.sessionVersion,
    failedLoginCount: r.failedLoginCount,
    lockedUntil: r.lockedUntil,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function findUserByEmail(email: string): Promise<AuthUser | undefined> {
  const [row] = await selectUsers(getDb()).where(eq(users.email, normalizeEmail(email))).limit(1);
  return row ? toAuthUser(row) : undefined;
}

export async function findUserById(id: string): Promise<AuthUser | undefined> {
  const [row] = await selectUsers(getDb()).where(eq(users.id, id)).limit(1);
  return row ? toAuthUser(row) : undefined;
}

/**
 * Records that the account's owner controls its email address. Does
 * nothing if that was already recorded; returns whether this call was the
 * one that verified it.
 */
export async function markEmailVerified(id: string): Promise<boolean> {
  const res = await getDb()
    .update(users)
    .set({ emailVerifiedAt: new Date() })
    .where(and(eq(users.id, id), isNull(users.emailVerifiedAt)))
    .returning({ id: users.id });
  return res.length > 0;
}

/**
 * Sets a new password and invalidates every existing session for the
 * account (by bumping its session version), clearing any lockout. Only
 * reachable through a link sent to the account's email, so it also counts
 * as verifying that address.
 */
export async function setUserPasswordHash(id: string, passwordHash: string): Promise<{ ok: boolean }> {
  const res = await getDb()
    .update(users)
    .set({ passwordHash, sessionVersion: sql`${users.sessionVersion} + 1`, failedLoginCount: 0, lockedUntil: null, emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())` })
    .where(eq(users.id, id))
    .returning({ id: users.id });
  return { ok: res.length > 0 };
}

/** Counts a failed sign-in and locks the account once `maxAttempts` is reached. */
export async function recordFailedLogin(id: string, maxAttempts: number, lockMinutes = 15) {
  await getDb()
    .update(users)
    .set({
      failedLoginCount: sql`${users.failedLoginCount} + 1`,
      lockedUntil: sql`case when ${users.failedLoginCount} + 1 >= ${maxAttempts} then now() + make_interval(mins => ${lockMinutes}) else ${users.lockedUntil} end`,
    })
    .where(eq(users.id, id));
}

export async function recordSuccessfulLogin(id: string) {
  await getDb().update(users).set({ failedLoginCount: 0, lockedUntil: null, lastSignInAt: new Date() }).where(eq(users.id, id));
}

export type CreateApplicantResult = { status: "exists" } | { status: "created"; user: AuthUser; temporaryCode: string };

/**
 * Creates a STUDENT account with a one-time temporary code as its
 * password, or reports that the email is taken. The only way an applicant
 * account comes into existence, so every one has been through
 * registration's validation and code generation.
 */
export async function createApplicantAccount(params: {
  email: string;
  institutionType: InstitutionType;
  mobileNumber: string;
}): Promise<CreateApplicantResult> {
  const email = normalizeEmail(params.email);
  const temporaryCode = generateTemporaryCode();
  const id = newId("usr");

  const created = await getDb().transaction(async (tx) => {
    const inserted = await tx
      .insert(users)
      .values({ id, email, passwordHash: hashPassword(temporaryCode), fullName: email.split("@")[0], role: "STUDENT", phone: params.mobileNumber })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });
    if (!inserted.length) return false;
    const year = new Date().getUTCFullYear();
    const seq = await nextCounter(tx, `registration-no:${year}`);
    await tx.insert(applicantProfiles).values({
      userId: id,
      registrationNo: `CHT-${year}-${String(seq).padStart(5, "0")}`,
      institutionType: params.institutionType,
      mobileNumber: params.mobileNumber,
    });
    return true;
  });

  if (!created) return { status: "exists" };
  const user = await findUserById(id);
  return { status: "created", user: user!, temporaryCode };
}

/** Safe subset of a user record for anything sent to the client. */
export function toPublicUser(user: AuthUser) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
    institutionId: user.institutionId ?? null,
    institutionName: user.institutionName ?? null,
    institutionType: user.institutionType ?? null,
    mobileNumber: user.mobileNumber ?? null,
    emailVerified: user.emailVerifiedAt !== null,
    createdAt: user.createdAt,
  };
}

/**
 * Where a registration stands. An account is created the moment the form
 * is accepted; it becomes VERIFIED once its owner has shown they receive
 * mail at the address they gave.
 */
export type RegistrationStatus = "PENDING_VERIFICATION" | "VERIFIED" | "DEACTIVATED";

export function registrationStatusOf(user: Pick<AuthUser, "status" | "emailVerifiedAt">): RegistrationStatus {
  if (user.status !== "ACTIVE") return "DEACTIVATED";
  return user.emailVerifiedAt ? "VERIFIED" : "PENDING_VERIFICATION";
}

export type PublicUser = ReturnType<typeof toPublicUser>;

/**
 * Demo accounts, created by the development seed only (SEED_DEMO_DATA).
 * Never present in production unless someone seeds them deliberately.
 */
export const DEMO_ACCOUNTS: {
  id: string;
  email: string;
  password: string;
  fullName: string;
  role: Role;
  status: AccountStatus;
  institutionId?: string;
  institutionType?: InstitutionType;
  mobileNumber?: string;
  createdAt: string;
}[] = [
  { id: "usr-student-1", email: "student@cheeta.local", password: "Student123!", fullName: "Aïssatou Mballa", role: "STUDENT", status: "ACTIVE", institutionType: "University", mobileNumber: "+237670000001", createdAt: "2026-01-15T09:00:00Z" },
  { id: "usr-student-2", email: "inactive.student@cheeta.local", password: "Student123!", fullName: "Paul Nguemo", role: "STUDENT", status: "INACTIVE", institutionType: "High School", mobileNumber: "+237670000002", createdAt: "2026-01-16T09:00:00Z" },
  { id: "usr-inst-admin-1", email: "admin@montfebe.cheeta.local", password: "Institution123!", fullName: "Dr. Rose Ateba", role: "INSTITUTION_ADMIN", status: "ACTIVE", institutionId: "inst-1", createdAt: "2026-01-10T09:00:00Z" },
  { id: "usr-inst-admission-1", email: "admissions@montfebe.cheeta.local", password: "Institution123!", fullName: "Jules Etoundi", role: "INSTITUTION_ADMISSION_USER", status: "ACTIVE", institutionId: "inst-1", createdAt: "2026-01-10T09:00:00Z" },
  { id: "usr-aosa-admin-1", email: "root@aosa.cheeta.local", password: "Aosa123!", fullName: "Chantal Biya-Fouda", role: "AOSA_ADMIN", status: "ACTIVE", createdAt: "2026-01-01T09:00:00Z" },
];
