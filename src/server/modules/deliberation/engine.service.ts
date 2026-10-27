import "server-only";
import { and, asc, count, desc, eq, inArray, max } from "drizzle-orm";
import { z } from "zod";
import { evaluate, inScope, type Condition, type Criterion, type Outcome, type ProgramFacts, type RuleScope } from "@/lib/admission/rules";
import type { PublicUser } from "@/lib/auth/users";
import { getDb, type Executor } from "@/server/db/client";
import { admissionRuleVersions, admissionRules, admissions, applicationInstitutions, applications as applicationInstitutionsApplicant, deliberationResults, deliberationRunRules, deliberationRuns, departments, educationRecords, faculties, programs, users } from "@/server/db/schema";
import { newId } from "@/server/db/ids";
import { audit } from "@/server/audit/audit";
import { assertPermission } from "@/server/auth/access";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/http/errors";
import { parseWith } from "@/server/http/validate";
import { loadCriteria, loadFacts } from "@/server/modules/admission/criteria";
import { loadApplicationInstitution, type LoadedApplication } from "@/server/modules/applications/applications.queries";
import { transition } from "@/server/modules/applications/applications.workflow";
import { assertCanDeliberate, chargeNames } from "./deliberation.service";
import { createAdmission } from "./admissions.service";

/**
 * The Deliberation Engine. It takes the institution's Deliberation List
 * (applications it has acknowledged) and works through it in stages:
 *
 *   1. General conditions: what every applicant must meet whatever they
 *      applied for: examination results recorded, education recorded, and
 *      every active admission rule that applies to all programs.
 *   2. First choice: those who passed stage 1 are tested against their
 *      first program's requirements (the program is open, and every active
 *      rule that applies to it). Those who meet them compete for its
 *      places, best first by the ranking criterion chosen for the run, then
 *      by date of submission.
 *   3. Second choice, for those not placed at stage 2.
 *   4. Third choice, for those placed at neither.
 *   5. The report: counts at each stage, each program's places and who
 *      filled them, and every applicant's result with every reason.
 *
 * A program's places are its available spaces less the places already
 * offered (by an earlier published run, or by hand). Nothing is
 * hard-coded: the rules are the institution's, the criteria come from the
 * platform's configuration (src/lib/admission/rules.ts).
 *
 * A run records why each applicant passed or failed, which rule versions
 * it applied, and its report, and is never changed afterwards. Rerunning
 * makes a new run. A run proposes; publishing it makes the offers.
 */

type RuleVersionRow = typeof admissionRuleVersions.$inferSelect & { ruleName: string };

function institutionOf(user: PublicUser): string {
  if (!user.institutionId) throw new ForbiddenError("This account isn't linked to an institution.");
  return user.institutionId;
}

const assertAccess = (db: Executor, user: PublicUser) => assertPermission(db, user, "DELIBERATION", "Deliberation needs the \"Deliberation List\" permission.");

/** True if a condition tree tests the program (faculty, department or specialty) rather than only the applicant. */
function testsProgram(c: Condition): boolean {
  if (c.type === "FACULTY" || c.type === "DEPARTMENT" || c.type === "SPECIALTY") return true;
  return (c.children ?? []).some(testsProgram);
}

const emptyScope = (s: RuleScope) => s.facultyIds.length + s.departmentIds.length + s.programIds.length === 0;

/** A rule that applies to every program and tests only the applicant is a general condition; anything else is a program requirement. */
const isGeneral = (v: RuleVersionRow) => emptyScope(v.scope) && !testsProgram(v.condition);

/** A ranking value: a number as it is, a grade by its points. */
function meritOf(criterion: Criterion | undefined, value: unknown): number | null {
  if (!criterion || value === undefined || Array.isArray(value)) return null;
  if (criterion.kind === "grade") return criterion.grades?.find((g) => g.code === value)?.points ?? null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

interface RuleOutcome {
  ruleId: string;
  rule: string;
  version: number;
  pass: boolean;
  outcome: Outcome;
}

interface ChoiceReason {
  rank: number;
  programId: string;
  program: string;
  requirementsMet: boolean;
  checks: { label: string; pass: boolean; detail: string }[];
  rules: RuleOutcome[];
  /** Whether a place was available once the better-ranked applicants were placed. Null when the requirements weren't met. */
  placed: boolean | null;
  /** Place among those who met this program's requirements at this stage. */
  position: number | null;
  competing: number | null;
}

const runSchema = z.object({
  /** A criterion key to rank by when places are short (a number or a grade); omitted ranks by date of submission. */
  rankBy: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).default(""),
});

/** Runs the deliberation and records it as a new run. */
export async function runDeliberation(user: PublicUser, input: unknown) {
  const institutionId = institutionOf(user);
  const v = parseWith(runSchema, input);
  const db = getDb();
  await assertAccess(db, user);
  await assertCanDeliberate(db, institutionId);

  const criteria = await loadCriteria(db);
  const rankCriterion = v.rankBy ? criteria.get(v.rankBy) : undefined;
  if (v.rankBy && (!rankCriterion || (rankCriterion.kind !== "number" && rankCriterion.kind !== "grade"))) throw new ValidationError({ rankBy: "Rank by a score, a count, points or a grade from the list." });

  // Every active rule, at its current version.
  const ruleRows = await db.select().from(admissionRules).where(and(eq(admissionRules.institutionId, institutionId), eq(admissionRules.status, "ACTIVE")));
  const versions: RuleVersionRow[] = [];
  for (const r of ruleRows) {
    const [current] = await db.select().from(admissionRuleVersions).where(eq(admissionRuleVersions.ruleId, r.id)).orderBy(desc(admissionRuleVersions.version)).limit(1);
    if (current) versions.push({ ...current, ruleName: r.name });
  }
  const general = versions.filter(isGeneral);
  const programRules = versions.filter((x) => !isGeneral(x));

  // The institution's structure, for names and for places.
  const [progRows, facRows, depRows, offered] = await Promise.all([
    db.select().from(programs).where(eq(programs.institutionId, institutionId)),
    db.select({ id: faculties.id, name: faculties.name }).from(faculties).where(eq(faculties.institutionId, institutionId)),
    db.select({ id: departments.id, name: departments.name }).from(departments).where(eq(departments.institutionId, institutionId)),
    db
      .select({ programId: admissions.programId, n: count() })
      .from(admissions)
      .innerJoin(applicationInstitutions, eq(applicationInstitutions.id, admissions.applicationInstitutionId))
      .where(and(eq(applicationInstitutions.institutionId, institutionId), inArray(admissions.status, ["OFFERED", "ACCEPTED"]), inArray(applicationInstitutions.status, ["ACCEPTED", "A_ACKNOWLEDGED"])))
      .groupBy(admissions.programId),
  ]);
  const names = new Map<string, string>([...progRows, ...facRows, ...depRows].map((x) => [x.id, x.name]));
  const nameOf = (id: string) => names.get(id) ?? id;
  const capacity = new Map(progRows.map((p) => [p.id, Math.max(0, p.availableSpaces - Number(offered.find((o) => o.programId === p.id)?.n ?? 0))]));
  const remaining = new Map(capacity);

  // The Deliberation List, each application with its applicant's facts.
  const listed = await db.select({ id: applicationInstitutions.id }).from(applicationInstitutions).where(and(eq(applicationInstitutions.institutionId, institutionId), eq(applicationInstitutions.status, "I_ACKNOWLEDGED")));
  if (!listed.length) throw new ConflictError("The deliberation list is empty: acknowledge applications first.");
  const apps: { app: LoadedApplication; facts: Awaited<ReturnType<typeof loadFacts>>; educationCount: number; merit: number | null }[] = [];
  for (const row of listed) {
    const app = await loadApplicationInstitution(db, row.id);
    const facts = await loadFacts(db, app.application.applicantId, criteria);
    const [{ n }] = await db.select({ n: count() }).from(educationRecords).where(eq(educationRecords.userId, app.application.applicantId));
    apps.push({ app, facts, educationCount: Number(n), merit: v.rankBy ? meritOf(rankCriterion, facts[v.rankBy]) : null });
  }

  const ruleOutcome = (rv: RuleVersionRow, facts: (typeof apps)[number]["facts"], program: ProgramFacts): RuleOutcome => {
    const outcome = evaluate(rv.condition, facts, program, criteria, nameOf);
    return { ruleId: rv.ruleId, rule: rv.ruleName, version: rv.version, pass: outcome.pass, outcome };
  };
  const programOf = (c: LoadedApplication["choices"][number]): ProgramFacts => ({ programId: c.programId, facultyId: c.facultyId, departmentId: c.departmentId });

  // Stage 1: general conditions.
  const state = new Map<string, { general: { pass: boolean; checks: ChoiceReason["checks"]; rules: RuleOutcome[] }; choices: ChoiceReason[]; placed: { rank: number; programId: string } | null }>();
  for (const a of apps) {
    const examResults = Object.keys(a.facts).some((k) => k.startsWith("exam:") && k.endsWith(":passes"));
    const checks = [
      { label: "Examination results", pass: examResults, detail: examResults ? "Results recorded" : "No examination results recorded" },
      { label: "Education", pass: a.educationCount > 0, detail: a.educationCount ? `${a.educationCount} school${a.educationCount === 1 ? "" : "s"} recorded` : "No education recorded" },
    ];
    const first = a.app.choices[0];
    const rules = general.map((rv) => ruleOutcome(rv, a.facts, first ? programOf(first) : { programId: "", facultyId: "", departmentId: "" }));
    state.set(a.app.id, { general: { pass: checks.every((c) => c.pass) && rules.every((r) => r.pass), checks, rules }, choices: [], placed: null });
  }

  // Stages 2 to 4: each choice in turn, for those not yet placed.
  for (const rank of [1, 2, 3]) {
    const contenders: { a: (typeof apps)[number]; reason: ChoiceReason }[] = [];
    for (const a of apps) {
      const st = state.get(a.app.id)!;
      if (!st.general.pass || st.placed) continue;
      const choice = a.app.choices.find((c) => c.rank === rank);
      if (!choice) continue;
      const program = progRows.find((p) => p.id === choice.programId);
      const checks = [
        { label: "Program open", pass: program?.status === "ACTIVE", detail: program?.status === "ACTIVE" ? "Accepting students" : "The program is no longer offered" },
        { label: "Places", pass: (capacity.get(choice.programId) ?? 0) > 0, detail: `${capacity.get(choice.programId) ?? 0} place${capacity.get(choice.programId) === 1 ? "" : "s"} this run` },
      ];
      const pf = programOf(choice);
      const rules = programRules.filter((rv) => inScope(rv.scope, pf)).map((rv) => ruleOutcome(rv, a.facts, pf));
      const reason: ChoiceReason = { rank, programId: choice.programId, program: choice.programName, requirementsMet: checks.every((c) => c.pass) && rules.every((r) => r.pass), checks, rules, placed: null, position: null, competing: null };
      st.choices.push(reason);
      if (reason.requirementsMet) contenders.push({ a, reason });
    }
    // Best first: ranking criterion (highest first, unknown last), then who submitted first.
    contenders.sort((x, y) => {
      const mx = x.a.merit ?? -Infinity;
      const my = y.a.merit ?? -Infinity;
      if (mx !== my) return my - mx;
      return (x.a.app.submittedAt?.getTime() ?? 0) - (y.a.app.submittedAt?.getTime() ?? 0);
    });
    const byProgram = new Map<string, typeof contenders>();
    for (const c of contenders) byProgram.set(c.reason.programId, [...(byProgram.get(c.reason.programId) ?? []), c]);
    for (const [programId, list] of byProgram) {
      list.forEach((c, i) => {
        c.reason.position = i + 1;
        c.reason.competing = list.length;
        const left = remaining.get(programId) ?? 0;
        c.reason.placed = left > 0;
        if (left > 0) {
          remaining.set(programId, left - 1);
          state.get(c.a.app.id)!.placed = { rank, programId };
        }
      });
    }
  }

  // Record the run, its rules, every result and the report, in one go.
  const runId = newId("drun");
  const results = apps.map((a) => {
    const st = state.get(a.app.id)!;
    const placed = st.placed;
    const note = !st.general.pass
      ? `Did not meet the general conditions: ${[...st.general.checks.filter((c) => !c.pass).map((c) => c.label), ...st.general.rules.filter((r) => !r.pass).map((r) => r.rule)].join(", ")}.`
      : placed
      ? `Admitted to ${nameOf(placed.programId)} (choice ${placed.rank}).`
      : st.choices.length === 0
      ? "No program choices."
      : `Not admitted: ${st.choices.map((c) => `choice ${c.rank}, ${c.program}: ${c.requirementsMet ? `requirements met, no place left (ranked ${c.position} of ${c.competing})` : "requirements not met"}`).join("; ")}.`;
    return {
      id: newId("dres"),
      deliberationRunId: runId,
      applicationInstitutionId: a.app.id,
      outcome: placed ? ("ACCEPTED" as const) : ("UNSUCCESSFUL" as const),
      choice: placed?.rank ?? null,
      programId: placed?.programId ?? null,
      note,
      failedAt: placed ? null : st.general.pass ? "CHOICES" : "GENERAL",
      merit: a.merit,
      reasons: { general: st.general, choices: st.choices } as Record<string, unknown>,
    };
  });
  const ids = (rank: number) => results.filter((r) => r.choice === rank).map((r) => r.applicationInstitutionId);
  const summary = {
    listed: apps.length,
    passedGeneral: [...state.values()].filter((s) => s.general.pass).length,
    failedGeneral: [...state.values()].filter((s) => !s.general.pass).length,
    admitted: { total: results.filter((r) => r.outcome === "ACCEPTED").length, firstChoice: ids(1).length, secondChoice: ids(2).length, thirdChoice: ids(3).length },
    unsuccessful: results.filter((r) => r.outcome === "UNSUCCESSFUL").length,
    rankBy: v.rankBy ? { key: v.rankBy, label: rankCriterion!.label } : null,
    rules: versions.map((x) => ({ ruleId: x.ruleId, rule: x.ruleName, version: x.version, kind: isGeneral(x) ? "GENERAL" : "PROGRAM" })),
    programs: progRows
      .filter((p) => capacity.get(p.id) || results.some((r) => r.programId === p.id) || [...state.values()].some((s) => s.choices.some((c) => c.programId === p.id)))
      .map((p) => ({
        programId: p.id,
        program: p.name,
        faculty: nameOf(p.facultyId),
        department: nameOf(p.departmentId),
        places: capacity.get(p.id) ?? 0,
        admitted: results.filter((r) => r.programId === p.id).length,
        byChoice: [1, 2, 3].map((rank) => results.filter((r) => r.programId === p.id && r.choice === rank).length),
        applied: [...state.values()].filter((s) => s.choices.some((c) => c.programId === p.id)).length,
        metRequirements: [...state.values()].filter((s) => s.choices.some((c) => c.programId === p.id && c.requirementsMet)).length,
      })),
  };

  await db.transaction(async (tx) => {
    const [{ last }] = await tx.select({ last: max(deliberationRuns.runNumber) }).from(deliberationRuns).where(eq(deliberationRuns.institutionId, institutionId));
    await tx.insert(deliberationRuns).values({
      id: runId,
      institutionId,
      runNumber: (last ?? 0) + 1,
      status: "COMPLETED",
      notes: v.notes,
      rankBy: v.rankBy ?? null,
      results: { accepted: results.filter((r) => r.outcome === "ACCEPTED").map((r) => r.applicationInstitutionId), unsuccessful: results.filter((r) => r.outcome === "UNSUCCESSFUL").map((r) => r.applicationInstitutionId), firstChoice: ids(1), secondChoice: ids(2), thirdChoice: ids(3) },
      summary,
      runBy: user.id,
    });
    if (versions.length) await tx.insert(deliberationRunRules).values(versions.map((x) => ({ deliberationRunId: runId, ruleVersionId: x.id, kind: isGeneral(x) ? ("GENERAL" as const) : ("PROGRAM" as const) })));
    await tx.insert(deliberationResults).values(results);
    await audit(tx, { action: "run", entityType: "deliberation", entityId: runId, institutionId, meta: { listed: summary.listed, admitted: summary.admitted.total, rankBy: v.rankBy ?? null, rules: summary.rules.map((r) => `${r.rule} v${r.version}`) } });
  });
  return getRun(user, runId);
}

/** Every run, newest first, without the per-applicant detail. */
export async function listRuns(user: PublicUser) {
  const db = getDb();
  await assertAccess(db, user);
  const runs = await db.select().from(deliberationRuns).where(eq(deliberationRuns.institutionId, institutionOf(user))).orderBy(desc(deliberationRuns.runNumber), desc(deliberationRuns.createdAt));
  const latest = runs[0]?.id;
  return runs.map((r) => ({ id: r.id, runNumber: r.runNumber, status: r.status, notes: r.notes, summary: r.summary, runBy: r.runBy, createdAt: r.createdAt, publishedAt: r.publishedAt, latest: r.id === latest }));
}

/** One run with its report and every applicant's result and reasons, as recorded. */
export async function getRun(user: PublicUser, id: string) {
  const db = getDb();
  await assertAccess(db, user);
  const [run] = await db.select().from(deliberationRuns).where(and(eq(deliberationRuns.id, id), eq(deliberationRuns.institutionId, institutionOf(user)))).limit(1);
  if (!run) throw new NotFoundError("Deliberation run");
  const [rows, [newer], [runner]] = await Promise.all([
    db
      .select({ r: deliberationResults, reference: applicationInstitutions.reference, applicationNumber: applicationInstitutions.applicationNumber, status: applicationInstitutions.status, applicant: users.fullName, program: programs.name })
      .from(deliberationResults)
      .innerJoin(applicationInstitutions, eq(applicationInstitutions.id, deliberationResults.applicationInstitutionId))
      .innerJoin(applicationInstitutionsApplicant, eq(applicationInstitutionsApplicant.id, applicationInstitutions.applicationId))
      .innerJoin(users, eq(users.id, applicationInstitutionsApplicant.applicantId))
      .leftJoin(programs, eq(programs.id, deliberationResults.programId))
      .where(eq(deliberationResults.deliberationRunId, run.id))
      .orderBy(asc(deliberationResults.outcome), asc(users.fullName)),
    db.select({ id: deliberationRuns.id }).from(deliberationRuns).where(and(eq(deliberationRuns.institutionId, run.institutionId), eq(deliberationRuns.runNumber, run.runNumber + 1))).limit(1),
    run.runBy ? db.select({ name: users.fullName }).from(users).where(eq(users.id, run.runBy)).limit(1) : Promise.resolve([]),
  ]);
  return {
    id: run.id,
    runNumber: run.runNumber,
    status: run.status,
    notes: run.notes,
    rankBy: run.rankBy,
    runBy: runner?.name ?? null,
    createdAt: run.createdAt,
    publishedAt: run.publishedAt,
    latest: !newer,
    canPublish: run.status === "COMPLETED" && !newer,
    report: run.summary,
    results: rows.map(({ r, ...x }) => ({
      applicationId: r.applicationInstitutionId,
      applicationNumber: x.applicationNumber ?? x.reference,
      applicant: x.applicant,
      currentStatus: x.status,
      outcome: r.outcome,
      choice: r.choice,
      programId: r.programId,
      program: x.program,
      failedAt: r.failedAt,
      merit: r.merit,
      note: r.note,
      reasons: r.reasons,
    })),
  };
}

/** The report as a spreadsheet: one line per applicant, with the outcome and why. */
export async function runCsv(user: PublicUser, id: string) {
  const run = await getRun(user, id);
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [["Application ID", "Applicant", "Outcome", "Choice", "Program", "Ranking value", "Stopped at", "Reason"].map(cell).join(",")];
  for (const r of run.results) lines.push([r.applicationNumber, r.applicant, r.outcome === "ACCEPTED" ? "Admitted" : "Not admitted", r.choice ?? "", r.program ?? "", r.merit ?? "", r.failedAt === "GENERAL" ? "General conditions" : r.failedAt === "CHOICES" ? "Program choices" : "", r.note].map(cell).join(","));
  return { filename: `deliberation-run-${run.runNumber}.csv`, body: lines.join("\r\n") + "\r\n" };
}

/**
 * Makes the offers a run proposed: every admitted applicant still on the
 * Deliberation List is offered their place, with the run recorded on the
 * admission. Only the latest run can be published, and only once; to
 * change the outcome, rerun and publish the new run.
 */
export async function publishRun(user: PublicUser, id: string) {
  const institutionId = institutionOf(user);
  const db = getDb();
  await assertAccess(db, user);
  const outcome = await db.transaction(async (tx) => {
    const subscription = await assertCanDeliberate(tx, institutionId);
    const [run] = await tx.select().from(deliberationRuns).where(and(eq(deliberationRuns.id, id), eq(deliberationRuns.institutionId, institutionId))).limit(1);
    if (!run) throw new NotFoundError("Deliberation run");
    if (run.status === "PUBLISHED") throw new ConflictError("This run has already been published.");
    const [newer] = await tx.select({ id: deliberationRuns.id }).from(deliberationRuns).where(and(eq(deliberationRuns.institutionId, institutionId), eq(deliberationRuns.runNumber, run.runNumber + 1))).limit(1);
    if (newer) throw new ConflictError("A newer run has been made since. Publish the latest run.");
    const admitted = await tx.select().from(deliberationResults).where(and(eq(deliberationResults.deliberationRunId, run.id), eq(deliberationResults.outcome, "ACCEPTED")));
    let offered = 0;
    const publishedAt = new Date();
    const skipped: string[] = [];
    for (const r of admitted) {
      const app = await loadApplicationInstitution(tx, r.applicationInstitutionId);
      // Decided by hand since the run was made: left as it is.
      if (app.status !== "I_ACKNOWLEDGED") {
        skipped.push(app.applicationNumber ?? app.reference);
        continue;
      }
      await chargeNames(tx, institutionId, [app.id], subscription);
      await transition(tx, app, "ACCEPTED", "institution", { actorUserId: user.id, note: `Offered ${app.choices.find((c) => c.programId === r.programId)?.programName ?? "a place"} (choice ${r.choice}) by deliberation run ${run.runNumber}.` });
      // The Admission List entry: program, institution, application, run and result, date and status.
      await createAdmission(tx, { run, result: r, institutionId, admittedBy: user.id, at: publishedAt });
      offered++;
    }
    await tx.update(deliberationRuns).set({ status: "PUBLISHED", publishedAt, publishedBy: user.id }).where(eq(deliberationRuns.id, run.id));
    await audit(tx, { action: "publish", entityType: "deliberation", entityId: run.id, institutionId, meta: { offered, skipped } });
    return { offered, skipped };
  });
  return { ...(await getRun(user, id)), published: outcome };
}
