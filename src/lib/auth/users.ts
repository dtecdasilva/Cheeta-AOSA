import { hashPassword, generateTemporaryCode } from "./password";
import { AccountStatus, Role } from "./roles";
import { InstitutionType } from "@/lib/types";
import { uid } from "@/lib/utils";
import { readSignedCookie, buildSignedCookieValue } from "@/lib/cookieStore";

export interface AuthUser {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: Role;
  status: AccountStatus;
  institutionId?: string;
  institutionName?: string;
  /** Applicant-only: what kind of institution they're applying to,
   * captured at registration. This is what will steer which application
   * experience/form set a student sees once that module is built. */
  institutionType?: InstitutionType;
  /** Applicant-only: used for SMS notifications. */
  mobileNumber?: string;
  createdAt: string;
}

/**
 * In-memory user directory standing in for a real database table (see
 * db/schema.sql for the normalized schema this is meant to mirror once a
 * real database is introduced). Passwords are hashed with scrypt exactly
 * as they would be before being written to a real users table — nothing
 * here is stored or compared as plain text. This resets whenever the
 * server restarts; that's expected until a persistence layer is built.
 *
 * Stored on `globalThis` rather than as a plain module-level array: Next.js
 * compiles Route Handlers and Server Components into separate module
 * graphs, and a plain `const users = [...]` ends up duplicated as two
 * independent arrays — one for API routes, one for page/layout rendering —
 * so a user created via /api/auth/register would exist for login but not
 * for the server-side session check in a portal's layout. Keying off
 * `globalThis` guarantees every bundle reads and writes the exact same
 * array within a single Node process, the same workaround commonly used
 * to keep a single Prisma Client instance across Next.js's module graphs.
 *
 * On top of that: this only covers ONE process. Deployed to serverless
 * hosting (Vercel), each request can land on a different, independent
 * process, so an account registered via one instance can be invisible to
 * a login attempt handled by another. ACCOUNTS_COOKIE (below) is the
 * workaround for that, for accounts created at runtime — see
 * src/lib/cookieStore.ts for the full explanation. The five seeded demo
 * accounts don't need this: they're created identically, deterministically,
 * on every instance at module load, so every instance already agrees on them.
 */
const GLOBAL_KEY = Symbol.for("cheeta-aosa.auth.users");
const ACCOUNTS_COOKIE = "aosa_accounts";

function seedUsers(): AuthUser[] {
  return [
    {
      id: "usr-student-1",
      email: "student@cheeta.local",
      passwordHash: hashPassword("Student123!"),
      fullName: "Aïssatou Mballa",
      role: "STUDENT",
      status: "ACTIVE",
      institutionType: "University",
      mobileNumber: "+237670000001",
      createdAt: new Date("2026-01-15T09:00:00Z").toISOString(),
    },
    {
      id: "usr-student-2",
      email: "inactive.student@cheeta.local",
      passwordHash: hashPassword("Student123!"),
      fullName: "Paul Nguemo",
      role: "STUDENT",
      status: "INACTIVE",
      institutionType: "High School",
      mobileNumber: "+237670000002",
      createdAt: new Date("2026-01-16T09:00:00Z").toISOString(),
    },
    {
      id: "usr-inst-admin-1",
      email: "admin@montfebe.cheeta.local",
      passwordHash: hashPassword("Institution123!"),
      fullName: "Dr. Rose Ateba",
      role: "INSTITUTION_ADMIN",
      status: "ACTIVE",
      institutionId: "inst-1",
      institutionName: "Mont Fébé University",
      createdAt: new Date("2026-01-10T09:00:00Z").toISOString(),
    },
    {
      id: "usr-inst-admission-1",
      email: "admissions@montfebe.cheeta.local",
      passwordHash: hashPassword("Institution123!"),
      fullName: "Jules Etoundi",
      role: "INSTITUTION_ADMISSION_USER",
      status: "ACTIVE",
      institutionId: "inst-1",
      institutionName: "Mont Fébé University",
      createdAt: new Date("2026-01-10T09:00:00Z").toISOString(),
    },
    {
      id: "usr-aosa-admin-1",
      email: "root@aosa.cheeta.local",
      passwordHash: hashPassword("Aosa123!"),
      fullName: "Chantal Biya-Fouda",
      role: "AOSA_ADMIN",
      status: "ACTIVE",
      createdAt: new Date("2026-01-01T09:00:00Z").toISOString(),
    },
  ];
}

const globalStore = globalThis as unknown as { [GLOBAL_KEY]?: AuthUser[] };
if (!globalStore[GLOBAL_KEY]) {
  globalStore[GLOBAL_KEY] = seedUsers();
}
const users: AuthUser[] = globalStore[GLOBAL_KEY]!;

async function readCookieAccounts(): Promise<AuthUser[]> {
  return (await readSignedCookie<AuthUser[]>(ACCOUNTS_COOKIE)) ?? [];
}

export async function findUserByEmail(email: string): Promise<AuthUser | undefined> {
  const target = email.trim().toLowerCase();
  const inMemory = users.find((u) => u.email.toLowerCase() === target);
  if (inMemory) return inMemory;
  const cookieAccounts = await readCookieAccounts();
  return cookieAccounts.find((u) => u.email.toLowerCase() === target);
}

export async function findUserById(id: string): Promise<AuthUser | undefined> {
  const inMemory = users.find((u) => u.id === id);
  if (inMemory) return inMemory;
  const cookieAccounts = await readCookieAccounts();
  return cookieAccounts.find((u) => u.id === id);
}

/**
 * Updates a password hash wherever the account currently lives. If it's a
 * cookie-tracked account (or becomes one), returns the new signed cookie
 * value the caller (a Route Handler) must set on its response — otherwise
 * a different serverless instance would keep seeing the old password hash.
 */
export async function setUserPasswordHash(
  id: string,
  passwordHash: string
): Promise<{ ok: boolean; accountsCookieValue?: string }> {
  const inMemory = users.find((u) => u.id === id);
  if (inMemory) inMemory.passwordHash = passwordHash;

  const cookieAccounts = await readCookieAccounts();
  const idx = cookieAccounts.findIndex((u) => u.id === id);
  if (idx === -1) {
    return { ok: !!inMemory };
  }
  cookieAccounts[idx] = { ...cookieAccounts[idx], passwordHash };
  return { ok: true, accountsCookieValue: await buildSignedCookieValue(cookieAccounts) };
}

export type CreateApplicantResult =
  | { status: "exists" }
  | { status: "created"; user: AuthUser; temporaryCode: string; accountsCookieValue: string };

/**
 * Creates a new STUDENT account, or reports that the email is already
 * taken rather than creating a duplicate. This is deliberately the only
 * way a STUDENT account comes into existence — there is no separate
 * "insert" path anywhere else, so every applicant account is guaranteed
 * to have gone through registration's validation and code generation.
 *
 * Always returns `accountsCookieValue` on success — the calling route
 * MUST set it on its response, or this account will only be visible to
 * whichever single serverless instance happened to handle registration.
 */
export async function createApplicantAccount(params: {
  email: string;
  institutionType: InstitutionType;
  mobileNumber: string;
}): Promise<CreateApplicantResult> {
  if (await findUserByEmail(params.email)) {
    return { status: "exists" };
  }

  const temporaryCode = generateTemporaryCode();
  const user: AuthUser = {
    id: uid("usr"),
    email: params.email.trim(),
    passwordHash: hashPassword(temporaryCode),
    fullName: params.email.trim().split("@")[0],
    role: "STUDENT",
    status: "ACTIVE",
    institutionType: params.institutionType,
    mobileNumber: params.mobileNumber,
    createdAt: new Date().toISOString(),
  };
  users.push(user);

  const cookieAccounts = await readCookieAccounts();
  cookieAccounts.push(user);
  const accountsCookieValue = await buildSignedCookieValue(cookieAccounts);

  return { status: "created", user, temporaryCode, accountsCookieValue };
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
    createdAt: user.createdAt,
  };
}

export type PublicUser = ReturnType<typeof toPublicUser>;

export { ACCOUNTS_COOKIE };
