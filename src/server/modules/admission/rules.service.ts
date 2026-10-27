import "server-only";
import { and, asc, desc, eq, inArray, max } from "drizzle-orm";
import { z } from "zod";
import { EDITABLE_STATUSES } from "@/lib/applications/statusFlow";
import { EMPTY_SCOPE, describeCondition, evaluate, inScope, validateCondition, type Condition, type RuleScope, type Structure } from "@/lib/admission/rules";
import type { PublicUser } from "@/lib/auth/users";
import type { ApplicationStatus } from "@/lib/types";
import { getDb, type Executor } from "@/server/db/client";
import { admissionRuleVersions, admissionRules, deliberationRunRules, departments, faculties, programs , applicationInstitutions } from "@/server/db/schema";
import { newId } from "@/server/db/ids";
import { audit } from "@/server/audit/audit";
import { assertPermission } from "@/server/auth/access";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/http/errors";
import { parseWith, requiredText } from "@/server/http/validate";
import { loadApplicationInstitution } from "@/server/modules/applications/applications.queries";
import { loadCriteria, loadFacts } from "./criteria";

/**
 * An institution's admission rules, kept as data and versioned.
 *
 * Creating a rule creates its version 1. Changing what a rule requires
 * (its conditions or the programs it applies to) adds a new version and
 * leaves the earlier ones exactly as they were, so a deliberation run
 * against version 2 can always be explained by version 2. Renaming a rule
 * or switching it on and off doesn't change what it requires, so it adds
 * no version (it is in the audit trail).
 *
 * Confined to the caller's institution. Reading and testing rules needs
 * the "Deliberation List" permission; creating and changing them is for
 * institution administrators.
 */

function institutionOf(user: PublicUser): string {
  if (!user.institutionId) throw new ForbiddenError("This account isn't linked to an institution.");
  return user.institutionId;
}

const assertReader = (db: Executor, user: PublicUser) => assertPermission(db, user, "DELIBERATION", "Admission rules need the \"Deliberation List\" permission.");
function assertWriter(user: PublicUser) {
  if (user.role !== "INSTITUTION_ADMIN") throw new ForbiddenError("Only an institution administrator can create or change admission rules.");
}

/** The institution's faculties, departments and programs, by id and with their names. */
async function structureOf(db: Executor, institutionId: string) {
  const [f, d, p] = await Promise.all([
    db.select({ id: faculties.id, name: faculties.name }).from(faculties).where(eq(faculties.institutionId, institutionId)),
    db.select({ id: departments.id, name: departments.name, facultyId: departments.facultyId }).from(departments).where(eq(departments.institutionId, institutionId)),
    db.select({ id: programs.id, name: programs.name, facultyId: programs.facultyId, departmentId: programs.departmentId }).from(programs).where(eq(programs.institutionId, institutionId)),
  ]);
  const structure: Structure = { faculties: new Set(f.map((x) => x.id)), departments: new Set(d.map((x) => x.id)), programs: new Set(p.map((x) => x.id)) };
  const name = new Map<string, string>([...f, ...d, ...p].map((x) => [x.id, x.name]));
  return { structure, faculties: f, departments: d, programs: p, nameOf: (id: string) => name.get(id) ?? id };
}

const scopeSchema = z
  .object({ facultyIds: z.array(z.string().max(100)).max(200).default([]), departmentIds: z.array(z.string().max(100)).max(200).default([]), programIds: z.array(z.string().max(100)).max(500).default([]) })
  .default(EMPTY_SCOPE);

const versionSchema = z.object({
  condition: z.unknown(),
  scope: scopeSchema,
  notes: z.string().trim().max(1000).default(""),
});

const createSchema = versionSchema.extend({ name: requiredText(200), description: z.string().trim().max(1000).default("") });
const updateSchema = z.object({ name: requiredText(200).optional(), description: z.string().trim().max(1000).optional(), status: z.enum(["ACTIVE", "INACTIVE"]).optional() });

/** Checks a version's conditions and scope against today's criteria and the institution's structure; returns them cleaned. */
async function checkVersion(db: Executor, institutionId: string, input: z.infer<typeof versionSchema>): Promise<{ condition: Condition; scope: RuleScope }> {
  const [criteria, s] = await Promise.all([loadCriteria(db), structureOf(db, institutionId)]);
  const errors = validateCondition(input.condition, criteria, s.structure);
  const own = (ids: string[], set: Set<string>) => ids.every((id) => set.has(id));
  if (!own(input.scope.facultyIds, s.structure.faculties) || !own(input.scope.departmentIds, s.structure.departments) || !own(input.scope.programIds, s.structure.programs)) {
    errors.scope = "A rule can only apply to your own institution's faculties, departments and programs.";
  }
  if (Object.keys(errors).length) throw new ValidationError(errors, "The rule has problems to fix.");
  return { condition: clean(input.condition as Condition), scope: { facultyIds: [...new Set(input.scope.facultyIds)], departmentIds: [...new Set(input.scope.departmentIds)], programIds: [...new Set(input.scope.programIds)] } };
}

/** Keeps only the fields each kind of condition uses, so nothing stray is stored. */
function clean(c: Condition): Condition {
  const base = c.id ? { id: String(c.id).slice(0, 60) } : {};
  switch (c.type) {
    case "AND":
    case "OR":
      return { ...base, type: c.type, children: c.children!.map(clean) };
    case "SPECIALTY":
    case "FACULTY":
    case "DEPARTMENT":
      return { ...base, type: c.type, options: [...new Set(c.options)] };
    case "OPTION":
      return { ...base, type: c.type, field: c.field, options: [...new Set(c.options)] };
    case "MIN":
      return { ...base, type: c.type, field: c.field, min: c.min };
    case "MAX":
      return { ...base, type: c.type, field: c.field, max: c.max };
    default:
      return { ...base, type: c.type, field: c.field, min: c.min, max: c.max };
  }
}

/** JSON with keys in a fixed order: the database stores JSON with its keys reordered, so a plain comparison would see a change where there is none. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v));
}

async function loadRule(db: Executor, institutionId: string, id: string) {
  const [rule] = await db.select().from(admissionRules).where(and(eq(admissionRules.id, id), eq(admissionRules.institutionId, institutionId))).limit(1);
  if (!rule) throw new NotFoundError("Admission rule");
  return rule;
}

async function present(db: Executor, rule: typeof admissionRules.$inferSelect, withVersions: boolean) {
  const [versions, criteria, s, used] = await Promise.all([
    db.select().from(admissionRuleVersions).where(eq(admissionRuleVersions.ruleId, rule.id)).orderBy(desc(admissionRuleVersions.version)),
    loadCriteria(db),
    structureOf(db, rule.institutionId),
    db.selectDistinct({ versionId: deliberationRunRules.ruleVersionId }).from(deliberationRunRules).innerJoin(admissionRuleVersions, eq(admissionRuleVersions.id, deliberationRunRules.ruleVersionId)).where(eq(admissionRuleVersions.ruleId, rule.id)),
  ]);
  const view = (v: (typeof versions)[number]) => ({
    id: v.id,
    version: v.version,
    condition: v.condition,
    scope: v.scope,
    summary: describeCondition(v.condition, criteria, s.nameOf),
    appliesTo: [...v.scope.facultyIds, ...v.scope.departmentIds, ...v.scope.programIds].map(s.nameOf),
    notes: v.notes,
    createdBy: v.createdBy,
    createdAt: v.createdAt,
    usedByDeliberation: used.some((u) => u.versionId === v.id),
  });
  return {
    id: rule.id,
    name: rule.name,
    description: rule.description,
    status: rule.status,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
    current: versions[0] ? view(versions[0]) : null,
    versionCount: versions.length,
    ...(withVersions ? { versions: versions.map(view) } : {}),
  };
}

export async function listRules(user: PublicUser) {
  const db = getDb();
  await assertReader(db, user);
  const rules = await db.select().from(admissionRules).where(eq(admissionRules.institutionId, institutionOf(user))).orderBy(asc(admissionRules.name));
  return Promise.all(rules.map((r) => present(db, r, false)));
}

export async function getRule(user: PublicUser, id: string) {
  const db = getDb();
  await assertReader(db, user);
  return present(db, await loadRule(db, institutionOf(user), id), true);
}

export async function createRule(user: PublicUser, input: unknown) {
  assertWriter(user);
  const institutionId = institutionOf(user);
  const v = parseWith(createSchema, input);
  const db = getDb();
  const id = newId("rule");
  await db.transaction(async (tx) => {
    const { condition, scope } = await checkVersion(tx, institutionId, v);
    await tx.insert(admissionRules).values({ id, institutionId, name: v.name, description: v.description, createdBy: user.id });
    const versionId = newId("rulev");
    await tx.insert(admissionRuleVersions).values({ id: versionId, ruleId: id, version: 1, condition, scope, notes: v.notes, createdBy: user.id });
    await audit(tx, { action: "create", entityType: "admission-rule", entityId: id, institutionId, before: null, after: { name: v.name, version: 1, condition, scope } });
  });
  return getRule(user, id);
}

/** Adds a new version: what the rule requires from now on. Earlier versions are kept unchanged. */
export async function addVersion(user: PublicUser, id: string, input: unknown) {
  assertWriter(user);
  const institutionId = institutionOf(user);
  const v = parseWith(versionSchema, input);
  const db = getDb();
  await db.transaction(async (tx) => {
    const rule = await loadRule(tx, institutionId, id);
    const { condition, scope } = await checkVersion(tx, institutionId, v);
    const [{ latest }] = await tx.select({ latest: max(admissionRuleVersions.version) }).from(admissionRuleVersions).where(eq(admissionRuleVersions.ruleId, rule.id));
    const [previous] = await tx.select().from(admissionRuleVersions).where(and(eq(admissionRuleVersions.ruleId, rule.id), eq(admissionRuleVersions.version, latest ?? 0))).limit(1);
    if (previous && canonical(previous.condition) === canonical(condition) && canonical(previous.scope) === canonical(scope)) {
      throw new ConflictError("Nothing has changed since the current version.");
    }
    const version = (latest ?? 0) + 1;
    // The unique (rule, version) index stops two administrators saving the same version number at once.
    await tx.insert(admissionRuleVersions).values({ id: newId("rulev"), ruleId: rule.id, version, condition, scope, notes: v.notes, createdBy: user.id });
    await tx.update(admissionRules).set({ updatedAt: new Date() }).where(eq(admissionRules.id, rule.id));
    await audit(tx, { action: "version", entityType: "admission-rule", entityId: rule.id, institutionId, before: previous ? { version: previous.version, condition: previous.condition, scope: previous.scope } : null, after: { version, condition, scope } });
  });
  return getRule(user, id);
}

/** Renames a rule, rewords its description, or switches it on or off. Adds no version. */
export async function updateRule(user: PublicUser, id: string, input: unknown) {
  assertWriter(user);
  const institutionId = institutionOf(user);
  const patch = parseWith(updateSchema, input);
  const db = getDb();
  await db.transaction(async (tx) => {
    const rule = await loadRule(tx, institutionId, id);
    if (!Object.keys(patch).length) return;
    const [updated] = await tx.update(admissionRules).set(patch).where(eq(admissionRules.id, rule.id)).returning();
    await audit(tx, { action: Object.keys(patch).length === 1 && patch.status ? "status" : "update", entityType: "admission-rule", entityId: rule.id, institutionId, before: rule, after: updated });
  });
  return getRule(user, id);
}

/** Deletes a rule added by mistake. Once a deliberation has used it, it stays on record and can only be deactivated. */
export async function deleteRule(user: PublicUser, id: string) {
  assertWriter(user);
  const institutionId = institutionOf(user);
  const db = getDb();
  await db.transaction(async (tx) => {
    const rule = await loadRule(tx, institutionId, id);
    const versions = await tx.select({ id: admissionRuleVersions.id }).from(admissionRuleVersions).where(eq(admissionRuleVersions.ruleId, rule.id));
    const [used] = versions.length ? await tx.select({ id: deliberationRunRules.deliberationRunId }).from(deliberationRunRules).where(inArray(deliberationRunRules.ruleVersionId, versions.map((v) => v.id))).limit(1) : [];
    if (used) throw new ConflictError("A deliberation has been run with this rule, so it can't be deleted. Deactivate it instead.");
    await tx.delete(admissionRules).where(eq(admissionRules.id, rule.id));
    await audit(tx, { action: "delete", entityType: "admission-rule", entityId: rule.id, institutionId, before: rule, after: null });
  });
}

/** What rules can test, and the institution's structure for faculty, department and specialty conditions. */
export async function ruleBuilderOptions(user: PublicUser) {
  const db = getDb();
  await assertReader(db, user);
  const [criteria, s] = await Promise.all([loadCriteria(db), structureOf(db, institutionOf(user))]);
  return { criteria: [...criteria.values()], faculties: s.faculties, departments: s.departments, programs: s.programs };
}

const evaluateSchema = z.object({ applicationId: requiredText(100), version: z.number().int().min(1).optional() });

/**
 * Tests a rule (its current version, or the one named) against a
 * submitted application to this institution, for each program the
 * applicant chose. Programs outside the rule's scope are reported as not
 * covered by it. Every condition's outcome is explained.
 */
export async function evaluateRule(user: PublicUser, id: string, input: unknown) {
  const institutionId = institutionOf(user);
  const v = parseWith(evaluateSchema, input);
  const db = getDb();
  await assertReader(db, user);
  const rule = await loadRule(db, institutionId, id);
  const [version] = await db
    .select()
    .from(admissionRuleVersions)
    .where(and(eq(admissionRuleVersions.ruleId, rule.id), v.version ? eq(admissionRuleVersions.version, v.version) : undefined))
    .orderBy(desc(admissionRuleVersions.version))
    .limit(1);
  if (!version) throw new NotFoundError("Rule version");

  // By its Application ID (AOSA-2026-000123) or its internal id; either way, only this institution's.
  const [byNumber] = await db
    .select({ id: applicationInstitutions.id })
    .from(applicationInstitutions)
    .where(and(eq(applicationInstitutions.institutionId, institutionId), eq(applicationInstitutions.applicationNumber, v.applicationId.trim().toUpperCase())))
    .limit(1);
  const app = await loadApplicationInstitution(db, byNumber?.id ?? v.applicationId).catch(() => null);
  if (!app || app.institutionId !== institutionId) throw new NotFoundError("Application");
  if (EDITABLE_STATUSES.includes(app.status as ApplicationStatus) || !app.payments.some((p) => p.approval === "APPROVED")) {
    throw new ConflictError("Rules are tested on applications that have been submitted and paid for.");
  }
  const [criteria, s] = await Promise.all([loadCriteria(db), structureOf(db, institutionId)]);
  const facts = await loadFacts(db, app.application.applicantId, criteria);
  const choices = app.choices.map((c) => {
    const program = { programId: c.programId, facultyId: c.facultyId, departmentId: c.departmentId };
    if (!inScope(version.scope, program)) return { rank: c.rank, programId: c.programId, programName: c.programName, applies: false, pass: null, outcome: null };
    const outcome = evaluate(version.condition, facts, program, criteria, s.nameOf);
    return { rank: c.rank, programId: c.programId, programName: c.programName, applies: true, pass: outcome.pass, outcome };
  });
  return { rule: { id: rule.id, name: rule.name, version: version.version }, application: { id: app.id, reference: app.applicationNumber ?? app.reference }, choices };
}
