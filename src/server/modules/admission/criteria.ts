import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import type { Criterion, Facts } from "@/lib/admission/rules";
import { CAMEROON_REGIONS, LANGUAGE_OPTIONS, MARITAL_STATUS_OPTIONS, SEX_OPTIONS } from "@/lib/demographic/options";
import type { Executor } from "@/server/db/client";
import { countries, demographicProfiles, educationQualifications, educationRecords, examinationResults, parameters } from "@/server/db/schema";
import { getExamConfigurationData } from "@/server/modules/student/examinations.service";

/**
 * What admission rules can test, built from the platform's configuration
 * at the moment it is asked for: each examination's subjects and grades
 * (with the points administrators gave each grade), the demographic
 * option lists, the countries on offer, and the education qualifications.
 * Nothing about any particular rule is written here.
 */
export async function loadCriteria(db: Executor): Promise<Map<string, Criterion>> {
  const [exams, gradeParams, countryRows, quals] = await Promise.all([
    getExamConfigurationData(db),
    db.select({ category: parameters.category, code: parameters.code, attrs: parameters.attrs }).from(parameters).where(inArray(parameters.category, ["gce-ol-grades", "gce-al-grades"])),
    db.select({ name: countries.name }).from(countries).where(and(eq(countries.status, "ACTIVE"), eq(countries.nationality, true))).orderBy(countries.sortOrder, countries.name),
    db.selectDistinct({ label: educationQualifications.label }).from(educationQualifications).orderBy(educationQualifications.label),
  ]);
  const out = new Map<string, Criterion>();
  const add = (c: Criterion) => out.set(c.key, c);

  for (const t of exams.types) {
    const group = t.qualification;
    if (t.resultMode === "grade") {
      // Grades by their points, best first. "GCE_AL" grades are the "gce-al-grades" list.
      const category = `${t.family.toLowerCase().replace("_", "-")}-grades`;
      const points = (code: string) => Number(gradeParams.find((g) => g.category === category && g.code === code)?.attrs?.points ?? 0);
      const grades = t.grades.map((code) => ({ code, points: points(code) })).sort((a, b) => b.points - a.points);
      const best = grades[0]?.points ?? 0;
      for (const subject of t.subjects) add({ key: `exam:${t.id}:${subject}`, label: `${t.qualification}: ${subject}`, group, kind: "grade", grades });
      add({ key: `exam:${t.id}:points`, label: `${t.qualification}: total points`, group, kind: "number", minValue: 0, maxValue: best * t.subjects.length });
    } else {
      for (const subject of t.subjects) add({ key: `exam:${t.id}:${subject}`, label: `${t.qualification}: ${subject}`, group, kind: "number", minValue: 0, maxValue: t.maxScore });
      add({ key: `exam:${t.id}:average`, label: `${t.qualification}: average score`, group, kind: "number", minValue: 0, maxValue: t.maxScore });
    }
    add({ key: `exam:${t.id}:passes`, label: `${t.qualification}: subjects passed`, group, kind: "number", minValue: 0, maxValue: Math.max(t.subjects.length, 1) });
  }

  const list = (values: readonly string[]) => values.map((v) => ({ value: v, label: v }));
  add({ key: "age", label: "Age (years)", group: "Personal", kind: "number", minValue: 0, maxValue: 100 });
  add({ key: "demographic:sex", label: "Sex", group: "Personal", kind: "option", options: list(SEX_OPTIONS) });
  add({ key: "demographic:nationality", label: "Nationality", group: "Personal", kind: "option", options: list(countryRows.map((c) => c.name)) });
  add({ key: "demographic:regionOfOrigin", label: "Region of origin", group: "Personal", kind: "option", options: list(CAMEROON_REGIONS) });
  add({ key: "demographic:preferredLanguage", label: "Language of instruction", group: "Personal", kind: "option", options: list(LANGUAGE_OPTIONS) });
  add({ key: "demographic:maritalStatus", label: "Marital status", group: "Personal", kind: "option", options: list(MARITAL_STATUS_OPTIONS) });
  add({ key: "education:qualification", label: "Qualification held", group: "Education", kind: "options", options: list(quals.map((q) => q.label)) });
  return out;
}

/** Everything the criteria can test about one applicant, worked out from what they have recorded. */
export async function loadFacts(db: Executor, applicantId: string, criteria: Map<string, Criterion>): Promise<Facts> {
  const [exams, results, [demo], education] = await Promise.all([
    getExamConfigurationData(db),
    db.select().from(examinationResults).where(eq(examinationResults.userId, applicantId)),
    db.select().from(demographicProfiles).where(eq(demographicProfiles.userId, applicantId)).limit(1),
    db.select({ qualification: educationRecords.qualification }).from(educationRecords).where(eq(educationRecords.userId, applicantId)),
  ]);
  const facts: Facts = {};
  const passType = new Set(exams.resultTypes.filter((r) => r.meaning === "pass").map((r) => r.id));

  for (const t of exams.types) {
    const mine = results.filter((r) => r.examTypeId === t.id);
    if (!mine.length) continue;
    let passes = 0;
    let points = 0;
    const scores: number[] = [];
    for (const subject of new Set(mine.map((r) => r.subject))) {
      const key = `exam:${t.id}:${subject}`;
      const criterion = criteria.get(key);
      const sat = mine.filter((r) => r.subject === subject);
      // Over several sittings, the best result counts.
      if (t.resultMode === "grade") {
        const graded = sat.map((r) => criterion?.grades?.find((g) => g.code === r.value)).filter((g): g is { code: string; points: number } => !!g);
        const best = graded.sort((a, b) => b.points - a.points)[0];
        if (best) {
          facts[key] = best.code;
          points += best.points;
        }
        if ((best && t.passingGrades.includes(best.code)) || sat.some((r) => r.resultTypeId && passType.has(r.resultTypeId))) passes++;
      } else {
        const values = sat.map((r) => Number(r.value)).filter((v) => r_ok(v));
        const best = values.length ? Math.max(...values) : undefined;
        if (best !== undefined) {
          facts[key] = best;
          scores.push(best);
        }
        if ((best !== undefined && best >= t.passMark) || sat.some((r) => r.resultTypeId && passType.has(r.resultTypeId))) passes++;
      }
    }
    facts[`exam:${t.id}:passes`] = passes;
    if (t.resultMode === "grade") facts[`exam:${t.id}:points`] = points;
    else if (scores.length) facts[`exam:${t.id}:average`] = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
  }

  if (demo) {
    if (demo.dateOfBirth) {
      const born = new Date(demo.dateOfBirth);
      const now = new Date();
      facts.age = now.getUTCFullYear() - born.getUTCFullYear() - (now.getUTCMonth() < born.getUTCMonth() || (now.getUTCMonth() === born.getUTCMonth() && now.getUTCDate() < born.getUTCDate()) ? 1 : 0);
    }
    for (const field of ["sex", "nationality", "regionOfOrigin", "preferredLanguage", "maritalStatus"] as const) if (demo[field]) facts[`demographic:${field}`] = demo[field];
  }
  facts["education:qualification"] = [...new Set(education.map((e) => e.qualification))];
  return facts;
}

const r_ok = (v: number) => Number.isFinite(v);
