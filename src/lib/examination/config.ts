import { sortParams, type ExamParamCategory, type ParamItem } from "@/lib/admin/parameters";

/**
 * Examination configuration: what the student Examination and Results
 * forms offer, and what the server checks their submissions against.
 *
 * None of the examination types, subjects, grades, result types or
 * sitting limits are written here. They are built from the parameters
 * administrators manage under Admin → Examination parameters, which live
 * in the `parameters` table. The server builds this from the database and
 * serves it at GET /api/config/examinations; nothing in this file touches
 * React, so the same code runs on both sides.
 *
 * Each GCE level is one qualification. BAC, BEPC and Probatoire are
 * families whose *types* (series) each become their own qualification,
 * because each series has its own subjects and scoring.
 */

export type ResultMode = "grade" | "score";

export type ExamFamily = "GCE_OL" | "GCE_AL" | "BEPC" | "PROBATOIRE" | "BAC";

export interface ExamTypeConfig {
  /** Stable id stored on the applicant's record. */
  id: string;
  family: ExamFamily;
  familyLabel: string;
  /** Shown in the Qualification dropdown. */
  qualification: string;
  resultMode: ResultMode;
  /** Grade labels, in display order (resultMode === "grade"). */
  grades: string[];
  /** Grades that count as a pass (resultMode === "grade"). */
  passingGrades: string[];
  /** Highest possible score (resultMode === "score"). */
  maxScore: number;
  /** Minimum score that counts as a pass (resultMode === "score"). */
  passMark: number;
  subjects: string[];
  defaultSittings: number;
  maxSittings: number;
  /** False when the admin has deactivated the type since it was used. */
  active: boolean;
}

export interface ResultTypeOption {
  id: string;
  code: string;
  label: string;
  meaning: "pass" | "fail" | "not-graded";
}

/** The configuration as plain data, the form the API sends it in. */
export interface ExamConfigurationData {
  /** Every qualification, active or not. */
  types: ExamTypeConfig[];
  /** Every result type, active or not. */
  resultTypes: (ResultTypeOption & { active: boolean })[];
}

export interface ExamConfiguration {
  /** Active qualifications, for choosing from. */
  types: ExamTypeConfig[];
  /** Looks up any qualification, including deactivated ones, for records that already use it. */
  get(id: string): ExamTypeConfig | undefined;
  /** Label for a computed pass or fail, as the admin named it. */
  resultLabel(result: "Pass" | "Fail"): string;
  /** Results an applicant can record instead of a grade, e.g. Absent. */
  notGradedTypes: ResultTypeOption[];
  resultType(id: string): ResultTypeOption | undefined;
}

/** Used only if the examination-types list has no row for a family. */
const FALLBACK_SITTINGS = { defaultSittings: 1, maxSittings: 3 };

const FAMILIES: {
  family: ExamFamily;
  label: string;
  types?: ExamParamCategory;
  subjects?: ExamParamCategory;
  grades?: ExamParamCategory;
}[] = [
  { family: "GCE_OL", label: "GCE Ordinary Level", subjects: "gce-ol-subjects", grades: "gce-ol-grades" },
  { family: "GCE_AL", label: "GCE Advanced Level", subjects: "gce-al-subjects", grades: "gce-al-grades" },
  { family: "BEPC", label: "BEPC", types: "bepc-types" },
  { family: "PROBATOIRE", label: "Probatoire", types: "probatoire-types" },
  { family: "BAC", label: "Baccalauréat", types: "bac-types" },
];

/** The parameter lists the examination configuration is built from. */
export const EXAM_PARAM_CATEGORIES: ExamParamCategory[] = [
  "examination-types",
  "result-types",
  ...FAMILIES.flatMap((f) => [f.types, f.subjects, f.grades].filter((c): c is ExamParamCategory => !!c)),
];

/** The fields of a parameter this file reads; a database row and a screen record both fit. */
export type ExamParam = Pick<ParamItem, "id" | "category" | "code" | "label" | "status" | "order" | "attrs">;

const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

export function buildExamConfigurationData(items: ExamParam[]): ExamConfigurationData {
  const byCategory = (c: ExamParamCategory) => sortParams(items.filter((i) => i.category === c) as ParamItem[]);
  const active = (list: ExamParam[]) => list.filter((i) => i.status === "ACTIVE");
  const familyRows = byCategory("examination-types");

  const types: ExamTypeConfig[] = [];
  for (const f of FAMILIES) {
    // The administrators' row for this family: its name, whether it is on offer, and its sittings.
    const row = familyRows.find((r) => r.code === f.family);
    const familyLabel = row?.label ?? f.label;
    const familyActive = row ? row.status === "ACTIVE" : true;
    const familyMax = Math.max(1, num(row?.attrs.maxSittings, FALLBACK_SITTINGS.maxSittings));
    const defaultSittings = Math.min(familyMax, Math.max(1, num(row?.attrs.defaultSittings, FALLBACK_SITTINGS.defaultSittings)));

    if (f.subjects && f.grades) {
      const grades = active(byCategory(f.grades));
      types.push({
        id: f.family,
        family: f.family,
        familyLabel,
        qualification: familyLabel,
        resultMode: "grade",
        grades: grades.map((g) => g.code),
        passingGrades: grades.filter((g) => g.attrs.passing === true).map((g) => g.code),
        maxScore: 0,
        passMark: 0,
        subjects: active(byCategory(f.subjects)).map((s) => s.label),
        defaultSittings,
        maxSittings: familyMax,
        active: familyActive,
      });
    } else if (f.types) {
      for (const t of byCategory(f.types)) {
        const subjects = Array.isArray(t.attrs.subjects) ? t.attrs.subjects : [];
        const maxSittings = Math.max(1, num(t.attrs.maxSittings, familyMax));
        types.push({
          id: t.id,
          family: f.family,
          familyLabel,
          qualification: t.label,
          resultMode: "score",
          grades: [],
          passingGrades: [],
          maxScore: num(t.attrs.maxScore, 20),
          passMark: num(t.attrs.passMark, 10),
          subjects,
          defaultSittings: Math.min(maxSittings, defaultSittings),
          maxSittings,
          active: familyActive && t.status === "ACTIVE",
        });
      }
    }
  }

  const resultTypes = byCategory("result-types").map((r) => ({
    id: r.id,
    code: r.code,
    label: r.label,
    meaning: (r.attrs.meaning as ResultTypeOption["meaning"]) ?? "not-graded",
    active: r.status === "ACTIVE",
  }));

  return { types, resultTypes };
}

/** Wraps the data with the lookups the forms and the validators use. */
export function toExamConfiguration(data: ExamConfigurationData): ExamConfiguration {
  const activeResults = data.resultTypes.filter((r) => r.active);
  const labelFor = (meaning: "pass" | "fail", fallback: string) => activeResults.find((r) => r.meaning === meaning)?.label ?? fallback;
  const index = new Map(data.types.map((t) => [t.id, t]));
  return {
    types: data.types.filter((t) => t.active),
    get: (id) => index.get(id),
    resultLabel: (r) => (r === "Pass" ? labelFor("pass", "Pass") : labelFor("fail", "Fail")),
    notGradedTypes: activeResults.filter((r) => r.meaning === "not-graded"),
    resultType: (id) => data.resultTypes.find((r) => r.id === id),
  };
}

export function buildExamConfiguration(items: ExamParam[]): ExamConfiguration {
  return toExamConfiguration(buildExamConfigurationData(items));
}

/**
 * Pass or Fail from a raw grade or score, using the qualification's
 * configured pass criteria.
 */
export function computeResult(config: ExamTypeConfig, rawValue: string): "Pass" | "Fail" {
  if (config.resultMode === "grade") {
    return config.passingGrades.includes(rawValue) ? "Pass" : "Fail";
  }
  const score = Number(rawValue);
  if (!Number.isFinite(score)) return "Fail";
  return score >= config.passMark ? "Pass" : "Fail";
}

/** Groups qualifications by family for an <optgroup> dropdown. */
export function groupByFamily(types: ExamTypeConfig[]): { label: string; types: ExamTypeConfig[] }[] {
  const groups: { label: string; types: ExamTypeConfig[] }[] = [];
  for (const t of types) {
    let g = groups.find((x) => x.label === t.familyLabel);
    if (!g) groups.push((g = { label: t.familyLabel, types: [] }));
    g.types.push(t);
  }
  return groups;
}
